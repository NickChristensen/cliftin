import type {FastifyPluginAsyncTypebox} from '@fastify/type-provider-typebox'

import {HttpError, notFound} from '../http/errors.js'
import {withDeferredReadTransaction} from '../lib/db.js'
import {formatExerciseDisplayName} from '../lib/names.js'
import {type ApiWorkoutDetailRow, type ApiWorkoutListRow, getApiWorkoutDetail, listApiWorkouts} from '../lib/repositories/workouts.js'
import {appleSecondsToUtcIso, dateRangeToAppleSeconds} from '../lib/time.js'
import {convertKgToApiWeight} from '../lib/units.js'
import {EmptyObjectSchema} from '../schemas/common.js'
import {
  GetLatestWorkoutRouteSchema,
  GetWorkoutRouteSchema,
  GetWorkoutRoutineRouteSchema,
  ListWorkoutsRouteSchema,
  WorkoutDetailQuerySchema,
  WorkoutIdParamsSchema,
  WorkoutListQuerySchema,
} from '../schemas/workouts.js'

type WeightUnit = 'kg' | 'lb'
type WorkoutSort = '-startedAt' | 'startedAt'
type WorkoutCursor = {id: number; sort: WorkoutSort; startedAt: null | string}

function validateDateFilters(from?: string, to?: string): void {
  try {
    dateRangeToAppleSeconds({from, to})
  } catch (error) {
    throw new HttpError(400, 'invalid-date-range', error instanceof Error ? error.message : 'Invalid date filter')
  }
}

function decodeCursor(value: string | undefined, sort: WorkoutSort): undefined | WorkoutCursor {
  if (!value) return undefined
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (
      typeof decoded !== 'object' || decoded === null ||
      typeof (decoded as WorkoutCursor).id !== 'number' ||
      (decoded as WorkoutCursor).sort !== sort ||
      !('startedAt' in decoded) ||
      ((decoded as WorkoutCursor).startedAt !== null && typeof (decoded as WorkoutCursor).startedAt !== 'string')
    ) throw new Error('Malformed cursor')
    return decoded as WorkoutCursor
  } catch {
    throw new HttpError(400, 'invalid-cursor', 'Cursor is invalid')
  }
}

function encodeCursor(row: ApiWorkoutListRow, sort: WorkoutSort): string {
  return Buffer.from(JSON.stringify({id: row.id, sort, startedAt: appleSecondsToUtcIso(row.startDate)})).toString('base64url')
}

function isAfterCursor(row: ApiWorkoutListRow, cursor: WorkoutCursor, descending: boolean): boolean {
  const startedAt = appleSecondsToUtcIso(row.startDate)
  if (startedAt === cursor.startedAt) return descending ? row.id < cursor.id : row.id > cursor.id
  if (descending) {
    if (cursor.startedAt === null) return false
    if (startedAt === null) return true
    return startedAt < cursor.startedAt
  }
  if (cursor.startedAt === null) return true
  if (startedAt === null) return false
  return startedAt > cursor.startedAt
}

function reference(id: null | number, name: null | string): null | {id: number; name: null | string} {
  return id === null ? null : {id, name}
}

function toWorkoutSummary(row: ApiWorkoutListRow) {
  return {
    durationSeconds: row.durationSeconds,
    id: row.id,
    program: reference(row.programId, row.programName),
    routine: reference(row.routineId, row.routineName),
    startedAt: appleSecondsToUtcIso(row.startDate),
  }
}

function toWorkoutDetail(row: ApiWorkoutDetailRow, unit: WeightUnit) {
  return {
    ...toWorkoutSummary(row),
    exercises: row.exercises.map((exercise) => {
      const base = {exerciseId: exercise.exerciseId, id: exercise.id, name: formatExerciseDisplayName(exercise.name, exercise.isUserCreated)}
      if (exercise.timerBased) return {...base, sets: exercise.sets.map((set) => ({id: set.id, isWarmup: set.isWarmup, reps: null, rpe: set.rpe, timeSeconds: set.timeSeconds!, volume: {unit, value: convertKgToApiWeight(set.volumeKg, unit)}, weight: {unit, value: convertKgToApiWeight(set.weightKg, unit)}})), timerBased: true as const}
      return {...base, sets: exercise.sets.map((set) => ({id: set.id, isWarmup: set.isWarmup, reps: set.reps, rpe: set.rpe, timeSeconds: null, volume: {unit, value: convertKgToApiWeight(set.volumeKg, unit)}, weight: {unit, value: convertKgToApiWeight(set.weightKg, unit)}})), timerBased: false as const}
    }),
  }
}

export const workoutRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/v1/workouts', {schema: {...ListWorkoutsRouteSchema, querystring: WorkoutListQuerySchema}}, async (request) => {
    const {cursor, from, limit = 50, programId, routineId, sort = '-startedAt', to} = request.query
    validateDateFilters(from, to)
    const descending = sort.startsWith('-')
    const cursorValue = decodeCursor(cursor, sort)
    const rows = await listApiWorkouts(app.db.db, {from, programId, routineId, to})
    rows.sort((a, b) => {
      const aTime = appleSecondsToUtcIso(a.startDate) ?? ''
      const bTime = appleSecondsToUtcIso(b.startDate) ?? ''
      const byTime = aTime.localeCompare(bTime)
      return descending ? -byTime || b.id - a.id : byTime || a.id - b.id
    })
    const eligible = cursorValue ? rows.filter((row) => isAfterCursor(row, cursorValue, descending)) : rows
    const page = eligible.slice(0, limit)
    const next = eligible.length > limit ? encodeCursor(page.at(-1)!, sort) : undefined
    const items = page.map((row) => toWorkoutSummary(row))
    return next === undefined ? {items} : {items, nextCursor: next}
  })

  app.get('/v1/workouts/latest', {schema: {...GetLatestWorkoutRouteSchema, querystring: WorkoutDetailQuerySchema}}, async (request) => {
    return withDeferredReadTransaction(app.db.db, async (db) => {
      const latest = (await listApiWorkouts(db, {limit: 1}))[0]
      if (!latest) throw notFound('workout-not-found', 'Workout not found')
      const workout = await getApiWorkoutDetail(db, latest.id)
      if (!workout) throw notFound('workout-not-found', 'Workout not found')
      return toWorkoutDetail(workout, request.query.unit ?? 'lb')
    })
  })

  app.get('/v1/workouts/:workoutId', {schema: {...GetWorkoutRouteSchema, params: WorkoutIdParamsSchema, querystring: WorkoutDetailQuerySchema}}, async (request) => {
    return withDeferredReadTransaction(app.db.db, async (db) => {
      const workout = await getApiWorkoutDetail(db, request.params.workoutId)
      if (!workout) throw notFound('workout-not-found', 'Workout not found')
      return toWorkoutDetail(workout, request.query.unit ?? 'lb')
    })
  })

  app.get('/v1/workouts/:workoutId/routine', {schema: {...GetWorkoutRoutineRouteSchema, params: WorkoutIdParamsSchema, querystring: EmptyObjectSchema}}, async (request) => {
    return withDeferredReadTransaction(app.db.db, async (db) => {
      const workout = await getApiWorkoutDetail(db, request.params.workoutId)
      if (!workout) throw notFound('workout-not-found', 'Workout not found')
      if (workout.routineId === null) throw notFound('routine-not-found', 'Routine not found for workout')
      return {id: workout.routineId, name: workout.routineName}
    })
  })
}
