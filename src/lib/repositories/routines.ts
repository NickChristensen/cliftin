import {Kysely, sql} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {appleSecondsToIso} from '../time.js'
import {RoutineDetail, RoutineSummary, WorkoutSummary} from '../types.js'
import {getProgramDetail, resolveProgramSelector} from './programs.js'
import {resolveIdOrName} from './selectors.js'

export type RoutineFilters = {
  name?: string
  program?: string
  week?: number
}

async function getRoutinePlanContext(
  db: Kysely<DatabaseSchema>,
  routineId: number,
): Promise<{programId: number; weekId: number}> {
  const row = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as planDirect', 'planDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as planFromPeriod', 'planFromPeriod.Z_PK', 'p.ZWORKOUTPLAN')
    .select([
      'r.Z_PK as id',
      'p.Z_PK as weekId',
      'planDirect.Z_PK as programIdDirect',
      'planFromPeriod.Z_PK as programIdFromPeriod',
    ])
    .where('r.Z_PK', '=', routineId)
    .where('r.ZSOFTDELETED', 'is not', 1)
    .where((eb) => eb.or([eb('planDirect.ZSOFTDELETED', 'is not', 1), eb('planFromPeriod.ZSOFTDELETED', 'is not', 1)]))
    .executeTakeFirst()

  if (!row) throw new Error(`Routine not found: ${routineId}`)

  const programId = row.programIdDirect ?? row.programIdFromPeriod
  if (programId === null) throw new Error(`Routine ${routineId} is not linked to a program.`)
  if (row.weekId === null) throw new Error(`Routine ${routineId} is not linked to a week.`)

  return {programId, weekId: row.weekId}
}

async function getRoutineDetailById(
  db: Kysely<DatabaseSchema>,
  routineId: number,
  workout: null | WorkoutSummary,
): Promise<RoutineDetail> {
  const context = await getRoutinePlanContext(db, routineId)
  const programDetail = await getProgramDetail(db, context.programId)
  const weekIndex = programDetail.weeks.findIndex((week) => week.id === context.weekId)

  if (weekIndex === -1) {
    throw new Error(`Routine ${routineId} is linked to unknown week ${context.weekId}.`)
  }

  const week = programDetail.weeks[weekIndex]
  const routine = week.routines.find((entry) => entry.id === routineId)

  if (!routine) {
    throw new Error(`Routine ${routineId} was not found in program ${programDetail.program.name}.`)
  }

  return {
    program: programDetail.program,
    routine,
    week: {
      id: week.id,
      number: weekIndex + 1,
    },
    workout,
  }
}

export async function listRoutines(db: Kysely<DatabaseSchema>, filters: RoutineFilters): Promise<RoutineSummary[]> {
  let query = db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as planDirect', 'planDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as planFromPeriod', 'planFromPeriod.Z_PK', 'p.ZWORKOUTPLAN')
    .select([
      'r.Z_PK as id',
      'r.ZNAME as name',
      'r.ZUPNEXT as upNext',
      'p.Z_PK as weekId',
      'planDirect.Z_PK as programIdDirect',
      'planFromPeriod.Z_PK as programIdFromPeriod',
      'planDirect.ZNAME as programNameDirect',
      'planFromPeriod.ZNAME as programNameFromPeriod',
    ])
    .where('r.ZSOFTDELETED', 'is not', 1)
    .where((eb) => eb.or([eb('planDirect.ZSOFTDELETED', 'is not', 1), eb('planFromPeriod.ZSOFTDELETED', 'is not', 1)]))

  if (filters.program) {
    const programId = await resolveProgramSelector(db, filters.program, false)
    query = query.where((eb) => eb.or([eb('r.ZWORKOUTPLAN', '=', programId), eb('p.ZWORKOUTPLAN', '=', programId)]))
  }

  if (filters.name) {
    const lowered = `%${filters.name.toLowerCase()}%`
    query = query.where(sql<boolean>`lower(r.ZNAME) like ${lowered}`)
  }

  query = query.orderBy('planFromPeriod.ZDATEADDED', 'desc').orderBy('planDirect.ZDATEADDED', 'desc').orderBy('p.Z_FOK_WORKOUTPLAN', 'asc').orderBy('r.Z_FOK_PERIOD', 'asc').orderBy('r.Z_PK', 'asc')

  const rows = await query.execute()
  const weekNumbers = new Map<number, number>()
  const countsByProgram = new Map<number, number>()

  for (const row of rows) {
    const programId = row.programIdDirect ?? row.programIdFromPeriod
    if (programId === null || row.weekId === null) continue
    const key = row.weekId
    if (!weekNumbers.has(key)) {
      const count = (countsByProgram.get(programId) ?? 0) + 1
      countsByProgram.set(programId, count)
      weekNumbers.set(key, count)
    }
  }

  return rows
    .map((row) => ({
      id: row.id,
      isNext: row.upNext === 1,
      name: row.name,
      program: row.programNameDirect ?? row.programNameFromPeriod,
      week: row.weekId === null ? null : weekNumbers.get(row.weekId) ?? null,
    }))
    .filter((row) => (filters.week === undefined ? true : row.week === filters.week))
}

