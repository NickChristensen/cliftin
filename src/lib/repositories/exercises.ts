import {Kysely, sql} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {formatEquipmentDisplayName, formatExerciseDisplayName, formatMuscleLabel} from '../names.js'
import {appleSecondsToIso, dateRangeToAppleSeconds} from '../time.js'
import {ExerciseDetail, ExerciseHistoryRow, ExerciseSummary, WorkoutDetail, WorkoutExerciseDetail} from '../types.js'
import {
  convertDisplayWeightToKg,
  convertKgToDisplayVolume,
  convertKgToDisplayWeight,
  resolveExerciseWeightUnit,
} from '../units.js'
import {resolveIdOrName} from './selectors.js'
import {getWorkoutDetail} from './workouts.js'

export type ExerciseListFilters = {
  equipment?: string
  muscle?: string
  name?: string
  sort?: 'lastPerformed' | 'name' | 'timesPerformed'
}

export type ExerciseHistoryFilters = {
  from?: string
  limit?: number
  maxReps?: number
  maxWeight?: number
  minReps?: number
  minWeight?: number
  program?: string
  routine?: string
  to?: string
}

export type ExerciseLastPerformedSnapshot = {
  exercise: WorkoutExerciseDetail
  workout: WorkoutDetail
}

function asBool(value: null | number): boolean {
  return value === 1
}

type ExerciseSelectorRow = {
  id: number
  isUserCreated: null | number
  name: null | string
}

function renderSelectorCandidateList(candidates: ExerciseSelectorRow[]): string {
  return candidates
    .map((candidate) => ({
      id: candidate.id,
      name: formatExerciseDisplayName(candidate.name, asBool(candidate.isUserCreated)),
    }))
    .map((candidate) => `${candidate.id}:${candidate.name}`)
    .join(', ')
}

export async function resolveExerciseSelector(db: Kysely<DatabaseSchema>, selector: string): Promise<number> {
  if (/^\d+$/.test(selector)) return Number(selector)

  const normalizedSelector = selector.toLowerCase().trim()
  const rows = await db
    .selectFrom('ZEXERCISEINFORMATION')
    .select(['Z_PK as id', 'ZISUSERCREATED as isUserCreated', 'ZNAME as name'])
    .where('ZSOFTDELETED', 'is not', 1)
    .execute()

  const exact = rows.filter((row) => {
    const rawName = (row.name ?? '').toLowerCase()
    const displayName = formatExerciseDisplayName(row.name, asBool(row.isUserCreated)).toLowerCase()
    return rawName === normalizedSelector || displayName === normalizedSelector
  })

  if (exact.length === 1) return exact[0].id
  if (exact.length > 1) {
    throw new Error(`Selector "${selector}" is ambiguous: ${renderSelectorCandidateList(exact)}`)
  }

  const partial = rows.filter((row) => {
    const rawName = (row.name ?? '').toLowerCase()
    const displayName = formatExerciseDisplayName(row.name, asBool(row.isUserCreated)).toLowerCase()
    return rawName.includes(normalizedSelector) || displayName.includes(normalizedSelector)
  })

  if (partial.length === 1) return partial[0].id
  if (partial.length > 1) {
    throw new Error(`Selector "${selector}" is ambiguous: ${renderSelectorCandidateList(partial)}`)
  }

  throw new Error(`No records found for selector: ${selector}`)
}

export async function listExercises(
  db: Kysely<DatabaseSchema>,
  filters: ExerciseListFilters,
): Promise<ExerciseSummary[]> {
  const nameLike = filters.name ? `%${filters.name}%` : undefined
  const normalizedNameLike = filters.name ? `%${filters.name.toLowerCase().replaceAll('_', ' ')}%` : undefined
  let query = db
    .selectFrom('ZEXERCISEINFORMATION as ei')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .leftJoin('ZEXERCISECONFIGURATION as ec', 'ec.ZINFORMATION', 'ei.Z_PK')
    .leftJoin('ZEXERCISERESULT as er', 'er.ZCONFIGURATION', 'ec.Z_PK')
    .leftJoin('ZWORKOUTRESULT as wr', 'wr.Z_PK', 'er.ZWORKOUT')
    .select([
      'ei.Z_PK as id',
      'ei.ZNAME as name',
      'ei.ZISUSERCREATED as isUserCreated',
      'ei.ZMUSCLES as primaryMuscles',
      'ei.ZSECONDARYMUSCLES as secondaryMuscles',
      'ei.ZTIMERBASED as timerBased',
      'ei.ZSUPPORTSONEREPMAX as supports1RM',
      'eq.ZNAME as equipment',
      'eq.ZID as equipmentId',
      (eb) => eb.fn.max('wr.ZSTARTDATE').as('lastPerformed'),
      (eb) => eb.fn.count('wr.Z_PK').distinct().as('timesPerformed'),
    ])
    .where('ei.ZSOFTDELETED', 'is not', 1)
    .groupBy(['ei.Z_PK', 'eq.ZNAME', 'eq.ZID'])
    .orderBy('ei.ZNAME', 'asc')

  if (nameLike && normalizedNameLike) {
    query = query.where((eb) =>
      eb.or([
        eb('ei.ZNAME', 'like', nameLike),
        sql<boolean>`lower(replace(ei.ZNAME, '_', ' ')) like ${normalizedNameLike}`,
      ]),
    )
  }

  if (filters.muscle) {
    query = query.where((eb) => eb.or([eb('ei.ZMUSCLES', 'like', `%${filters.muscle}%`), eb('ei.ZSECONDARYMUSCLES', 'like', `%${filters.muscle}%`)]))
  }

  if (filters.equipment) {
    query = query.where((eb) => eb.or([eb('eq.ZNAME', 'like', `%${filters.equipment}%`), eb('eq.ZID', 'like', `%${filters.equipment}%`)]))
  }

  const rows = await query.execute()

  const summaries = rows.map((row) => ({
    equipment: formatEquipmentDisplayName(row.equipment, row.equipmentId),
    id: row.id,
    lastPerformed: appleSecondsToIso(row.lastPerformed as null | number),
    name: formatExerciseDisplayName(row.name, asBool(row.isUserCreated)),
    primaryMuscles: formatMuscleLabel(row.primaryMuscles),
    secondaryMuscles: formatMuscleLabel(row.secondaryMuscles),
    supports1RM: asBool(row.supports1RM),
    timerBased: asBool(row.timerBased),
    timesPerformed: Number(row.timesPerformed),
  }))

  const sort = filters.sort ?? 'name'

  if (sort === 'timesPerformed') {
    summaries.sort((a, b) => b.timesPerformed - a.timesPerformed || a.id - b.id)
    return summaries
  }

  if (sort === 'lastPerformed') {
    summaries.sort((a, b) => {
      if (a.lastPerformed === b.lastPerformed) return a.id - b.id
      if (a.lastPerformed === null) return 1
      if (b.lastPerformed === null) return -1
      return b.lastPerformed.localeCompare(a.lastPerformed)
    })
    return summaries
  }

  summaries.sort((a, b) => {
    const aName = (a.name ?? '').toLowerCase()
    const bName = (b.name ?? '').toLowerCase()
    if (aName === bName) return a.id - b.id
    return aName.localeCompare(bName)
  })

  return summaries
}

