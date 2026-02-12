import {Args, Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {renderTable} from '../../lib/output.js'
import {getExerciseHistoryRows, resolveExerciseSelector} from '../../lib/repositories/exercises.js'

export default class ExercisesHistory extends Command {
  static args = {
    selector: Args.string({description: 'exercise id or name', required: true}),
  }
static description = 'Show exercise history rows'
static enableJsonFlag = true
static flags = {
    from: Flags.string({description: 'Start date YYYY-MM-DD'}),
    limit: Flags.integer({default: 100, description: 'Limit rows'}),
    'max-reps': Flags.integer({description: 'Maximum top reps'}),
    'max-weight': Flags.integer({description: 'Maximum top weight'}),
    'min-reps': Flags.integer({description: 'Minimum top reps'}),
    'min-weight': Flags.integer({description: 'Minimum top weight'}),
    program: Flags.string({description: 'Filter by program id or name'}),
    routine: Flags.string({description: 'Filter by routine id or name'}),
    to: Flags.string({description: 'End date YYYY-MM-DD'}),
  }

  async run(): Promise<void | {data: unknown}> {
    const {args, flags} = await this.parse(ExercisesHistory)
    const context = openDb()

    try {
      const exerciseId = await resolveExerciseSelector(context.db, args.selector)
      const rows = await getExerciseHistoryRows(context.db, exerciseId, {
        from: flags.from,
        limit: flags.limit,
        maxReps: flags['max-reps'],
        maxWeight: flags['max-weight'],
        minReps: flags['min-reps'],
        minWeight: flags['min-weight'],
        program: flags.program,
        routine: flags.routine,
        to: flags.to,
      })

      if (this.jsonEnabled()) return {data: rows}

      this.log(
        renderTable(
          rows.map((row) => ({
            date: row.date,
            routine: row.routine,
            sets: row.sets,
            topReps: row.topReps,
            topWeight: row.topWeight,
            totalReps: row.totalReps,
            volume: row.volume,
            workoutId: row.workoutId,
          })),
        ),
      )
    } finally {
      await closeDb(context)
    }
  }
}
