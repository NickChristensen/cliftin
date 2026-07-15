import {Kysely, sql} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {formatEquipmentDisplayName, formatMuscleLabel} from '../names.js'
import {normalizeRpe} from '../rpe.js'
import {dateRangeToAppleSeconds} from '../time.js'
export type ApiExerciseMetadataRow = {
  alternativeEnglishNames: string[]
  defaultProgressMetric: null | string
  equipment: null | string
  equipmentId: null | string
  id: number
  isDeleted: boolean
  isUserCreated: boolean
  name: null | string
  perceptionScale: null | string
  primaryMuscles: string[]
  secondaryMuscles: string[]
  supports1RM: boolean
  timerBased: boolean
}

export type ApiExerciseMetadataFilters = {
  equipmentId?: string
  muscle?: string
  q?: string
}

export type ApiExercisePerformanceFilters = {
  from?: string
  maxReps?: number
  maxWeightKg?: number
  minReps?: number
  minWeightKg?: number
  programId?: number
  routineId?: number
  to?: string
}

export type ApiExercisePerformanceSetRow = {
  id: number
  isWarmup: boolean
  reps: null | number
  rpe: null | number
  timeSeconds: null | number
  volumeKg: null | number
  weightKg: null | number
}

export type ApiExercisePerformanceRow = {
  id: number
  programId: null | number
  programName: null | string
  routineId: null | number
  routineName: null | string
  sets: ApiExercisePerformanceSetRow[]
  startDate: null | number
  statistics: {
    setCount: number
    topReps: null | number
    topWeightKg: null | number
    totalReps: number
    volumeKg: number
  }
  workoutId: number
}

function asBool(value: null | number): boolean {
  return value === 1
}

function splitLabels(value: null | string, separator: ',' | ';'): string[] {
  if (!value) return []
  return value
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean)
}

function muscleLabels(value: null | string): string[] {
  return splitLabels(value, ',').map((muscle) => formatMuscleLabel(muscle) ?? muscle)
}

const workingSetCountExpr = sql<number>`sum(case when gs.Z_PK is not null and coalesce(gs.ZWARMUPSET, 0) != 1 then 1 else 0 end)`
const workingSetTotalRepsExpr = sql<number>`coalesce(sum(case when coalesce(gs.ZWARMUPSET, 0) != 1 then gs.ZREPS else 0 end), 0)`
const workingSetTopRepsExpr = sql<null | number>`max(case when coalesce(gs.ZWARMUPSET, 0) != 1 then gs.ZREPS end)`
const workingSetTopWeightExpr = sql<null | number>`max(case when coalesce(gs.ZWARMUPSET, 0) != 1 then gs.ZWEIGHT end)`
const workingSetVolumeExpr = sql<number>`coalesce(sum(case when coalesce(gs.ZWARMUPSET, 0) != 1 then gs.ZVOLUME else 0 end), 0)`
export async function listApiExerciseMetadata(
  db: Kysely<DatabaseSchema>,
  filters: ApiExerciseMetadataFilters,
): Promise<ApiExerciseMetadataRow[]> {
  // These are the only separators formatExerciseDisplayName adds to stored
  // identifiers, including its parenthetical assisted/weighted suffixes.
  const normalizedQuery = filters.q?.toLowerCase().replaceAll(/[\s_()-]/g, '')
  let query = db
    .selectFrom('ZEXERCISEINFORMATION as ei')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .select([
      'ei.Z_PK as id', 'ei.ZNAME as name', 'ei.ZALTERNATIVEENGLISHNAMES as alternativeEnglishNames',
      'ei.ZISUSERCREATED as isUserCreated', 'ei.ZSOFTDELETED as softDeleted',
      'ei.ZMUSCLES as primaryMuscles', 'ei.ZSECONDARYMUSCLES as secondaryMuscles',
      'ei.ZDEFAULTPROGRESSMETRIC as defaultProgressMetric', 'ei.ZPERCEPTIONSCALE as perceptionScale',
      'ei.ZTIMERBASED as timerBased', 'ei.ZSUPPORTSONEREPMAX as supports1RM',
      'eq.ZNAME as equipment', 'eq.ZID as equipmentId',
    ])
    .where('ei.ZSOFTDELETED', 'is not', 1)

  if (filters.equipmentId !== undefined) query = query.where('eq.ZID', '=', filters.equipmentId)
  if (filters.muscle) {
    query = query.where((eb) => eb.or([
      eb('ei.ZMUSCLES', 'like', `%${filters.muscle}%`),
      eb('ei.ZSECONDARYMUSCLES', 'like', `%${filters.muscle}%`),
    ]))
  }

  if (normalizedQuery) {
    const qLike = `%${normalizedQuery}%`
    query = query.where((eb) => eb.or([
      sql<boolean>`lower(replace(replace(replace(replace(replace(coalesce(ei.ZNAME, ''), '_', ''), '-', ''), ' ', ''), '(', ''), ')', '')) like ${qLike}`,
      sql<boolean>`lower(replace(replace(replace(replace(replace(coalesce(ei.ZALTERNATIVEENGLISHNAMES, ''), '_', ''), '-', ''), ' ', ''), '(', ''), ')', '')) like ${qLike}`,
    ]))
  }

  const rows = await query.orderBy('ei.ZNAME', 'asc').orderBy('ei.Z_PK', 'asc').execute()
  return rows.map((row) => ({
    alternativeEnglishNames: splitLabels(row.alternativeEnglishNames, ';'),
    defaultProgressMetric: row.defaultProgressMetric,
    equipment: formatEquipmentDisplayName(row.equipment, row.equipmentId),
    equipmentId: row.equipmentId,
    id: row.id,
    isDeleted: asBool(row.softDeleted),
    isUserCreated: asBool(row.isUserCreated),
    name: row.name,
    perceptionScale: row.perceptionScale,
    primaryMuscles: muscleLabels(row.primaryMuscles),
    secondaryMuscles: muscleLabels(row.secondaryMuscles),
    supports1RM: asBool(row.supports1RM),
    timerBased: asBool(row.timerBased),
  }))
}

