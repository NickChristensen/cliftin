import {Args, Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {serializeExerciseHistoryRowsWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getExerciseDetail, listExercises, resolveExerciseSelector} from '../../lib/repositories/exercises.js'
import {resolveExerciseWeightUnit, weightUnitLabel} from '../../lib/units.js'

function formatMusclesCell(primaryMuscles: null | string, secondaryMuscles: null | string): string {
  const primary = primaryMuscles ?? 'n/a'
  if (!secondaryMuscles) return primary
  const secondaryLines = secondaryMuscles
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n')
  return `${primary}\n${secondaryLines}`
}

export default class Exercises extends Command {
  static args = {
    selector: Args.string({description: 'exercise id or name', required: false}),
  }
  static description = 'List exercises, or show one exercise detail'
  static enableJsonFlag = true
  static sortOptions = ['name', 'lastPerformed', 'timesPerformed'] as const
  static flags = {
    equipment: Flags.string({description: 'Filter by equipment name'}),
    muscle: Flags.string({description: 'Filter by muscle group'}),
    name: Flags.string({description: 'Filter by name contains'}),
    sort: Flags.option({
      default: 'name',
      options: Exercises.sortOptions,
    })(),
  }

  async run(): Promise<unknown | void> {
    const {args, flags} = await this.parse(Exercises)
    const context = openDb()

    try {
      if (!args.selector) {
        const exercises = await listExercises(context.db, {
          equipment: flags.equipment,
          muscle: flags.muscle,
          name: flags.name,
          sort: flags.sort,
        })

        if (this.jsonEnabled()) return exercises

        this.log(
          renderTable(
            exercises.map((exercise) => ({
              equipment: exercise.equipment,
              id: exercise.id,
              lastPerformed: exercise.lastPerformed,
              muscles: formatMusclesCell(exercise.primaryMuscles, exercise.secondaryMuscles),
              name: exercise.name,
              timesPerformed: exercise.timesPerformed,
            })),
          ),
        )
        return
      }

      const exerciseId = await resolveExerciseSelector(context.db, args.selector)
      const detail = await getExerciseDetail(context.db, exerciseId)
      const unitPreference = await resolveExerciseWeightUnit(context.db, exerciseId)
      const unitLabel = weightUnitLabel(unitPreference)

      if (this.jsonEnabled()) {
        const serializedHistoryRows = detail.lastHistoryEntry
          ? serializeExerciseHistoryRowsWithWeightUnits([detail.lastHistoryEntry], unitPreference)
          : []

        return {
          ...detail,
          lastHistoryEntry: serializedHistoryRows[0] ?? null,
        }
      }

      this.log(`[${detail.id}] ${detail.name ?? '(unnamed)'}`)
      this.log(`Primary muscles: ${detail.primaryMuscles ?? 'n/a'}`)
      this.log(`Secondary muscles: ${detail.secondaryMuscles ?? 'n/a'}`)
      this.log(`Equipment: ${detail.equipment ?? 'n/a'}`)
      this.log(`Timer based: ${detail.timerBased}`)
      this.log(`Supports 1RM: ${detail.supports1RM}`)
      this.log(`Workouts tracked: ${detail.totalWorkouts}`)
      this.log(`Routines present in: ${detail.totalRoutines}`)
      this.log(`Recent routines: ${detail.recentRoutines.join(', ') || 'n/a'}`)
      this.log('')
      this.log('Most recent history row')
      this.log(
        renderTable(
          detail.lastHistoryEntry
            ? [
                {
                  ...detail.lastHistoryEntry,
                  topWeight:
                    detail.lastHistoryEntry.topWeight === null
                      ? null
                      : `${detail.lastHistoryEntry.topWeight} ${unitLabel}`,
                },
              ]
            : [],
        ),
      )
    } finally {
      await closeDb(context)
    }
  }
}
