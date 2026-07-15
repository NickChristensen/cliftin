import {Kysely, sql} from 'kysely'

import {notFound} from '../../http/errors.js'
import {DatabaseSchema} from '../db.js'
import {ApiRoutineDetail, ApiRoutineSummary, ApiWeightUnit} from '../types.js'
import {getActiveApiProgram, getApiProgram, getApiProgramPlan} from './programs.js'

export type ApiRoutineListFilters = {
  exerciseId?: number
  programId?: number
  q?: string
  sort?: '-name' | '-weekId' | 'name' | 'weekId'
  weekId?: number
}

export type ApiRoutineListRow = {
  id: number
  routine: ApiRoutineSummary
  sortKey: {
    routineOrder: null | number
    weekId: number
    weekOrder: null | number
  }
}

async function getWeekNumbers(db: Kysely<DatabaseSchema>, programIds: number[]): Promise<Map<number, number>> {
  if (programIds.length === 0) return new Map()

  const rows = await db
    .selectFrom('ZPERIOD')
    .select(['Z_PK as id', 'ZWORKOUTPLAN as programId'])
    .where('ZWORKOUTPLAN', 'in', programIds)
    .orderBy('ZWORKOUTPLAN', 'asc')
    .orderBy('Z_FOK_WORKOUTPLAN', 'asc')
    .orderBy('Z_PK', 'asc')
    .execute()

  const counts = new Map<number, number>()
  const numbers = new Map<number, number>()
  for (const row of rows) {
    if (row.programId === null) continue
    const number = (counts.get(row.programId) ?? 0) + 1
    counts.set(row.programId, number)
    numbers.set(row.id, number)
  }

  return numbers
}

export async function listApiRoutines(db: Kysely<DatabaseSchema>, filters: ApiRoutineListFilters = {}): Promise<ApiRoutineListRow[]> {
  let query = db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as planDirect', 'planDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as planFromPeriod', 'planFromPeriod.Z_PK', 'p.ZWORKOUTPLAN')
    .select([
      'r.Z_PK as id',
      'r.ZNAME as name',
      'r.ZSOFTDELETED as isDeleted',
      'r.ZUPNEXT as upNext',
      'p.Z_PK as weekId',
      'p.Z_FOK_WORKOUTPLAN as weekOrder',
      'r.Z_FOK_PERIOD as routineOrder',
      'planDirect.Z_PK as programIdDirect',
      'planFromPeriod.Z_PK as programIdFromPeriod',
      'planDirect.ZNAME as programNameDirect',
      'planFromPeriod.ZNAME as programNameFromPeriod',
    ])
    .where('r.ZSOFTDELETED', 'is not', 1)
    // Routine summaries require a week, so a routine linked only directly to a
    // program is intentionally excluded from this collection.
    .where('p.Z_PK', 'is not', null)
    .where((eb) => eb.or([eb('planDirect.ZSOFTDELETED', 'is not', 1), eb('planFromPeriod.ZSOFTDELETED', 'is not', 1)]))

  if (filters.programId !== undefined) {
    query = query.where((eb) => eb.or([eb('r.ZWORKOUTPLAN', '=', filters.programId!), eb('p.ZWORKOUTPLAN', '=', filters.programId!)]))
  }

  if (filters.weekId !== undefined) query = query.where('p.Z_PK', '=', filters.weekId)

  if (filters.q) {
    query = query.where(sql<boolean>`lower(r.ZNAME) like ${`%${filters.q.toLowerCase()}%`}`)
  }

  if (filters.exerciseId !== undefined) {
    query = query.where((eb) =>
      eb.exists(
        eb
          .selectFrom('Z_12ROUTINES as j')
          .innerJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'j.Z_12EXERCISES')
          .select(sql<number>`1`.as('matched'))
          .whereRef('j.Z_28ROUTINES', '=', 'r.Z_PK')
          .where('ec.ZINFORMATION', '=', filters.exerciseId!),
      ),
    )
  }

  switch (filters.sort ?? 'weekId') {
    case '-name': {
      query = query.orderBy(sql<number>`r.ZNAME is not null`, 'desc').orderBy('r.ZNAME', 'desc').orderBy('r.Z_PK', 'asc')
      break
    }

    case '-weekId': {
      query = query
        .orderBy(sql<number>`p.Z_FOK_WORKOUTPLAN is not null`, 'desc')
        .orderBy('p.Z_FOK_WORKOUTPLAN', 'desc')
        .orderBy('p.Z_PK', 'desc')
        .orderBy(sql<number>`r.Z_FOK_PERIOD is not null`, 'desc')
        .orderBy('r.Z_FOK_PERIOD', 'desc')
        .orderBy('r.Z_PK', 'desc')
      break
    }

    case 'name': {
      query = query.orderBy(sql<number>`r.ZNAME is not null`, 'asc').orderBy('r.ZNAME', 'asc').orderBy('r.Z_PK', 'asc')
      break
    }

    default: {
      query = query
        .orderBy(sql<number>`p.Z_FOK_WORKOUTPLAN is not null`, 'asc')
        .orderBy('p.Z_FOK_WORKOUTPLAN', 'asc')
        .orderBy('p.Z_PK', 'asc')
        .orderBy(sql<number>`r.Z_FOK_PERIOD is not null`, 'asc')
        .orderBy('r.Z_FOK_PERIOD', 'asc')
        .orderBy('r.Z_PK', 'asc')
    }
  }

  const rows = await query.execute()
  const programIds = [...new Set(rows.map((row) => row.programIdDirect ?? row.programIdFromPeriod).filter((id): id is number => id !== null))]
  const weekNumbers = await getWeekNumbers(db, programIds)

  return rows.flatMap((row) => {
    const programId = row.programIdDirect ?? row.programIdFromPeriod
    if (programId === null || row.weekId === null) return []

    return [{
      id: row.id,
      routine: {
        id: row.id,
        isDeleted: row.isDeleted === 1,
        isNext: row.upNext === 1,
        name: row.name,
        program: {id: programId, name: row.programNameDirect ?? row.programNameFromPeriod},
        week: {id: row.weekId, number: weekNumbers.get(row.weekId) ?? 1},
      },
      sortKey: {routineOrder: row.routineOrder, weekId: row.weekId, weekOrder: row.weekOrder},
    }]
  })
}

