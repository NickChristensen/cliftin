import type {FastifyPluginAsyncTypebox} from '@fastify/type-provider-typebox'

import {HttpError, notFound} from '../http/errors.js'
import {paginateRows} from '../http/pagination.js'
import {formatExerciseDisplayName} from '../lib/names.js'
import {type ApiExercisePerformanceRow, getApiExerciseMetadata, getApiExercisePerformanceRows, listApiExerciseMetadata} from '../lib/repositories/exercises.js'
import {appleSecondsToUtcIso, dateRangeToAppleSeconds} from '../lib/time.js'
import {convertApiWeightToKg, convertKgToApiWeight} from '../lib/units.js'
import {EmptyObjectSchema} from '../schemas/common.js'
import {
  ExerciseIdParamsSchema,
  ExerciseListQuerySchema,
  ExercisePerformanceQuerySchema,
  ExerciseStatisticsQuerySchema,
  GetExerciseRouteSchema,
  GetExerciseStatisticsRouteSchema,
  ListExercisePerformancesRouteSchema,
  ListExercisesRouteSchema,
} from '../schemas/exercises.js'

type WeightUnit = 'kg' | 'lb'
type PerformanceSort = '-startedAt' | 'startedAt'
type PerformanceCursor = {id: number; sort: PerformanceSort; startedAt: null | string}

function validateDateFilters(from?: string, to?: string): void {
  try {
    dateRangeToAppleSeconds({from, to})
  } catch (error) {
    throw new HttpError(400, 'invalid-date-range', error instanceof Error ? error.message : 'Invalid date filter')
  }
}

function decodeCursor(value: string | undefined, sort: PerformanceSort): PerformanceCursor | undefined {
  if (!value) return undefined
  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof decoded !== 'object' || decoded === null || typeof (decoded as PerformanceCursor).id !== 'number' || !('startedAt' in decoded)) throw new Error('Malformed cursor')
    const {startedAt} = (decoded as PerformanceCursor)
    if (startedAt !== null && typeof startedAt !== 'string') throw new Error('Malformed cursor')
    if ((decoded as PerformanceCursor).sort !== sort) throw new Error('Malformed cursor')
    return decoded as PerformanceCursor
  } catch {
    throw new HttpError(400, 'invalid-cursor', 'Cursor is invalid')
  }
}

function toMetadata(row: NonNullable<Awaited<ReturnType<typeof getApiExerciseMetadata>>>) {
  return {
    ...row,
    name: formatExerciseDisplayName(row.name, row.isUserCreated),
  }
}

function toPerformance(row: ApiExercisePerformanceRow, exerciseId: number, unit: WeightUnit) {
  return {
    exerciseId,
    id: row.id,
    program: row.programId === null ? null : {id: row.programId, name: row.programName},
    routine: row.routineId === null ? null : {id: row.routineId, name: row.routineName},
    sets: row.sets.map((set) => ({
      id: set.id,
      isWarmup: set.isWarmup,
      reps: set.reps,
      rpe: set.rpe,
      timeSeconds: set.timeSeconds,
      volume: {unit, value: convertKgToApiWeight(set.volumeKg, unit)},
      weight: {unit, value: convertKgToApiWeight(set.weightKg, unit)},
    })),
    startedAt: appleSecondsToUtcIso(row.startDate),
    statistics: {
      setCount: row.statistics.setCount,
      topReps: row.statistics.topReps,
      topWeight: {unit, value: convertKgToApiWeight(row.statistics.topWeightKg, unit)},
      totalReps: row.statistics.totalReps,
      volume: {unit, value: convertKgToApiWeight(row.statistics.volumeKg, unit)},
    },
    workoutId: row.workoutId,
  }
}

function isAfterCursor(row: ApiExercisePerformanceRow, cursor: PerformanceCursor, descending: boolean): boolean {
  const startedAt = appleSecondsToUtcIso(row.startDate)
  if (startedAt === cursor.startedAt) return descending ? row.id < cursor.id : row.id > cursor.id
  if (startedAt === null) return !descending
  if (cursor.startedAt === null) return descending
  return descending ? startedAt < cursor.startedAt : startedAt > cursor.startedAt
}

