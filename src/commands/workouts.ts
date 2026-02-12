import {Args, Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../lib/db.js'
import {printJson, renderTable} from '../lib/output.js'
import {getWorkoutDetail, listWorkouts} from '../lib/repositories/workouts.js'

export default class Workouts extends Command {
  static args = {
    workoutId: Args.string({description: 'workout id', required: false}),
  }
static description = 'List workouts, or show one workout with exercises and sets'
static flags = {
    from: Flags.string({description: 'Start date YYYY-MM-DD'}),
    json: Flags.boolean({description: 'Output JSON'}),
    limit: Flags.integer({default: 25, description: 'Limit rows'}),
    on: Flags.string({description: 'Single date YYYY-MM-DD'}),
    program: Flags.string({description: 'Filter by program id or name'}),
    routine: Flags.string({description: 'Filter by routine id or name'}),
    to: Flags.string({description: 'End date YYYY-MM-DD'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Workouts)
    const context = openDb()

    try {
      if (!args.workoutId) {
        const workouts = await listWorkouts(context.db, {
          from: flags.from,
          limit: flags.limit,
          on: flags.on,
          program: flags.program,
          routine: flags.routine,
          to: flags.to,
        })

        if (flags.json) {
          printJson(this.log.bind(this), {data: workouts})
          return
        }

        this.log(
          renderTable(
            workouts.map((workout) => ({
              date: workout.date,
              duration: workout.duration,
              id: workout.id,
              program: workout.program,
              routine: workout.routine,
            })),
          ),
        )
        return
      }

      if (!/^\d+$/.test(args.workoutId)) {
        throw new Error('Workout detail requires numeric workout id.')
      }

      const detail = await getWorkoutDetail(context.db, Number(args.workoutId))

      if (flags.json) {
        printJson(this.log.bind(this), {data: detail})
        return
      }

      this.log(`Workout ${detail.id}`)
      this.log(`Date: ${detail.date ?? 'n/a'}`)
      this.log(`Routine: ${detail.routine ?? 'n/a'}`)
      this.log(`Program: ${detail.program ?? 'n/a'}`)
      this.log(`Duration: ${detail.duration ?? 'n/a'}`)
      this.log('')

      for (const exercise of detail.exercises) {
        this.log(`Exercise result ${exercise.exerciseResultId}: ${exercise.name ?? '(unnamed)'}`)
        this.log(
          renderTable(
            exercise.sets.map((set) => ({
              id: set.id,
              reps: set.reps,
              rpe: set.rpe,
              timeSeconds: set.timeSeconds,
              volume: set.volume,
              weight: set.weight,
            })),
          )
            .split('\n')
            .map((line) => `  ${line}`)
            .join('\n'),
        )
      }
    } finally {
      await closeDb(context)
    }
  }
}
