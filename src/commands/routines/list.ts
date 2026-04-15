import {Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {renderTable} from '../../lib/output.js'
import {listRoutines} from '../../lib/repositories/routines.js'

export default class RoutinesList extends Command {
  static description = 'List planned routines'
  static enableJsonFlag = true
  static flags = {
    name: Flags.string({description: 'Filter by routine name contains'}),
    program: Flags.string({description: 'Filter by program id or name'}),
    week: Flags.integer({description: 'Filter by week number'}),
  }

  async run(): Promise<unknown | void> {
    const {flags} = await this.parse(RoutinesList)
    const context = openDb()

    try {
      const routines = await listRoutines(context.db, {
        name: flags.name,
        program: flags.program,
        week: flags.week,
      })

      if (this.jsonEnabled()) {
        return routines.map(({id, ...routine}) => ({
          ...routine,
          routineId: id,
        }))
      }

      this.log(
        renderTable(
          routines.map((routine) => ({
            id: routine.id,
            isNext: routine.isNext,
            name: routine.name,
            program: routine.program,
            week: routine.week,
          })),
        ),
      )
    } finally {
      await closeDb(context)
    }
  }
}