export async function getApiExerciseMetadata(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
): Promise<ApiExerciseMetadataRow | null> {
  const row = await db
    .selectFrom('ZEXERCISEINFORMATION as ei')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .select([
      'ei.Z_PK as id', 'ei.ZNAME as name', 'ei.ZALTERNATIVEENGLISHNAMES as alternativeEnglishNames',
      'ei.ZISUSERCREATED as isUserCreated', 'ei.ZSOFTDELETED as softDeleted',
      'ei.ZMUSCLES as primaryMuscles', 'ei.ZSECONDARYMUSCLES as secondaryMuscles',
      'ei.ZDEFAULTPROGRESSMETRIC as defaultProgressMetric', 'ei.ZPERCEPTIONSCALE as perceptionScale',
      'ei.ZTIMERBASED as timerBased', 'ei.ZSUPPORTSONEREPMAX as supports1RM',
      'eq.ZNAME as equipment', 'eq.ZID as equipmentId',
    ])
    .where('ei.Z_PK', '=', exerciseId)
    .executeTakeFirst()
  if (!row) return null
  return {
    alternativeEnglishNames: splitLabels(row.alternativeEnglishNames, ';'),
    defaultProgressMetric: row.defaultProgressMetric,
    equipment: formatEquipmentDisplayName(row.equipment, row.equipmentId),
    equipmentId: row.equipmentId,
    id: row.id,
    isDeleted: asBool(row.softDeleted),
    isUserCreated: asBool(row.isUserCreated),
    name: row.name,
    perceptionScale: row.perceptionScale,
    primaryMuscles: muscleLabels(row.primaryMuscles),
    secondaryMuscles: muscleLabels(row.secondaryMuscles),
    supports1RM: asBool(row.supports1RM),
    timerBased: asBool(row.timerBased),
  }
}

