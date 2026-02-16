import {Args, Command, Flags} from '@oclif/core'
import {format, isValid, parseISO} from 'date-fns'

import {closeDb, openDb} from '../../lib/db.js'
import {serializeExerciseHistoryRowsWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getExerciseDetail, getLastPerformedExerciseSnapshot, listExercises, resolveExerciseSelector} from '../../lib/repositories/exercises.js'
import {resolveExerciseWeightUnit, resolveGlobalWeightUnit, weightUnitLabel, withWeightUnit} from '../../lib/units.js'

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

function formatWorkoutDate(dateIso: null | string): string {
  if (!dateIso) return 'n/a'

  const parsed = parseISO(dateIso)
  if (!isValid(parsed)) return dateIso
  return format(parsed, 'yyyy-MM-dd HH:mm')
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
      const lastPerformedSnapshot = await getLastPerformedExerciseSnapshot(context.db, detail.id)

      if (this.jsonEnabled()) {
        const historyUnitPreference = await resolveExerciseWeightUnit(context.db, exerciseId)
        const serializedHistoryRows = detail.lastHistoryEntry
          ? serializeExerciseHistoryRowsWithWeightUnits([detail.lastHistoryEntry], historyUnitPreference)
          : []
        const lastHistoryEntry = serializedHistoryRows[0] ?? null

        let lastPerformed: null | {
          date: null | string
          exercise: {
            exerciseId: null | number
            exerciseResultId: number
            name: null | string
            sets: Array<{
              id: number
              reps: null | number
              rpe: null | number
              timeSeconds: null | number
              volume: null | number
              weight: ReturnType<typeof withWeightUnit>
            }>
          }
          id: number
          program: null | string
          routine: null | string
        } = null

        if (lastPerformedSnapshot) {
          const workoutUnitPreference = await resolveGlobalWeightUnit(context.db)
          lastPerformed = {
            date: lastPerformedSnapshot.workout.date,
            exercise: {
              exerciseId: lastPerformedSnapshot.exercise.exerciseId,
              exerciseResultId: lastPerformedSnapshot.exercise.exerciseResultId,
              name: lastPerformedSnapshot.exercise.name,
              sets: lastPerformedSnapshot.exercise.sets.map((set) => ({
                ...set,
                weight: withWeightUnit(set.weight, workoutUnitPreference),
              })),
            },
            id: lastPerformedSnapshot.workout.id,
            program: lastPerformedSnapshot.workout.program,
            routine: lastPerformedSnapshot.workout.routine,
          }
        }

        return {
          ...detail,
          lastHistoryEntry,
          lastPerformed,
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
      this.log('Last performed')
      if (!lastPerformedSnapshot) {
        this.log('(no rows)')
        return
      }

      const unitPreference = await resolveGlobalWeightUnit(context.db)
      const unitLabel = weightUnitLabel(unitPreference)

      this.log(`[${lastPerformedSnapshot.workout.id}] ${lastPerformedSnapshot.workout.routine ?? 'Workout'}`)
      this.log(`Program: ${lastPerformedSnapshot.workout.program ?? 'n/a'}`)
      this.log(`Date: ${formatWorkoutDate(lastPerformedSnapshot.workout.date)}`)
      this.log('')
      this.log(
        renderTable(
          lastPerformedSnapshot.exercise.sets.map((set) => ({
            id: set.id,
            reps: set.reps,
            rpe: set.rpe,
            timeSeconds: set.timeSeconds,
            volume: set.volume,
            weight: set.weight === null ? null : `${set.weight} ${unitLabel}`,
          })),
        ),
      )
    } finally {
      await closeDb(context)
    }
  }
}
