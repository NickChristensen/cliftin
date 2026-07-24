import {Kysely, sql} from 'kysely'

import {notFound} from '../../http/errors.js'
import {DatabaseSchema} from '../db.js'
import {formatExerciseDisplayName} from '../names.js'
import {normalizeRpe} from '../rpe.js'
import {appleSecondsToUtcIso} from '../time.js'
import {normalizeTimerBasedSet} from '../timer-based.js'
import {ApiPlannedExercise, ApiProgram, ApiProgramPlan, ApiWeightUnit} from '../types.js'
import {convertKgToApiWeight} from '../units.js'

function asBool(value: null | number): boolean {
  return value === 1
}

function apiWeight(value: null | number, unit: ApiWeightUnit): {unit: ApiWeightUnit; value: null | number} {
  return {unit, value: convertKgToApiWeight(value, unit)}
}

type ApiPlannedSetSource = {
  id: null | number
  reps: null | number
  rpe: null | number
  timeSeconds: null | number
  weight: {unit: ApiWeightUnit; value: null | number}
}

function capApiIndividualSets(sets: ApiPlannedSetSource[], plannedSets: null | number): ApiPlannedSetSource[] {
  return plannedSets !== null && plannedSets > 0 ? sets.slice(0, plannedSets) : sets
}

async function getSelectedProgramId(db: Kysely<DatabaseSchema>): Promise<null | number> {
  const selectedProgram = await db
    .selectFrom('ZWORKOUTPROGRAMSINFO as info')
    .innerJoin('ZWORKOUTPLAN as plan', 'plan.ZID', 'info.ZSELECTEDWORKOUTPROGRAMID')
    .select('plan.Z_PK as id')
    .where('info.ZSELECTEDWORKOUTPROGRAMID', 'is not', null)
    .executeTakeFirst()

  return selectedProgram?.id ?? null
}

function toApiProgram(
  row: {dateAdded: null | number; id: number; isCurrent: null | number; isDeleted: null | number; isTemplate: null | number; name: null | string},
  selectedProgramId: null | number,
): ApiProgram {
  return {
    dateAdded: appleSecondsToUtcIso(row.dateAdded),
    id: row.id,
    isActive: selectedProgramId === null ? asBool(row.isCurrent) : row.id === selectedProgramId,
    isDeleted: asBool(row.isDeleted),
    isTemplate: asBool(row.isTemplate),
    name: row.name,
  }
}

export type ApiProgramListFilters = {
  q?: string
  sort?: '-dateAdded' | '-name' | 'dateAdded' | 'name'
}

export async function listApiPrograms(db: Kysely<DatabaseSchema>, filters: ApiProgramListFilters = {}): Promise<ApiProgram[]> {
  const selectedProgramId = await getSelectedProgramId(db)
  let query = db
    .selectFrom('ZWORKOUTPLAN')
    .select([
      'Z_PK as id',
      'ZNAME as name',
      'ZISCURRENT as isCurrent',
      'ZISTEMPLATE as isTemplate',
      'ZSOFTDELETED as isDeleted',
      'ZDATEADDED as dateAdded',
    ])
    .where('ZSOFTDELETED', 'is not', 1)

  if (filters.q) {
    const q = `%${filters.q.toLowerCase()}%`
    query = query.where(sql<boolean>`lower(ZNAME) like ${q}`)
  }

  switch (filters.sort ?? '-dateAdded') {
    case '-name': {
      query = query.orderBy('ZNAME', 'desc').orderBy('Z_PK', 'asc')
      break
    }

    case 'dateAdded': {
      query = query.orderBy('ZDATEADDED', 'asc').orderBy('Z_PK', 'asc')
      break
    }

    case 'name': {
      query = query.orderBy('ZNAME', 'asc').orderBy('Z_PK', 'asc')
      break
    }

    default: {
      query = query.orderBy('ZDATEADDED', 'desc').orderBy('Z_PK', 'asc')
    }
  }

  return (await query.execute()).map((row) => toApiProgram(row, selectedProgramId))
}

export async function getApiProgram(db: Kysely<DatabaseSchema>, programId: number): Promise<ApiProgram> {
  const [selectedProgramId, row] = await Promise.all([
    getSelectedProgramId(db),
    db
      .selectFrom('ZWORKOUTPLAN')
      .select([
        'Z_PK as id',
        'ZNAME as name',
        'ZISCURRENT as isCurrent',
        'ZISTEMPLATE as isTemplate',
        'ZSOFTDELETED as isDeleted',
        'ZDATEADDED as dateAdded',
      ])
      .where('Z_PK', '=', programId)
      .executeTakeFirst(),
  ])

  if (!row) throw notFound('program-not-found', `Program not found: ${programId}`)
  return toApiProgram(row, selectedProgramId)
}

export async function getActiveApiProgram(db: Kysely<DatabaseSchema>): Promise<ApiProgram> {
  const selectedProgramId = await getSelectedProgramId(db)
  if (selectedProgramId !== null) return getApiProgram(db, selectedProgramId)

  const rows = await db
    .selectFrom('ZWORKOUTPLAN')
    .select('Z_PK as id')
    .where('ZISCURRENT', '=', 1)
    .where('ZSOFTDELETED', 'is not', 1)
    .execute()

  if (rows.length === 0) throw notFound('active-program-not-found', 'No active program found.')
  if (rows.length > 1) throw new Error(`Expected exactly one active program. Found ${rows.length}.`)
  return getApiProgram(db, rows[0].id)
}