export async function getRoutineDetail(db: Kysely<DatabaseSchema>, selector: string): Promise<RoutineDetail> {
  const routineId = await resolveIdOrName(db, 'ZROUTINE', selector)
  return getRoutineDetailById(db, routineId, null)
}

export async function getNextRoutineDetail(db: Kysely<DatabaseSchema>): Promise<RoutineDetail> {
  const programId = await resolveProgramSelector(db, undefined, true)

  const nextRoutines = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .select(['r.Z_PK as id'])
    .where('r.ZUPNEXT', '=', 1)
    .where('r.ZSOFTDELETED', 'is not', 1)
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', programId), eb('r.ZWORKOUTPLAN', '=', programId)]))
    .orderBy('p.Z_FOK_WORKOUTPLAN', 'asc')
    .orderBy('r.Z_FOK_PERIOD', 'asc')
    .orderBy('r.Z_PK', 'asc')
    .execute()

  if (nextRoutines.length === 0) {
    const programDetail = await getProgramDetail(db, programId)
    throw new Error(`No up-next routine found for active program ${programDetail.program.name}.`)
  }

  if (nextRoutines.length > 1) {
    const programDetail = await getProgramDetail(db, programId)
    throw new Error(`Expected exactly one up-next routine for active program ${programDetail.program.name}. Found ${nextRoutines.length}.`)
  }

  return getRoutineDetailById(db, nextRoutines[0].id, null)
}

export async function getRoutineDetailFromWorkout(db: Kysely<DatabaseSchema>, workoutId: number): Promise<RoutineDetail> {
  const workout = await db
    .selectFrom('ZWORKOUTRESULT as wr')
    .leftJoin('ZROUTINE as r', 'r.Z_PK', 'wr.ZROUTINE')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('ZWORKOUTPLAN as planDirect', 'planDirect.Z_PK', 'r.ZWORKOUTPLAN')
    .leftJoin('ZWORKOUTPLAN as planFromPeriod', 'planFromPeriod.Z_PK', 'p.ZWORKOUTPLAN')
    .select([
      'wr.Z_PK as id',
      'wr.ZDURATION as duration',
      'wr.ZSTARTDATE as startDate',
      'wr.ZROUTINE as routineId',
      'wr.ZROUTINENAME as routineNameFromResult',
      'r.ZNAME as routineNameFromPlan',
      'planDirect.ZNAME as programNameDirect',
      'planFromPeriod.ZNAME as programNameFromPeriod',
    ])
    .where('wr.Z_PK', '=', workoutId)
    .executeTakeFirst()

  if (!workout) throw new Error(`Workout not found: ${workoutId}`)
  if (workout.routineId === null) throw new Error(`Workout ${workoutId} is not linked to a planned routine.`)

  return getRoutineDetailById(db, workout.routineId, {
    date: appleSecondsToIso(workout.startDate),
    duration: workout.duration,
    id: workout.id,
    program: workout.programNameDirect ?? workout.programNameFromPeriod,
    routine: workout.routineNameFromResult ?? workout.routineNameFromPlan,
  })
}

export async function getLatestRoutineDetail(db: Kysely<DatabaseSchema>): Promise<RoutineDetail> {
  const latestWorkout = await db
    .selectFrom('ZWORKOUTRESULT')
    .select('Z_PK as id')
    .orderBy('ZSTARTDATE', 'desc')
    .limit(1)
    .executeTakeFirst()

  if (!latestWorkout) throw new Error('No workouts found.')
  return getRoutineDetailFromWorkout(db, latestWorkout.id)
}
