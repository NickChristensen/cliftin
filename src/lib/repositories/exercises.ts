import {Kysely} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {appleSecondsToIso, dateRangeToAppleSeconds} from '../time.js'
import {ExerciseDetail, ExerciseHistoryRow, ExerciseSummary} from '../types.js'
import {convertKgToDisplayVolume, convertKgToDisplayWeight, resolveExerciseWeightUnit} from '../units.js'
import {resolveIdOrName} from './selectors.js'

export type ExerciseListFilters = {
  equipment?: string
  includeDeleted: boolean
  muscle?: string
  name?: string
}

export type ExerciseHistoryFilters = {
  from?: string
  limit: number
  maxReps?: number
  maxWeight?: number
  minReps?: number
  minWeight?: number
  program?: string
  routine?: string
  to?: string
}

function asBool(value: null | number): boolean {
  return value === 1
}

export async function resolveExerciseSelector(db: Kysely<DatabaseSchema>, selector: string): Promise<number> {
  return resolveIdOrName(db, 'ZEXERCISEINFORMATION', selector)
}

export async function listExercises(
  db: Kysely<DatabaseSchema>,
  filters: ExerciseListFilters,
): Promise<ExerciseSummary[]> {
  let query = db
    .selectFrom('ZEXERCISEINFORMATION as ei')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .leftJoin('ZEXERCISECONFIGURATION as ec', 'ec.ZINFORMATION', 'ei.Z_PK')
    .leftJoin('ZEXERCISERESULT as er', 'er.ZCONFIGURATION', 'ec.Z_PK')
    .leftJoin('ZWORKOUTRESULT as wr', 'wr.Z_PK', 'er.ZWORKOUT')
    .select([
      'ei.Z_PK as id',
      'ei.ZNAME as name',
      'ei.ZMUSCLES as primaryMuscles',
      'ei.ZTIMERBASED as timerBased',
      'ei.ZSUPPORTSONEREPMAX as supports1RM',
      'eq.ZNAME as equipment',
      (eb) => eb.fn.max('wr.ZSTARTDATE').as('lastPerformed'),
      (eb) => eb.fn.count('wr.Z_PK').distinct().as('timesPerformed'),
    ])
    .groupBy(['ei.Z_PK', 'eq.ZNAME'])
    .orderBy('ei.ZNAME', 'asc')

  if (!filters.includeDeleted) query = query.where('ei.ZSOFTDELETED', 'is not', 1)
  if (filters.name) query = query.where('ei.ZNAME', 'like', `%${filters.name}%`)
  if (filters.muscle) query = query.where('ei.ZMUSCLES', 'like', `%${filters.muscle}%`)
  if (filters.equipment) query = query.where('eq.ZNAME', 'like', `%${filters.equipment}%`)

  const rows = await query.execute()

  return rows.map((row) => ({
    equipment: row.equipment,
    id: row.id,
    lastPerformed: appleSecondsToIso(row.lastPerformed as null | number),
    name: row.name,
    primaryMuscles: row.primaryMuscles,
    supports1RM: asBool(row.supports1RM),
    timerBased: asBool(row.timerBased),
    timesPerformed: Number(row.timesPerformed),
  }))
}

