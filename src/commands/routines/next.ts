import {Command} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {toJsonErrorPayload} from '../../lib/json-error.js'
import {serializeRoutineDetailWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getNextRoutineDetail} from '../../lib/repositories/routines.js'
import {buildRoutineRows} from '../../lib/routine-output.js'
import {resolveProgramWeightUnit, weightUnitLabel} from '../../lib/units.js'

export default class RoutinesNext extends Command {
  static description = 'Show the up-next routine from the active program'
  static enableJsonFlag = true

  async run(): Promise<unknown | void> {
    await this.parse(RoutinesNext)
    const context = openDb()

    try {
      const detail = await getNextRoutineDetail(context.db)
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
    } catch (error) {
      if (this.jsonEnabled()) return toJsonErrorPayload(error)
      throw error
    } finally {
      await closeDb(context)
    }
  }
}
