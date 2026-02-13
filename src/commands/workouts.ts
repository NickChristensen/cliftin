import {Args, Command, Flags} from '@oclif/core'
import {format, isValid, parseISO} from 'date-fns'

import {closeDb, openDb} from '../lib/db.js'
import {serializeWorkoutDetailWithWeightUnits} from '../lib/json-weight.js'
import {renderTable} from '../lib/output.js'
import {getWorkoutDetail, listWorkouts} from '../lib/repositories/workouts.js'
import {resolveGlobalWeightUnit, weightUnitLabel} from '../lib/units.js'

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

export default class Workouts extends Command {
  static args = {
    workoutId: Args.string({description: 'workout id', required: false}),
  }
static description = 'List workouts, or show one workout with exercises and sets'
static enableJsonFlag = true
/* eslint-disable perfectionist/sort-objects */
static flags = {
    limit: Flags.integer({description: 'Limit workouts (default: 25)', exclusive: ['all']}),
    all: Flags.boolean({description: 'Return all matching workouts (no limit)', exclusive: ['limit']}),
    on: Flags.string({description: 'Single date YYYY-MM-DD'}),
    from: Flags.string({description: 'Start date YYYY-MM-DD'}),
    to: Flags.string({description: 'End date YYYY-MM-DD'}),
    program: Flags.string({description: 'Filter by program id or name'}),
    routine: Flags.string({description: 'Filter by routine id or name'}),
  }
/* eslint-enable perfectionist/sort-objects */

  async run(): Promise<unknown | void> {
    const {args, flags} = await this.parse(Workouts)
    const context = openDb()

    try {
      if (!args.workoutId) {
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
        return
      }

      if (!/^\d+$/.test(args.workoutId)) {
        throw new Error('Workout detail requires numeric workout id.')
      }

      const detail = await getWorkoutDetail(context.db, Number(args.workoutId))
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