export async function getExerciseHistoryRows(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
  filters: ExerciseHistoryFilters,
): Promise<ExerciseHistoryRow[]> {
  const unitPreference = await resolveExerciseWeightUnit(db, exerciseId)
  const dateRange = dateRangeToAppleSeconds({from: filters.from, to: filters.to})

  let query = db
    .selectFrom('ZWORKOUTRESULT as wr')
    .innerJoin('ZEXERCISERESULT as er', 'er.ZWORKOUT', 'wr.Z_PK')
    .innerJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'er.ZCONFIGURATION')
    .innerJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'ec.ZINFORMATION')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZWORKOUTPLAN as p', 'p.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZGYMSETRESULT as gs', 'gs.ZEXERCISE', 'er.Z_PK')
    .select([
      'wr.Z_PK as workoutId',
      'wr.ZSTARTDATE as startDate',
      'wr.ZROUTINENAME as routineNameFromResult',
      'r.ZNAME as routineNameFromPlan',
      (eb) => eb.fn.count('gs.Z_PK').as('sets'),
      (eb) => eb.fn.coalesce(eb.fn.sum<number>('gs.ZREPS'), eb.val(0)).as('totalReps'),
      (eb) => eb.fn.max('gs.ZREPS').as('topReps'),
      (eb) => eb.fn.max('gs.ZWEIGHT').as('topWeight'),
      (eb) => eb.fn.coalesce(eb.fn.sum<number>('gs.ZVOLUME'), eb.val(0)).as('volume'),
    ])
    .where('ei.Z_PK', '=', exerciseId)
    .groupBy(['wr.Z_PK', 'wr.ZSTARTDATE', 'wr.ZROUTINENAME', 'r.ZNAME'])
    .orderBy('wr.ZSTARTDATE', 'desc')

  if (filters.program) {
    const programId = await resolveIdOrName(db, 'ZWORKOUTPLAN', filters.program)
    query = query.where('r.ZWORKOUTPLAN', '=', programId)
  }

  if (filters.routine) {
    const routineId = await resolveIdOrName(db, 'ZROUTINE', filters.routine)
    query = query.where('wr.ZROUTINE', '=', routineId)
  }

  if (dateRange.from !== undefined) query = query.where('wr.ZSTARTDATE', '>=', dateRange.from)
  if (dateRange.to !== undefined) query = query.where('wr.ZSTARTDATE', '<=', dateRange.to)

  const rows = await query.limit(filters.limit).execute()

  const normalized: ExerciseHistoryRow[] = rows.map((row) => ({
    date: appleSecondsToIso(row.startDate),
    routine: row.routineNameFromResult ?? row.routineNameFromPlan,
    sets: Number(row.sets),
    topReps: row.topReps,
    topWeight: convertKgToDisplayWeight(row.topWeight, unitPreference),
    totalReps: Number(row.totalReps),
    volume: convertKgToDisplayVolume(Number(row.volume), unitPreference) ?? 0,
    workoutId: row.workoutId,
  }))

  return normalized.filter((row) => {
    if (filters.minReps !== undefined && row.topReps !== null && row.topReps < filters.minReps) return false
    if (filters.maxReps !== undefined && row.topReps !== null && row.topReps > filters.maxReps) return false
    if (filters.minWeight !== undefined && row.topWeight !== null && row.topWeight < filters.minWeight) return false
    if (filters.maxWeight !== undefined && row.topWeight !== null && row.topWeight > filters.maxWeight) return false
    return true
  })
}

export async function getExerciseDetail(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
  historyLimit = 3,
): Promise<ExerciseDetail> {
  const row = await db
    .selectFrom('ZEXERCISEINFORMATION as ei')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .select([
      'ei.Z_PK as id',
      'ei.ZNAME as name',
      'ei.ZMUSCLES as primaryMuscles',
      'ei.ZSECONDARYMUSCLES as secondaryMuscles',
      'ei.ZDEFAULTPROGRESSMETRIC as defaultProgressMetric',
      'ei.ZPERCEPTIONSCALE as perceptionScale',
      'ei.ZTIMERBASED as timerBased',
      'ei.ZSUPPORTSONEREPMAX as supports1RM',
      'eq.ZNAME as equipment',
    ])
    .where('ei.Z_PK', '=', exerciseId)
    .executeTakeFirst()

  if (!row) throw new Error(`Exercise not found: ${exerciseId}`)

  const routineRows = await db
    .selectFrom('Z_12ROUTINES as j')
    .innerJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'j.Z_12EXERCISES')
    .innerJoin('ZROUTINE as r', 'r.Z_PK', 'j.Z_28ROUTINES')
    .select(['r.ZNAME as routineName'])
    .where('ec.ZINFORMATION', '=', exerciseId)
    .where('r.ZSOFTDELETED', 'is not', 1)
    .groupBy('r.ZNAME')
    .orderBy('r.ZNAME', 'asc')
    .execute()

  const workoutCountRow = await db
    .selectFrom('ZEXERCISERESULT as er')
    .innerJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'er.ZCONFIGURATION')
    .select((eb) => eb.fn.count('er.ZWORKOUT').distinct().as('totalWorkouts'))
    .where('ec.ZINFORMATION', '=', exerciseId)
    .executeTakeFirst()

  const latestHistory = await getExerciseHistoryRows(db, exerciseId, {limit: 1})

  return {
    defaultProgressMetric: row.defaultProgressMetric,
    equipment: row.equipment,
    id: row.id,
    lastHistoryEntry: latestHistory[0] ?? null,
    name: row.name,
    perceptionScale: row.perceptionScale,
    primaryMuscles: row.primaryMuscles,
    recentRoutines: routineRows.map((routine) => routine.routineName ?? '(unnamed)').slice(0, historyLimit),
    secondaryMuscles: row.secondaryMuscles,
    supports1RM: asBool(row.supports1RM),
    timerBased: asBool(row.timerBased),
    totalRoutines: routineRows.length,
    totalWorkouts: Number(workoutCountRow?.totalWorkouts ?? 0),
  }
}
