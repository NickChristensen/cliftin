import {Args, Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {renderTable} from '../../lib/output.js'
import {getExerciseDetail, listExercises, resolveExerciseSelector} from '../../lib/repositories/exercises.js'

export default class Exercises extends Command {
  static args = {
    selector: Args.string({description: 'exercise id or name', required: false}),
  }
static description = 'List exercises, or show one exercise detail'
static enableJsonFlag = true
static flags = {
    equipment: Flags.string({description: 'Filter by equipment name'}),
    'include-deleted': Flags.boolean({default: false, description: 'Include soft-deleted exercises'}),
    muscle: Flags.string({description: 'Filter by primary muscle'}),
    name: Flags.string({description: 'Filter by name contains'}),
  }

  async run(): Promise<void | {data: unknown}> {
    const {args, flags} = await this.parse(Exercises)
    const context = openDb()

    try {
      if (!args.selector) {
        const exercises = await listExercises(context.db, {
          equipment: flags.equipment,
          includeDeleted: flags['include-deleted'],
          muscle: flags.muscle,
          name: flags.name,
        })

        if (this.jsonEnabled()) return {data: exercises}

        this.log(
          renderTable(
            exercises.map((exercise) => ({
              equipment: exercise.equipment,
              id: exercise.id,
              lastPerformed: exercise.lastPerformed,
              name: exercise.name,
              primaryMuscles: exercise.primaryMuscles,
              timesPerformed: exercise.timesPerformed,
            })),
          ),
        )
        return
      }

      const exerciseId = await resolveExerciseSelector(context.db, args.selector)
      const detail = await getExerciseDetail(context.db, exerciseId)

      if (this.jsonEnabled()) return {data: detail}

      this.log(`Exercise ${detail.id}: ${detail.name ?? '(unnamed)'}`)
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
      this.log(renderTable(detail.lastHistoryEntry ? [detail.lastHistoryEntry] : []))
    } finally {
      await closeDb(context)
    }
  }
}