export async function getApiRoutineDetail(
  db: Kysely<DatabaseSchema>,
  routineId: number,
  unit: ApiWeightUnit,
): Promise<ApiRoutineDetail> {
  const row = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as planDirect', 'planDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as planFromPeriod', 'planFromPeriod.Z_PK', 'p.ZWORKOUTPLAN')
    .select([
      'r.Z_PK as id',
      'r.ZNAME as name',
      'r.ZSOFTDELETED as isDeleted',
      'r.ZUPNEXT as upNext',
      'p.Z_PK as weekId',
      'planDirect.Z_PK as programIdDirect',
      'planFromPeriod.Z_PK as programIdFromPeriod',
    ])
    .where('r.Z_PK', '=', routineId)
    .executeTakeFirst()

  if (!row) throw notFound('routine-not-found', `Routine not found: ${routineId}`)

  const programId = row.programIdDirect ?? row.programIdFromPeriod
  if (programId === null || row.weekId === null) throw notFound('routine-not-found', `Routine not found: ${routineId}`)

  const [program, plan, weekNumbers] = await Promise.all([
    getApiProgram(db, programId),
    getApiProgramPlan(db, programId, unit, {includeDeletedRoutines: true}),
    getWeekNumbers(db, [programId]),
  ])
  const week = plan.weeks.find((entry) => entry.id === row.weekId)
  const routine = week?.routines.find((entry) => entry.id === routineId)
  if (!routine) throw new Error(`Routine ${routineId} has no planned exercise configuration.`)

  return {
    exercises: routine.exercises,
    id: row.id,
    isDeleted: row.isDeleted === 1,
    isNext: row.upNext === 1,
    name: row.name,
    program: {id: program.id, name: program.name},
    week: {id: row.weekId, number: weekNumbers.get(row.weekId) ?? 1},
  }
}

export async function getActiveApiNextRoutine(db: Kysely<DatabaseSchema>, unit: ApiWeightUnit): Promise<ApiRoutineDetail> {
  const activeProgram = await getActiveApiProgram(db)
  const rows = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .select('r.Z_PK as id')
    .where('r.ZUPNEXT', '=', 1)
    .where('r.ZSOFTDELETED', 'is not', 1)
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', activeProgram.id), eb('r.ZWORKOUTPLAN', '=', activeProgram.id)]))
    .orderBy('p.Z_FOK_WORKOUTPLAN', 'asc')
    .orderBy('r.Z_FOK_PERIOD', 'asc')
    .orderBy('r.Z_PK', 'asc')
    .execute()

  if (rows.length === 0) throw notFound('next-routine-not-found', `No up-next routine found for active program ${activeProgram.name ?? activeProgram.id}.`)
  if (rows.length > 1) throw new Error(`Expected exactly one up-next routine for active program ${activeProgram.name ?? activeProgram.id}. Found ${rows.length}.`)
  return getApiRoutineDetail(db, rows[0].id, unit)
}
