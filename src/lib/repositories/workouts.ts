import {Kysely} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {normalizeRpe} from '../rpe.js'
import {dateRangeToAppleSeconds} from '../time.js'

export type ApiWorkoutListFilters = {
  from?: string
  limit?: number
  programId?: number
  routineId?: number
  to?: string
}

export type ApiWorkoutListRow = {
  durationSeconds: null | number
  id: number
  programId: null | number
  programName: null | string
  routineId: null | number
  routineName: null | string
  startDate: null | number
}

export type ApiPerformedSetRow = {
  id: number
  isWarmup: boolean
  reps: null | number
  rpe: null | number
  timeSeconds: null | number
  volumeKg: null | number
  weightKg: null | number
}

export type ApiPerformedExerciseRow = {
  exerciseId: null | number
  id: number
  isUserCreated: boolean
  name: null | string
  sets: ApiPerformedSetRow[]
}

export type ApiWorkoutDetailRow = ApiWorkoutListRow & {
  exercises: ApiPerformedExerciseRow[]
}

function asBool(value: null | number): boolean {
  return value === 1
}

/**
 * HTTP-facing rows preserve database timestamps and kg values so the route
 * layer can apply its explicit unit and UTC contracts.
 */
export async function listApiWorkouts(
  db: Kysely<DatabaseSchema>,
  filters: ApiWorkoutListFilters,
): Promise<ApiWorkoutListRow[]> {
  const dateRange = dateRangeToAppleSeconds({from: filters.from, to: filters.to})
  // The fallback program relationship is selected directly so HTTP output does
  // not need to infer an identifier from a display name.
  let query = db
    .selectFrom('ZWORKOUTRESULT as wr')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as per', 'per.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as pDirect', 'pDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as pFromPeriod', 'pFromPeriod.Z_PK', 'per.ZWORKOUTPLAN')
    .select([
      'wr.Z_PK as id',
      'wr.ZSTARTDATE as startDate',
      'wr.ZDURATION as durationSeconds',
      'wr.ZROUTINE as routineId',
      'wr.ZROUTINENAME as routineNameFromResult',
      'r.ZNAME as routineNameFromPlan',
      'pDirect.Z_PK as programIdDirect',
      'pFromPeriod.Z_PK as programIdFromPeriod',
      'pDirect.ZNAME as programNameDirect',
      'pFromPeriod.ZNAME as programNameFromPeriod',
    ])

  if (filters.programId !== undefined) {
    query = query.where((eb) => eb.or([eb('r.ZWORKOUTPLAN', '=', filters.programId!), eb('per.ZWORKOUTPLAN', '=', filters.programId!)]))
  }

  if (filters.routineId !== undefined) query = query.where('wr.ZROUTINE', '=', filters.routineId)
  if (dateRange.from !== undefined) query = query.where('wr.ZSTARTDATE', '>=', dateRange.from)
  if (dateRange.to !== undefined) query = query.where('wr.ZSTARTDATE', '<=', dateRange.to)

  query = query.orderBy('wr.ZSTARTDATE', 'desc').orderBy('wr.Z_PK', 'desc')
  if (filters.limit !== undefined) query = query.limit(filters.limit)

  const rows = await query.execute()
  return rows.map((row) => ({
    durationSeconds: row.durationSeconds,
    id: row.id,
    programId: row.programIdDirect ?? row.programIdFromPeriod,
    programName: row.programNameDirect ?? row.programNameFromPeriod,
    routineId: row.routineId,
    routineName: row.routineNameFromResult ?? row.routineNameFromPlan,
    startDate: row.startDate,
  }))
}

export async function getApiWorkoutDetail(db: Kysely<DatabaseSchema>, workoutId: number): Promise<ApiWorkoutDetailRow | null> {
  const exists = await db.selectFrom('ZWORKOUTRESULT').select('Z_PK as id').where('Z_PK', '=', workoutId).executeTakeFirst()
  if (!exists) return null

  const detail = await db
    .selectFrom('ZWORKOUTRESULT as wr')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as per', 'per.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as pDirect', 'pDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as pFromPeriod', 'pFromPeriod.Z_PK', 'per.ZWORKOUTPLAN')
    .select([
      'wr.Z_PK as id', 'wr.ZSTARTDATE as startDate', 'wr.ZDURATION as durationSeconds', 'wr.ZROUTINE as routineId',
      'wr.ZROUTINENAME as routineNameFromResult', 'r.ZNAME as routineNameFromPlan',
      'pDirect.Z_PK as programIdDirect', 'pFromPeriod.Z_PK as programIdFromPeriod',
      'pDirect.ZNAME as programNameDirect', 'pFromPeriod.ZNAME as programNameFromPeriod',
    ])
    .where('wr.Z_PK', '=', workoutId)
    .executeTakeFirstOrThrow()

  const exerciseRows = await db
    .selectFrom('ZEXERCISERESULT as er')
    .leftJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'er.ZEXERCISE')
    .select(['er.Z_PK as id', 'er.ZEXERCISE as exerciseId', 'ei.ZNAME as name', 'ei.ZISUSERCREATED as isUserCreated'])
    .where('er.ZWORKOUT', '=', workoutId)
    .orderBy('er.Z_FOK_WORKOUT', 'asc')
    .orderBy('er.Z_PK', 'asc')
    .execute()
  const ids = exerciseRows.map((row) => row.id)
  const sets = ids.length === 0 ? [] : await db.selectFrom('ZGYMSETRESULT').select([
    'Z_PK as id', 'ZEXERCISE as performedExerciseId', 'ZREPS as reps', 'ZRPE as rpe', 'ZTIME as timeSeconds',
    'ZVOLUME as volumeKg', 'ZWEIGHT as weightKg', 'ZWARMUPSET as warmupSet',
  ]).where('ZEXERCISE', 'in', ids).orderBy('Z_FOK_EXERCISE', 'asc').orderBy('Z_PK', 'asc').execute()
  const setsByExercise = new Map<number, ApiPerformedSetRow[]>()
  for (const set of sets) {
    if (set.performedExerciseId === null) continue
    const entries = setsByExercise.get(set.performedExerciseId) ?? []
    entries.push({id: set.id, isWarmup: asBool(set.warmupSet), reps: set.reps, rpe: normalizeRpe(set.rpe), timeSeconds: set.timeSeconds, volumeKg: set.volumeKg, weightKg: set.weightKg})
    setsByExercise.set(set.performedExerciseId, entries)
  }

  return {
    durationSeconds: detail.durationSeconds,
    exercises: exerciseRows.map((row) => ({exerciseId: row.exerciseId, id: row.id, isUserCreated: asBool(row.isUserCreated), name: row.name, sets: setsByExercise.get(row.id) ?? []})),
    id: detail.id,
    programId: detail.programIdDirect ?? detail.programIdFromPeriod,
    programName: detail.programNameDirect ?? detail.programNameFromPeriod,
    routineId: detail.routineId,
    routineName: detail.routineNameFromResult ?? detail.routineNameFromPlan,
    startDate: detail.startDate,
  }
}
