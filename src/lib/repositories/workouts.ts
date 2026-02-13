import {Kysely} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {formatExerciseDisplayName} from '../names.js'
import {normalizeRpe} from '../rpe.js'
import {appleSecondsToIso, dateRangeToAppleSeconds} from '../time.js'
import {WorkoutDetail, WorkoutExerciseDetail, WorkoutSummary} from '../types.js'
import {convertKgToDisplayVolume, convertKgToDisplayWeight, resolveGlobalWeightUnit} from '../units.js'
import {resolveIdOrName} from './selectors.js'

export type WorkoutFilters = {
  from?: string
  limit?: number
  on?: string
  program?: string
  routine?: string
  to?: string
}

function asBool(value: null | number): boolean {
  return value === 1
}

export async function listWorkouts(db: Kysely<DatabaseSchema>, filters: WorkoutFilters): Promise<WorkoutSummary[]> {
  const dateRange = dateRangeToAppleSeconds({from: filters.from, on: filters.on, to: filters.to})

  let query = db
    .selectFrom('ZWORKOUTRESULT as wr')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as per', 'per.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as pDirect', 'pDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as pFromPeriod', 'pFromPeriod.Z_PK', 'per.ZWORKOUTPLAN')
    .select([
      'wr.Z_PK as id',
      'wr.ZSTARTDATE as startDate',
      'wr.ZDURATION as duration',
      'wr.ZROUTINENAME as routineNameFromResult',
      'r.ZNAME as routineNameFromPlan',
      'pDirect.ZNAME as programNameDirect',
      'pFromPeriod.ZNAME as programNameFromPeriod',
    ])

  if (filters.program) {
    const programId = await resolveIdOrName(db, 'ZWORKOUTPLAN', filters.program)
    query = query.where((eb) => eb.or([eb('r.ZWORKOUTPLAN', '=', programId), eb('per.ZWORKOUTPLAN', '=', programId)]))
  }

  if (filters.routine) {
    const routineId = await resolveIdOrName(db, 'ZROUTINE', filters.routine)
    query = query.where('wr.ZROUTINE', '=', routineId)
  }

  if (dateRange.from !== undefined) query = query.where('wr.ZSTARTDATE', '>=', dateRange.from)
  if (dateRange.to !== undefined) query = query.where('wr.ZSTARTDATE', '<=', dateRange.to)

  query = query.orderBy('wr.ZSTARTDATE', 'desc')

  if (filters.limit !== undefined) {
    query = query.limit(filters.limit)
  }

  const rows = await query.execute()

  return rows.map((row) => ({
    date: appleSecondsToIso(row.startDate),
    duration: row.duration,
    id: row.id,
    program: row.programNameDirect ?? row.programNameFromPeriod,
    routine: row.routineNameFromResult ?? row.routineNameFromPlan,
  }))
}

export async function getWorkoutDetail(db: Kysely<DatabaseSchema>, workoutId: number): Promise<WorkoutDetail> {
  const unitPreference = await resolveGlobalWeightUnit(db)

  const workout = await db
    .selectFrom('ZWORKOUTRESULT as wr')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as per', 'per.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as pDirect', 'pDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as pFromPeriod', 'pFromPeriod.Z_PK', 'per.ZWORKOUTPLAN')
    .select([
      'wr.Z_PK as id',
      'wr.ZSTARTDATE as startDate',
      'wr.ZDURATION as duration',
      'wr.ZROUTINENAME as routineNameFromResult',
      'r.ZNAME as routineNameFromPlan',
      'pDirect.ZNAME as programNameDirect',
      'pFromPeriod.ZNAME as programNameFromPeriod',
    ])
    .where('wr.Z_PK', '=', workoutId)
    .executeTakeFirst()

  if (!workout) throw new Error(`Workout not found: ${workoutId}`)

  const exerciseRows = await db
    .selectFrom('ZEXERCISERESULT as er')
    .leftJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'er.ZCONFIGURATION')
    .leftJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'ec.ZINFORMATION')
    .select(['er.Z_PK as exerciseResultId', 'ei.Z_PK as exerciseId', 'ei.ZISUSERCREATED as isUserCreated', 'ei.ZNAME as exerciseName'])
    .where('er.ZWORKOUT', '=', workoutId)
    .orderBy('er.Z_FOK_WORKOUT', 'asc')
    .orderBy('er.Z_PK', 'asc')
    .execute()

  const exerciseResultIds = exerciseRows.map((row) => row.exerciseResultId)
  const setRows =
    exerciseResultIds.length === 0
      ? []
      : await db
          .selectFrom('ZGYMSETRESULT')
          .select([
            'Z_PK as id',
            'ZEXERCISE as exerciseResultId',
            'ZREPS as reps',
            'ZRPE as rpe',
            'ZWEIGHT as weight',
            'ZTIME as timeSeconds',
            'ZVOLUME as volume',
          ])
          .where('ZEXERCISE', 'in', exerciseResultIds)
          .orderBy('Z_FOK_EXERCISE', 'asc')
          .orderBy('Z_PK', 'asc')
          .execute()

  const setsByExercise = new Map<number, WorkoutExerciseDetail['sets']>()
  for (const row of setRows) {
    if (row.exerciseResultId === null) continue

    const current = setsByExercise.get(row.exerciseResultId) ?? []
    current.push({
      id: row.id,
      reps: row.reps,
      rpe: normalizeRpe(row.rpe),
      timeSeconds: row.timeSeconds,
      volume: convertKgToDisplayVolume(row.volume, unitPreference),
      weight: convertKgToDisplayWeight(row.weight, unitPreference),
    })

    setsByExercise.set(row.exerciseResultId, current)
  }

  const exercises: WorkoutExerciseDetail[] = exerciseRows.map((row) => ({
    exerciseId: row.exerciseId,
    exerciseResultId: row.exerciseResultId,
    name: formatExerciseDisplayName(row.exerciseName, asBool(row.isUserCreated)),
    sets: setsByExercise.get(row.exerciseResultId) ?? [],
  }))

  return {
    date: appleSecondsToIso(workout.startDate),
    duration: workout.duration,
    exercises,
    id: workout.id,
    program: workout.programNameDirect ?? workout.programNameFromPeriod,
    routine: workout.routineNameFromResult ?? workout.routineNameFromPlan,
  }
}