export async function getExerciseHistoryRows(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
  filters: ExerciseHistoryFilters,
): Promise<ExerciseHistoryRow[]> {
  const unitPreference = await resolveExerciseWeightUnit(db, exerciseId)
  const dateRange = dateRangeToAppleSeconds({from: filters.from, to: filters.to})
  const minWeightKg = filters.minWeight === undefined ? undefined : convertDisplayWeightToKg(filters.minWeight, unitPreference)
  const maxWeightKg = filters.maxWeight === undefined ? undefined : convertDisplayWeightToKg(filters.maxWeight, unitPreference)

  let query = db
    .selectFrom('ZWORKOUTRESULT as wr')
    .innerJoin('ZEXERCISERESULT as er', 'er.ZWORKOUT', 'wr.Z_PK')
    .innerJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'er.ZCONFIGURATION')
    .innerJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'ec.ZINFORMATION')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as per', 'per.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as pDirect', 'pDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as pFromPeriod', 'pFromPeriod.Z_PK', 'per.ZWORKOUTPLAN')
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
    query = query.where((eb) => eb.or([eb('r.ZWORKOUTPLAN', '=', programId), eb('per.ZWORKOUTPLAN', '=', programId)]))
  }

  if (filters.routine) {
    const routineId = await resolveIdOrName(db, 'ZROUTINE', filters.routine)
    query = query.where('wr.ZROUTINE', '=', routineId)
  }

  if (dateRange.from !== undefined) query = query.where('wr.ZSTARTDATE', '>=', dateRange.from)
  if (dateRange.to !== undefined) query = query.where('wr.ZSTARTDATE', '<=', dateRange.to)
  if (filters.minReps !== undefined) query = query.having((eb) => eb.fn.max('gs.ZREPS'), '>=', filters.minReps)
  if (filters.maxReps !== undefined) query = query.having((eb) => eb.fn.max('gs.ZREPS'), '<=', filters.maxReps)
  if (minWeightKg !== undefined) query = query.having((eb) => eb.fn.max('gs.ZWEIGHT'), '>=', minWeightKg)
  if (maxWeightKg !== undefined) query = query.having((eb) => eb.fn.max('gs.ZWEIGHT'), '<=', maxWeightKg)
  if (filters.limit !== undefined) query = query.limit(filters.limit)

  const rows = await query.execute()

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

  return normalized
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
      'ei.ZISUSERCREATED as isUserCreated',
      'ei.ZMUSCLES as primaryMuscles',
      'ei.ZSECONDARYMUSCLES as secondaryMuscles',
      'ei.ZDEFAULTPROGRESSMETRIC as defaultProgressMetric',
      'ei.ZPERCEPTIONSCALE as perceptionScale',
      'ei.ZTIMERBASED as timerBased',
      'ei.ZSUPPORTSONEREPMAX as supports1RM',
      'eq.ZNAME as equipment',
      'eq.ZID as equipmentId',
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
    equipment: formatEquipmentDisplayName(row.equipment, row.equipmentId),
    id: row.id,
    lastHistoryEntry: latestHistory[0] ?? null,
    name: formatExerciseDisplayName(row.name, asBool(row.isUserCreated)),
    perceptionScale: row.perceptionScale,
    primaryMuscles: formatMuscleLabel(row.primaryMuscles),
    recentRoutines: routineRows.map((routine) => routine.routineName ?? '(unnamed)').slice(0, historyLimit),
    secondaryMuscles: formatMuscleLabel(row.secondaryMuscles),
    supports1RM: asBool(row.supports1RM),
    timerBased: asBool(row.timerBased),
    totalRoutines: routineRows.length,
    totalWorkouts: Number(workoutCountRow?.totalWorkouts ?? 0),
  }
}

export async function getLastPerformedExerciseSnapshot(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
): Promise<ExerciseLastPerformedSnapshot | null> {
  const latestHistory = await getExerciseHistoryRows(db, exerciseId, {limit: 1})
  const latest = latestHistory[0]
  if (!latest) return null

  const workout = await getWorkoutDetail(db, latest.workoutId)
  const exercise = workout.exercises.find((entry) => entry.exerciseId === exerciseId)
  if (!exercise) return null

  return {exercise, workout}
}
