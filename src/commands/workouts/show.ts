import {Args, Command} from '@oclif/core'
import {format, isValid, parseISO} from 'date-fns'

import {closeDb, openDb} from '../../lib/db.js'
import {serializeWorkoutDetailWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getWorkoutDetail, listWorkouts} from '../../lib/repositories/workouts.js'
import {resolveGlobalWeightUnit, weightUnitLabel} from '../../lib/units.js'

function formatDurationMinutes(durationSeconds: null | number): string {
  if (durationSeconds === null) return 'n/a'
  return `${Math.round(durationSeconds / 60)} minutes`
}

function formatWorkoutDate(dateIso: null | string): string {
  if (!dateIso) return 'n/a'

  const parsed = parseISO(dateIso)
  if (!isValid(parsed)) return dateIso
  return format(parsed, 'yyyy-MM-dd HH:mm')
}

export default class WorkoutsShow extends Command {
  static args = {
    workoutId: Args.string({description: 'workout id (default: latest workout)', required: false}),
  }
  static description = 'Show one workout with exercises and sets'
  static enableJsonFlag = true

  async run(): Promise<unknown | void> {
    const {args} = await this.parse(WorkoutsShow)
    const context = openDb()

    try {
      if (args.workoutId !== undefined && !/^\d+$/.test(args.workoutId)) {
        throw new Error('Workout id must be numeric.')
      }

      const workoutId = args.workoutId
        ? Number(args.workoutId)
        : await listWorkouts(context.db, {limit: 1}).then((rows) => {
            if (rows.length === 0) throw new Error('No workouts found.')
            return rows[0].id
          })
      const detail = await getWorkoutDetail(context.db, workoutId)
      const unitPreference = await resolveGlobalWeightUnit(context.db)
      const unitLabel = weightUnitLabel(unitPreference)

      if (this.jsonEnabled()) {
        const serialized = serializeWorkoutDetailWithWeightUnits(detail, unitPreference) as Record<string, unknown>
        const durationSeconds = (serialized.duration as null | number) ?? null
        return {
          ...serialized,
          duration: {
            unit: 'seconds',
            value: durationSeconds,
          },
        }
      }

      this.log(`[${detail.id}] ${detail.routine ?? 'Workout'}`)
      this.log(`Program: ${detail.program ?? 'n/a'}`)
      this.log(`Date: ${formatWorkoutDate(detail.date)}`)
      this.log(`Duration: ${formatDurationMinutes(detail.duration)}`)

      for (const exercise of detail.exercises) {
        this.log('')
        this.log(`[${exercise.exerciseId ?? exercise.exerciseResultId}] ${exercise.name ?? '(unnamed)'}`)
        this.log(
          renderTable(
            exercise.sets.map((set) => ({
              id: set.id,
              reps: set.reps,
              rpe: set.rpe,
              timeSeconds: set.timeSeconds,
              volume: set.volume,
              weight: set.weight === null ? null : `${set.weight} ${unitLabel}`,
            })),
          )
            .split('\n')
            .map((line) => `${line}`)
            .join('\n'),
        )
      }
    } finally {
      await closeDb(context)
    }
  }
}