function filteredRows(rows: ApiExercisePerformanceRow[], query: {cursor?: string; limit?: number; sort?: '-startedAt' | 'startedAt'}) {
  const sort = query.sort ?? '-startedAt'
  const descending = sort.startsWith('-')
  const cursor = decodeCursor(query.cursor, sort)
  rows.sort((a, b) => {
    const byTime = (appleSecondsToUtcIso(a.startDate) ?? '').localeCompare(appleSecondsToUtcIso(b.startDate) ?? '')
    return descending ? -byTime || b.id - a.id : byTime || a.id - b.id
  })
  const eligible = cursor ? rows.filter((row) => isAfterCursor(row, cursor, descending)) : rows
  const limit = query.limit ?? 50
  const page = eligible.slice(0, limit)
  const last = page.at(-1)
  return {
    nextCursor: eligible.length > limit && last ? Buffer.from(JSON.stringify({id: last.id, sort, startedAt: appleSecondsToUtcIso(last.startDate)})).toString('base64url') : undefined,
    page,
  }
}

export const exerciseRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/v1/exercises', {schema: {...ListExercisesRouteSchema, querystring: ExerciseListQuerySchema}}, async (request) => {
    const {cursor, limit, sort = 'name', ...filters} = request.query
    const rows = (await listApiExerciseMetadata(app.db.db, filters)).map((row) => toMetadata(row))
    return paginateRows(rows, {
      cursor,
      descending: sort.startsWith('-'),
      limit,
      sort,
      value: (exercise) => exercise.name,
    })
  })

  app.get('/v1/exercises/:exerciseId', {schema: {...GetExerciseRouteSchema, params: ExerciseIdParamsSchema, querystring: EmptyObjectSchema}}, async (request) => {
    const exercise = await getApiExerciseMetadata(app.db.db, request.params.exerciseId)
    if (!exercise) throw notFound('exercise-not-found', 'Exercise not found')
    return toMetadata(exercise)
  })

  app.get('/v1/exercises/:exerciseId/statistics', {schema: {...GetExerciseStatisticsRouteSchema, params: ExerciseIdParamsSchema, querystring: ExerciseStatisticsQuerySchema}}, async (request) => {
    const exercise = await getApiExerciseMetadata(app.db.db, request.params.exerciseId)
    if (!exercise) throw notFound('exercise-not-found', 'Exercise not found')
    validateDateFilters(request.query.from, request.query.to)
    const unit = request.query.unit ?? 'lb'
    const rows = await getApiExercisePerformanceRows(app.db.db, request.params.exerciseId, {
      ...request.query,
      maxWeightKg: request.query.maxWeight === undefined ? undefined : convertApiWeightToKg(request.query.maxWeight, unit),
      minWeightKg: request.query.minWeight === undefined ? undefined : convertApiWeightToKg(request.query.minWeight, unit),
    })
    let lastPerformedAt: null | string = null
    let setCount = 0
    let topReps: null | number = null
    let topWeightKg: null | number = null
    let totalReps = 0
    let volumeKg = 0
    const workoutIds = new Set<number>()
    for (const row of rows) {
      if (lastPerformedAt === null) lastPerformedAt = appleSecondsToUtcIso(row.startDate)
      setCount += row.statistics.setCount
      totalReps += row.statistics.totalReps
      volumeKg += row.statistics.volumeKg
      workoutIds.add(row.workoutId)
      if (row.statistics.topReps !== null && (topReps === null || row.statistics.topReps > topReps)) topReps = row.statistics.topReps
      if (row.statistics.topWeightKg !== null && (topWeightKg === null || row.statistics.topWeightKg > topWeightKg)) topWeightKg = row.statistics.topWeightKg
    }

    return {
      lastPerformedAt,
      performanceCount: rows.length,
      setCount,
      topReps,
      topWeight: {unit, value: convertKgToApiWeight(topWeightKg, unit)},
      totalReps,
      volume: {unit, value: convertKgToApiWeight(volumeKg, unit)},
      workoutCount: workoutIds.size,
    }
  })

  app.get('/v1/exercises/:exerciseId/performances', {schema: {...ListExercisePerformancesRouteSchema, params: ExerciseIdParamsSchema, querystring: ExercisePerformanceQuerySchema}}, async (request) => {
    const exercise = await getApiExerciseMetadata(app.db.db, request.params.exerciseId)
    if (!exercise) throw notFound('exercise-not-found', 'Exercise not found')
    validateDateFilters(request.query.from, request.query.to)
    const unit = request.query.unit ?? 'lb'
    const rows = await getApiExercisePerformanceRows(app.db.db, request.params.exerciseId, {
      ...request.query,
      maxWeightKg: request.query.maxWeight === undefined ? undefined : convertApiWeightToKg(request.query.maxWeight, unit),
      minWeightKg: request.query.minWeight === undefined ? undefined : convertApiWeightToKg(request.query.minWeight, unit),
    })
    const {nextCursor, page} = filteredRows(rows, request.query)
    const items = page.map((row) => toPerformance(row, request.params.exerciseId, unit))
    return nextCursor === undefined ? {items} : {items, nextCursor}
  })
}
