import type {FastifyPluginAsyncTypebox} from '@fastify/type-provider-typebox'

import {HttpError, notFound} from '../http/errors.js'
import {paginateRows} from '../http/pagination.js'
import {withDeferredReadTransaction} from '../lib/db.js'
import {formatExerciseDisplayName} from '../lib/names.js'
import {type ApiExercisePerformanceRow, getApiExerciseMetadata, getApiExercisePerformancePage, getApiExerciseStatistics, listApiExerciseMetadata} from '../lib/repositories/exercises.js'
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

function encodeCursor(row: ApiExercisePerformanceRow, sort: PerformanceSort): string {
  return Buffer.from(JSON.stringify({id: row.id, sort, startedAt: appleSecondsToUtcIso(row.startDate)})).toString('base64url')
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
    validateDateFilters(request.query.from, request.query.to)
    const unit = request.query.unit ?? 'lb'
    return withDeferredReadTransaction(app.db.db, async (db) => {
      const exercise = await getApiExerciseMetadata(db, request.params.exerciseId)
      if (!exercise) throw notFound('exercise-not-found', 'Exercise not found')
      const statistics = await getApiExerciseStatistics(db, request.params.exerciseId, {
        ...request.query,
        maxWeightKg: request.query.maxWeight === undefined ? undefined : convertApiWeightToKg(request.query.maxWeight, unit),
        minWeightKg: request.query.minWeight === undefined ? undefined : convertApiWeightToKg(request.query.minWeight, unit),
      })

      return {
        lastPerformedAt: appleSecondsToUtcIso(statistics.lastPerformedAt),
        performanceCount: statistics.performanceCount,
        setCount: statistics.setCount,
        topReps: statistics.topReps,
        topWeight: {unit, value: convertKgToApiWeight(statistics.topWeightKg, unit)},
        totalReps: statistics.totalReps,
        volume: {unit, value: convertKgToApiWeight(statistics.volumeKg, unit)},
        workoutCount: statistics.workoutCount,
      }
    })
  })

  app.get('/v1/exercises/:exerciseId/performances', {schema: {...ListExercisePerformancesRouteSchema, params: ExerciseIdParamsSchema, querystring: ExercisePerformanceQuerySchema}}, async (request) => {
    validateDateFilters(request.query.from, request.query.to)
    const unit = request.query.unit ?? 'lb'
    return withDeferredReadTransaction(app.db.db, async (db) => {
      const exercise = await getApiExerciseMetadata(db, request.params.exerciseId)
      if (!exercise) throw notFound('exercise-not-found', 'Exercise not found')
      const sort = request.query.sort ?? '-startedAt'
      const limit = request.query.limit ?? 50
      const cursor = decodeCursor(request.query.cursor, sort)
      const {hasMore, rows} = await getApiExercisePerformancePage(db, request.params.exerciseId, {
        ...request.query,
        maxWeightKg: request.query.maxWeight === undefined ? undefined : convertApiWeightToKg(request.query.maxWeight, unit),
        minWeightKg: request.query.minWeight === undefined ? undefined : convertApiWeightToKg(request.query.minWeight, unit),
      }, {
        cursor,
        descending: sort.startsWith('-'),
        limit,
      })
      const items = rows.map((row) => toPerformance(row, request.params.exerciseId, unit))
      const nextCursor = hasMore && rows.at(-1) ? encodeCursor(rows.at(-1)!, sort) : undefined
      return nextCursor === undefined ? {items} : {items, nextCursor}
    })
  })
}
