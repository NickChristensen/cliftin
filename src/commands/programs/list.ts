import {Command} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {renderTable} from '../../lib/output.js'
import {listPrograms} from '../../lib/repositories/programs.js'

export default class Programs extends Command {
  static description = 'List programs'
  static enableJsonFlag = true

  async run(): Promise<unknown | void> {
    await this.parse(Programs)
    const context = openDb()

    try {
      const programs = await listPrograms(context.db)

      if (this.jsonEnabled()) return programs

      this.log(
        renderTable(
          programs.map((program) => ({
            dateAdded: program.dateAdded,
            id: program.id,
            isActive: program.isActive,
            isTemplate: program.isTemplate,
            name: program.name,
          })),
        ),
      )
    } finally {
      await closeDb(context)
    }
  }
}
