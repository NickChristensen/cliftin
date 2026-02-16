import {Args, Command, Flags} from '@oclif/core'
import {format, isValid, parseISO} from 'date-fns'

import {closeDb, openDb} from '../../lib/db.js'
import {toJsonErrorPayload} from '../../lib/json-error.js'
import {renderTable} from '../../lib/output.js'
import {
  getExerciseDetail,
  getExerciseHistoryRows,
  getExerciseHistoryWithSetsRows,
  getLastPerformedExerciseSnapshot,
  resolveExerciseSelector,
} from '../../lib/repositories/exercises.js'
import {resolveExerciseWeightUnit, resolveGlobalWeightUnit, weightUnitLabel, withWeightUnit} from '../../lib/units.js'

type ParsedFlags = {
  all: boolean
  from?: string
  limit?: number
  'max-reps'?: number
  'max-weight'?: number
  'min-reps'?: number
  'min-weight'?: number
  program?: string
  routine?: string
  to?: string
}

function formatWorkoutDate(dateIso: null | string): string {
  if (!dateIso) return 'n/a'

  const parsed = parseISO(dateIso)
  if (!isValid(parsed)) return dateIso
  return format(parsed, 'yyyy-MM-dd HH:mm')
}

function toHistoryFilters(flags: ParsedFlags) {
  return {
    from: flags.from,
    limit: flags.all ? undefined : (flags.limit ?? 100),
    maxReps: flags['max-reps'],
    maxWeight: flags['max-weight'],
    minReps: flags['min-reps'],
    minWeight: flags['min-weight'],
    program: flags.program,
    routine: flags.routine,
    to: flags.to,
  }
}

export default class ExercisesShow extends Command {
  static args = {
    selector: Args.string({description: 'exercise id or name', required: true}),
  }
  static description = 'Show one exercise detail and history'
  static enableJsonFlag = true
  static flags = {
    all: Flags.boolean({description: 'Return all matching history rows (no limit)', exclusive: ['limit']}),
    from: Flags.string({description: 'History start date YYYY-MM-DD'}),
    limit: Flags.integer({description: 'History row limit (default: 100)', exclusive: ['all']}),
    'max-reps': Flags.integer({description: 'History max top reps'}),
    'max-weight': Flags.integer({description: 'History max top weight'}),
    'min-reps': Flags.integer({description: 'History min top reps'}),
    'min-weight': Flags.integer({description: 'History min top weight'}),
    program: Flags.string({description: 'History filter by program id or name'}),
    routine: Flags.string({description: 'History filter by routine id or name'}),
    to: Flags.string({description: 'History end date YYYY-MM-DD'}),
  }

  async run(): Promise<unknown | void> {
    const {args, flags} = await this.parse(ExercisesShow)
    const parsedFlags = flags as ParsedFlags
    const context = openDb()

    try {
      const exerciseId = await resolveExerciseSelector(context.db, args.selector)
      const detail = await getExerciseDetail(context.db, exerciseId)
      const historyFilters = toHistoryFilters(parsedFlags)
      const historyRows = await getExerciseHistoryRows(context.db, exerciseId, historyFilters)
      const lastPerformedSnapshot = await getLastPerformedExerciseSnapshot(context.db, detail.id)

      if (this.jsonEnabled()) {
        const historyUnitPreference = await resolveExerciseWeightUnit(context.db, exerciseId)
        const history = (await getExerciseHistoryWithSetsRows(context.db, exerciseId, historyFilters)).map((row) => ({
          ...row,
          sets: row.sets.map((set) => ({
            ...set,
            weight: withWeightUnit(set.weight, historyUnitPreference),
          })),
          topWeight: withWeightUnit(row.topWeight, historyUnitPreference),
        }))

        return {
          defaultProgressMetric: detail.defaultProgressMetric,
          equipment: detail.equipment,
          history,
          id: detail.id,
          name: detail.name,
          perceptionScale: detail.perceptionScale,
          primaryMuscles: detail.primaryMuscles,
          recentRoutines: detail.recentRoutines,
          secondaryMuscles: detail.secondaryMuscles,
          supports1RM: detail.supports1RM,
          timerBased: detail.timerBased,
          totalRoutines: detail.totalRoutines,
          totalWorkouts: detail.totalWorkouts,
        }
      }

      this.log(`[${detail.id}] ${detail.name ?? '(unnamed)'}`)
      this.log(`Primary muscles: ${detail.primaryMuscles ?? 'n/a'}`)
      this.log(`Secondary muscles: ${detail.secondaryMuscles ?? 'n/a'}`)
      this.log(`Equipment: ${detail.equipment ?? 'n/a'}`)
      this.log(`Timer based: ${detail.timerBased}`)
      this.log(`Supports 1RM: ${detail.supports1RM}`)
      this.log(`Workouts tracked: ${detail.totalWorkouts}`)
      this.log(`Routines present in: ${detail.totalRoutines}`)
      this.log(`Recent routines: ${detail.recentRoutines.join(', ') || 'n/a'}`)
      this.log('')
      this.log('Last performed')
      if (!lastPerformedSnapshot) {
        this.log('(no rows)')
        return
      }

      const unitPreference = await resolveGlobalWeightUnit(context.db)
      const unitLabel = weightUnitLabel(unitPreference)

      this.log(`[${lastPerformedSnapshot.workout.id}] ${lastPerformedSnapshot.workout.routine ?? 'Workout'}`)
      this.log(`Program: ${lastPerformedSnapshot.workout.program ?? 'n/a'}`)
      this.log(`Date: ${formatWorkoutDate(lastPerformedSnapshot.workout.date)}`)
      this.log('')
      this.log(
        renderTable(
          lastPerformedSnapshot.exercise.sets.map((set) => ({
            id: set.id,
            reps: set.reps,
            rpe: set.rpe,
            timeSeconds: set.timeSeconds,
            volume: set.volume,
            weight: set.weight === null ? null : `${set.weight} ${unitLabel}`,
          })),
        ),
      )
      this.log('')
      this.log('History')

      const historyUnitPreference = await resolveExerciseWeightUnit(context.db, exerciseId)
      const historyUnitLabel = weightUnitLabel(historyUnitPreference)
      if (historyRows.length === 0) {
        this.log('(no rows)')
        return
      }

      this.log(
        renderTable(
          historyRows.map((row) => ({
            date: row.date,
            id: row.workoutId,
            routine: row.routine,
            sets: row.sets,
            topReps: row.topReps,
            topWeight: row.topWeight === null ? null : `${row.topWeight} ${historyUnitLabel}`,
            totalReps: row.totalReps,
            volume: row.volume,
          })),
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
