import {Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {toJsonErrorPayload} from '../../lib/json-error.js'
import {renderTable} from '../../lib/output.js'
import {listWorkouts} from '../../lib/repositories/workouts.js'

function formatDurationMinutes(durationSeconds: null | number): string {
  if (durationSeconds === null) return 'n/a'
  return `${Math.round(durationSeconds / 60)} minutes`
}

export default class Workouts extends Command {
  static description = 'List workouts'
  static enableJsonFlag = true
  /* eslint-disable perfectionist/sort-objects */
  static flags = {
    limit: Flags.integer({description: 'Limit workouts (default: 25)', exclusive: ['all']}),
    all: Flags.boolean({description: 'Return all matching workouts (no limit)', exclusive: ['limit']}),
    on: Flags.string({description: 'Single date YYYY-MM-DD', exclusive: ['from', 'to']}),
    from: Flags.string({description: 'Start date YYYY-MM-DD', exclusive: ['on']}),
    to: Flags.string({description: 'End date YYYY-MM-DD', exclusive: ['on']}),
    program: Flags.string({description: 'Filter by program id or name'}),
    routine: Flags.string({description: 'Filter by routine id or name'}),
  }
  /* eslint-enable perfectionist/sort-objects */

  async run(): Promise<unknown | void> {
    const {flags} = await this.parse(Workouts)
    const context = openDb()

    try {
      const workouts = await listWorkouts(context.db, {
        from: flags.from,
        limit: flags.all ? undefined : (flags.limit ?? 25),
        on: flags.on,
        program: flags.program,
        routine: flags.routine,
        to: flags.to,
      })

      if (this.jsonEnabled()) {
        return workouts.map((workout) => ({
          ...workout,
          duration: {
            unit: 'seconds',
            value: workout.duration,
          },
        }))
      }

      this.log(
        renderTable(
          workouts.map((workout) => {
            const row = {
              date: workout.date,
              duration: formatDurationMinutes(workout.duration),
              id: workout.id,
              program: workout.program,
              routine: workout.routine,
            }

            return Object.fromEntries([
              ['id', row.id],
              ['program', row.program],
              ['routine', row.routine],
              ['date', row.date],
              ['duration', row.duration],
            ])
          }),
        ),
      )
    } catch (error) {
      if (this.jsonEnabled()) return toJsonErrorPayload(error)
      throw error
    } finally {
      await closeDb(context)
    }
  }
}