export async function getApiProgramPlan(
  db: Kysely<DatabaseSchema>,
  programId: number,
  unit: ApiWeightUnit,
  options: {includeDeletedRoutines?: boolean} = {},
): Promise<ApiProgramPlan> {
  await getApiProgram(db, programId)

  const weeks = await db
    .selectFrom('ZPERIOD')
    .select(['Z_PK as id'])
    .where('ZWORKOUTPLAN', '=', programId)
    .orderBy('Z_FOK_WORKOUTPLAN', 'asc')
    .orderBy('Z_PK', 'asc')
    .execute()

  let routinesQuery = db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .select(['r.Z_PK as id', 'r.ZNAME as name', 'r.ZPERIOD as weekId'])
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', programId), eb('r.ZWORKOUTPLAN', '=', programId)]))
    .orderBy('r.Z_FOK_PERIOD', 'asc')
    .orderBy('r.Z_PK', 'asc')

  if (!options.includeDeletedRoutines) routinesQuery = routinesQuery.where('r.ZSOFTDELETED', 'is not', 1)
  const routines = await routinesQuery.execute()

  let exercisesQuery = db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('Z_12ROUTINES as j', 'j.Z_28ROUTINES', 'r.Z_PK')
    .leftJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'j.Z_12EXERCISES')
    .leftJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'ec.ZINFORMATION')
    .select([
      'r.Z_PK as routineId',
      'ec.Z_PK as exerciseConfigId',
      'j.Z_FOK_12EXERCISES as routineExerciseOrder',
      'ec.ZSETS as plannedSets',
      'ec.ZREPS as plannedReps',
      'ec.ZWEIGHT as plannedWeight',
      'ec.ZTIME as plannedTimeSeconds',
      'ec.ZUSEINDIVIDUALSETS as useIndividualSets',
      'ec.ZINFORMATION as exerciseId',
      'ei.ZISUSERCREATED as isUserCreated',
      'ei.ZNAME as exerciseName',
      'ei.ZTIMERBASED as timerBased',
    ])
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', programId), eb('r.ZWORKOUTPLAN', '=', programId)]))
    .where('ec.Z_PK', 'is not', null)
    .orderBy('r.Z_PK', 'asc')
    .orderBy('j.Z_FOK_12EXERCISES', 'asc')
    .orderBy('ec.Z_PK', 'asc')

  if (!options.includeDeletedRoutines) exercisesQuery = exercisesQuery.where('r.ZSOFTDELETED', 'is not', 1)
  const exercises = await exercisesQuery.execute()

  const exerciseConfigIds = exercises
    .map((exercise) => exercise.exerciseConfigId)
    .filter((value): value is number => value !== null)

  const setRows =
    exerciseConfigIds.length === 0
      ? []
      : await db
          .selectFrom('ZSETCONFIGURATION')
          .select([
            'Z_PK as id',
            'ZEXERCISECONFIGURATION as exerciseConfigId',
            'ZREPS as reps',
            'ZRPE as rpe',
            'ZWEIGHT as weight',
            'ZTIME as timeSeconds',
          ])
          .where('ZEXERCISECONFIGURATION', 'in', exerciseConfigIds)
          .orderBy('ZEXERCISECONFIGURATION', 'asc')
          .orderBy('ZSETINDEX', 'asc')
          .execute()

  const setsByExerciseConfig = new Map<number, ApiPlannedSetSource[]>()
  for (const row of setRows) {
    if (row.exerciseConfigId === null) continue
    const sets = setsByExerciseConfig.get(row.exerciseConfigId) ?? []
    sets.push({
      id: row.id,
      reps: row.reps,
      rpe: normalizeRpe(row.rpe),
      timeSeconds: row.timeSeconds,
      weight: apiWeight(row.weight, unit),
    })
    setsByExerciseConfig.set(row.exerciseConfigId, sets)
  }

  const exercisesByRoutine = new Map<number, ApiPlannedExercise[]>()
  for (const row of exercises) {
    if (row.exerciseConfigId === null) continue
    const timerBased = asBool(row.timerBased)
    const explicitSets = setsByExerciseConfig.get(row.exerciseConfigId) ?? []
    const fallbackSets = Array.from({length: Math.max(row.plannedSets ?? 1, 1)}, () => ({
      id: null,
      reps: row.plannedReps,
      rpe: null,
      timeSeconds: row.plannedTimeSeconds,
      weight: apiWeight(row.plannedWeight, unit),
    }))
    const sourceSets = row.useIndividualSets === 1 ? capApiIndividualSets(explicitSets, row.plannedSets) : fallbackSets
    const routineExercises = exercisesByRoutine.get(row.routineId) ?? []
    const base = {
      exerciseId: row.exerciseId,
      id: row.exerciseConfigId,
      name: formatExerciseDisplayName(row.exerciseName, asBool(row.isUserCreated)),
    }
    if (timerBased) {
      routineExercises.push({
        ...base,
        sets: sourceSets.map((set) => ({...set, ...normalizeTimerBasedSet(true, set, `planned set for exercise configuration ${row.exerciseConfigId}`)})),
        timerBased: true,
      })
    } else {
      routineExercises.push({
        ...base,
        sets: sourceSets.map((set) => ({...set, ...normalizeTimerBasedSet(false, set, `planned set for exercise configuration ${row.exerciseConfigId}`)})),
        timerBased: false,
      })
    }
    exercisesByRoutine.set(row.routineId, routineExercises)
  }

  const routinesByWeek = new Map<number, ApiProgramPlan['weeks'][number]['routines']>()
  for (const routine of routines) {
    if (routine.weekId === null) continue
    const weekRoutines = routinesByWeek.get(routine.weekId) ?? []
    weekRoutines.push({
      exercises: exercisesByRoutine.get(routine.id) ?? [],
      id: routine.id,
      name: routine.name,
    })
    routinesByWeek.set(routine.weekId, weekRoutines)
  }

  return {
    weeks: weeks.map((week) => ({id: week.id, routines: routinesByWeek.get(week.id) ?? []})),
  }
}
