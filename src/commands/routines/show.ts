import {Args, Command} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {serializeRoutineDetailWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getRoutineDetail} from '../../lib/repositories/routines.js'
import {buildRoutineRows} from '../../lib/routine-output.js'
import {resolveProgramWeightUnit, weightUnitLabel} from '../../lib/units.js'

export default class RoutinesShow extends Command {
  static args = {
    selector: Args.string({description: 'routine id or name', ignoreStdin: true, required: true}),
  }
  static description = 'Show one planned routine'
  static enableJsonFlag = true

  async run(): Promise<unknown | void> {
    const {args} = await this.parse(RoutinesShow)
    const context = openDb()

    try {
      const detail = await getRoutineDetail(context.db, args.selector)
      const unitPreference = await resolveProgramWeightUnit(context.db, detail.program.id)
      const unitLabel = weightUnitLabel(unitPreference)

      if (this.jsonEnabled()) {
        return serializeRoutineDetailWithWeightUnits(detail, unitPreference)
      }

      this.log(`[${detail.routine.id}] ${detail.routine.name ?? 'Routine'}`)
      this.log(`Program: ${detail.program.name}`)
      this.log(`Week: ${detail.week.number}`)
      this.log('')
      this.log(renderTable(buildRoutineRows(detail.routine, unitLabel)).replace(/^\n+/, ''))
    } finally {
      await closeDb(context)
    }
  }
}
