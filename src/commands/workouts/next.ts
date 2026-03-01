import {Command} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {toJsonErrorPayload} from '../../lib/json-error.js'
import {serializeNextWorkoutDetailWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getNextWorkoutDetail} from '../../lib/repositories/workouts.js'
import {resolveProgramWeightUnit, weightUnitLabel} from '../../lib/units.js'

export default class WorkoutsNext extends Command {
  static description = 'Show the up-next routine from the active program'
  static enableJsonFlag = true

  async run(): Promise<unknown | void> {
    await this.parse(WorkoutsNext)
    const context = openDb()

    try {
      const detail = await getNextWorkoutDetail(context.db)
      const unitPreference = await resolveProgramWeightUnit(context.db, detail.program.id)
      const unitLabel = weightUnitLabel(unitPreference)

      if (this.jsonEnabled()) {
        return serializeNextWorkoutDetailWithWeightUnits(detail, unitPreference)
      }

      this.log(`[${detail.routine.id}] ${detail.routine.name ?? 'Workout'}`)
      this.log(`Program: ${detail.program.name}`)
      this.log(`Week: ${detail.week.number}`)

      for (const exercise of detail.routine.exercises) {
        this.log('')
        this.log(`[${exercise.id ?? exercise.exerciseConfigId}] ${exercise.name ?? '(unnamed)'}`)
        this.log(
          renderTable(
            exercise.sets.map((set) => ({
              reps: set.reps,
              rpe: set.rpe,
              timeSeconds: set.timeSeconds,
              weight: set.weight === null ? null : `${set.weight} ${unitLabel}`,
            })),
          ),
        )
      }
    } catch (error) {
      if (this.jsonEnabled()) return toJsonErrorPayload(error)
      throw error
    } finally {
      await closeDb(context)
    }
  }
}