export async function getApiExercisePerformanceRows(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
  filters: ApiExercisePerformanceFilters,
): Promise<ApiExercisePerformanceRow[]> {
  const dateRange = dateRangeToAppleSeconds({from: filters.from, to: filters.to})
  let query = db
    .selectFrom('ZEXERCISERESULT as er')
    .innerJoin('ZWORKOUTRESULT as wr', 'wr.Z_PK', 'er.ZWORKOUT')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as per', 'per.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as pDirect', 'pDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as pFromPeriod', 'pFromPeriod.Z_PK', 'per.ZWORKOUTPLAN')
    .leftJoin('ZGYMSETRESULT as gs', 'gs.ZEXERCISE', 'er.Z_PK')
    .select([
      'er.Z_PK as id', 'wr.Z_PK as workoutId', 'wr.ZSTARTDATE as startDate',
      'r.Z_PK as routineId', 'wr.ZROUTINENAME as routineNameFromResult', 'r.ZNAME as routineNameFromPlan',
      'pDirect.Z_PK as programIdDirect', 'pFromPeriod.Z_PK as programIdFromPeriod',
      'pDirect.ZNAME as programNameDirect', 'pFromPeriod.ZNAME as programNameFromPeriod',
      workingSetCountExpr.as('setCount'), workingSetTotalRepsExpr.as('totalReps'),
      workingSetTopRepsExpr.as('topReps'), workingSetTopWeightExpr.as('topWeightKg'), workingSetVolumeExpr.as('volumeKg'),
    ])
    .where('er.ZEXERCISE', '=', exerciseId)
    .groupBy(['er.Z_PK', 'wr.Z_PK', 'wr.ZSTARTDATE', 'r.Z_PK', 'wr.ZROUTINENAME', 'r.ZNAME', 'pDirect.Z_PK', 'pFromPeriod.Z_PK', 'pDirect.ZNAME', 'pFromPeriod.ZNAME'])

  if (filters.programId !== undefined) query = query.where((eb) => eb.or([eb('r.ZWORKOUTPLAN', '=', filters.programId!), eb('per.ZWORKOUTPLAN', '=', filters.programId!)]))
  if (filters.routineId !== undefined) query = query.where('wr.ZROUTINE', '=', filters.routineId)
  if (dateRange.from !== undefined) query = query.where('wr.ZSTARTDATE', '>=', dateRange.from)
  if (dateRange.to !== undefined) query = query.where('wr.ZSTARTDATE', '<=', dateRange.to)
  if (filters.minReps !== undefined) query = query.having(workingSetTopRepsExpr, '>=', filters.minReps)
  if (filters.maxReps !== undefined) query = query.having(workingSetTopRepsExpr, '<=', filters.maxReps)
  if (filters.minWeightKg !== undefined) query = query.having(workingSetTopWeightExpr, '>=', filters.minWeightKg)
  if (filters.maxWeightKg !== undefined) query = query.having(workingSetTopWeightExpr, '<=', filters.maxWeightKg)

  const rows = await query.orderBy('wr.ZSTARTDATE', 'desc').orderBy('er.Z_PK', 'desc').execute()
  const ids = rows.map((row) => row.id)
  const setRows = ids.length === 0 ? [] : await db.selectFrom('ZGYMSETRESULT').select([
    'Z_PK as id', 'ZEXERCISE as performedExerciseId', 'ZREPS as reps', 'ZRPE as rpe', 'ZTIME as timeSeconds',
    'ZVOLUME as volumeKg', 'ZWEIGHT as weightKg', 'ZWARMUPSET as warmupSet',
  ]).where('ZEXERCISE', 'in', ids).orderBy('Z_FOK_EXERCISE', 'asc').orderBy('Z_PK', 'asc').execute()
  const setsByPerformance = new Map<number, ApiExercisePerformanceSetRow[]>()
  for (const set of setRows) {
    if (set.performedExerciseId === null) continue
    const sets = setsByPerformance.get(set.performedExerciseId) ?? []
    sets.push({id: set.id, isWarmup: asBool(set.warmupSet), reps: set.reps, rpe: normalizeRpe(set.rpe), timeSeconds: set.timeSeconds, volumeKg: set.volumeKg, weightKg: set.weightKg})
    setsByPerformance.set(set.performedExerciseId, sets)
  }

  return rows.map((row) => ({
    id: row.id,
    programId: row.programIdDirect ?? row.programIdFromPeriod,
    programName: row.programNameDirect ?? row.programNameFromPeriod,
    routineId: row.routineId,
    routineName: row.routineNameFromResult ?? row.routineNameFromPlan,
    sets: setsByPerformance.get(row.id) ?? [],
    startDate: row.startDate,
    statistics: {setCount: Number(row.setCount), topReps: row.topReps, topWeightKg: row.topWeightKg, totalReps: Number(row.totalReps), volumeKg: Number(row.volumeKg)},
    workoutId: row.workoutId,
  }))
}
