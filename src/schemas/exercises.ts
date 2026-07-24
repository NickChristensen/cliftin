import {Type} from '@fastify/type-provider-typebox'

import {ErrorResponseSchema} from './common.js'
import {ApiWeightSchema, WeightUnitSchema, WorkoutReferenceSchema} from './workouts.js'

const NullableNumberSchema = Type.Union([Type.Number(), Type.Null()])
const NullableStringSchema = Type.Union([Type.String(), Type.Null()])

export const ExerciseSchema = Type.Object(
  {
    alternativeEnglishNames: Type.Array(Type.String()),
    defaultProgressMetric: NullableStringSchema,
    equipment: NullableStringSchema,
    equipmentId: NullableStringSchema,
    id: Type.Integer({examples: [1000], minimum: 1}),
    isDeleted: Type.Boolean(),
    isUserCreated: Type.Boolean(),
    name: NullableStringSchema,
    perceptionScale: NullableStringSchema,
    primaryMuscles: Type.Array(Type.String()),
    secondaryMuscles: Type.Array(Type.String()),
    supports1RM: Type.Boolean(),
    timerBased: Type.Boolean(),
  },
  {additionalProperties: false},
)

export const ExerciseIdParamsSchema = Type.Object({exerciseId: Type.Integer({examples: [1000], minimum: 1})}, {additionalProperties: false})

const NumericFilterSchema = Type.Optional(Type.Number({minimum: 0}))

export const ExerciseListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({description: 'Opaque cursor returned by a previous page.', minLength: 1})),
    equipmentId: Type.Optional(Type.String({description: 'Liftin equipment identifier.', minLength: 1})),
    limit: Type.Optional(Type.Integer({default: 50, maximum: 200, minimum: 1})),
    muscle: Type.Optional(Type.String({minLength: 1})),
    q: Type.Optional(Type.String({description: 'Case- and separator-insensitive search over stored, derived, and alternative English names.', examples: ['bench press'], minLength: 1})),
    sort: Type.Optional(Type.Union([Type.Literal('name'), Type.Literal('-name')], {description: 'Single sort field; - means descending.'})),
  },
  {additionalProperties: false},
)

const ExercisePerformanceSetBaseSchema = {
  id: Type.Integer({minimum: 1}),
  isWarmup: Type.Boolean(),
  rpe: NullableNumberSchema,
  volume: ApiWeightSchema,
  weight: ApiWeightSchema,
}

export const TimerBasedExercisePerformanceSetSchema = Type.Object(
  {...ExercisePerformanceSetBaseSchema, reps: Type.Null(), timeSeconds: Type.Number()},
  {additionalProperties: false},
)

export const RepBasedExercisePerformanceSetSchema = Type.Object(
  {...ExercisePerformanceSetBaseSchema, reps: NullableNumberSchema, timeSeconds: Type.Null()},
  {additionalProperties: false},
)

export const ExercisePerformanceStatisticsSchema = Type.Object(
  {
    setCount: Type.Integer({minimum: 0}),
    topReps: NullableNumberSchema,
    topWeight: ApiWeightSchema,
    totalReps: Type.Integer({minimum: 0}),
    volume: ApiWeightSchema,
  },
  {additionalProperties: false},
)

const ExercisePerformanceBaseSchema = {
  exerciseId: Type.Integer({description: 'Exercise-definition primary key.', minimum: 1}),
  id: Type.Integer({description: 'Performed exercise-result primary key.', minimum: 1}),
  program: Type.Union([WorkoutReferenceSchema, Type.Null()]),
  routine: Type.Union([WorkoutReferenceSchema, Type.Null()]),
  startedAt: Type.Union([Type.String({format: 'date-time'}), Type.Null()]),
  statistics: ExercisePerformanceStatisticsSchema,
  workoutId: Type.Integer({minimum: 1}),
}

export const ExercisePerformanceSchema = Type.Union([
  Type.Object({...ExercisePerformanceBaseSchema, sets: Type.Array(TimerBasedExercisePerformanceSetSchema), timerBased: Type.Literal(true)}, {additionalProperties: false}),
  Type.Object({...ExercisePerformanceBaseSchema, sets: Type.Array(RepBasedExercisePerformanceSetSchema), timerBased: Type.Literal(false)}, {additionalProperties: false}),
])

export const ExerciseStatisticsSchema = Type.Object(
  {
    lastPerformedAt: Type.Union([Type.String({format: 'date-time'}), Type.Null()]),
    performanceCount: Type.Integer({minimum: 0}),
    setCount: Type.Integer({minimum: 0}),
    topReps: NullableNumberSchema,
    topWeight: ApiWeightSchema,
    totalReps: Type.Integer({minimum: 0}),
    volume: ApiWeightSchema,
    workoutCount: Type.Integer({minimum: 0}),
  },
  {additionalProperties: false},
)

export const ExercisePerformanceCollectionSchema = Type.Object(
  {items: Type.Array(ExercisePerformanceSchema), nextCursor: Type.Optional(Type.String())},
  {additionalProperties: false},
)

export const ExercisePerformanceQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({minLength: 1})),
    from: Type.Optional(Type.String({format: 'date'})),
    limit: Type.Optional(Type.Integer({default: 50, maximum: 200, minimum: 1})),
    maxReps: NumericFilterSchema,
    maxWeight: NumericFilterSchema,
    minReps: NumericFilterSchema,
    minWeight: NumericFilterSchema,
    programId: Type.Optional(Type.Integer({minimum: 1})),
    routineId: Type.Optional(Type.Integer({minimum: 1})),
    sort: Type.Optional(Type.Union([Type.Literal('startedAt'), Type.Literal('-startedAt')], {description: 'Single sort field; - means descending. Defaults to -startedAt.'})),
    to: Type.Optional(Type.String({format: 'date'})),
    unit: Type.Optional(WeightUnitSchema),
  },
  {additionalProperties: false},
)

export const ExerciseStatisticsQuerySchema = Type.Omit(ExercisePerformanceQuerySchema, ['cursor', 'limit', 'sort'])

export const ListExercisesRouteSchema = {
  description: 'Returns non-deleted exercise definitions. Performance statistics are exposed separately. Use an opaque cursor for pagination.', operationId: 'listExercises', response: {200: Type.Object({items: Type.Array(ExerciseSchema), nextCursor: Type.Optional(Type.String())}, {additionalProperties: false}), 400: ErrorResponseSchema}, summary: 'List exercise metadata', tags: ['exercises'],
}
export const GetExerciseRouteSchema = {
  description: 'Direct lookup can return a soft-deleted exercise with isDeleted true. Statistics and performances remain separate.', operationId: 'getExercise', response: {200: ExerciseSchema, 404: ErrorResponseSchema}, summary: 'Get exercise metadata', tags: ['exercises'],
}
export const GetExerciseStatisticsRouteSchema = {
  description: 'Warmup sets are excluded from all aggregate values.', operationId: 'getExerciseStatistics', response: {200: ExerciseStatisticsSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema}, summary: 'Get exercise aggregate statistics', tags: ['exercises'],
}
export const ListExercisePerformancesRouteSchema = {
  description: 'Returns set-level performances in deterministic startedAt/id order. Warmups remain in set details but are excluded from statistics.', operationId: 'listExercisePerformances', response: {200: ExercisePerformanceCollectionSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema}, summary: 'List exercise performances', tags: ['exercises'],
}
