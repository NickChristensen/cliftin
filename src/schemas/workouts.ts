import {Type} from '@fastify/type-provider-typebox'

import {ErrorResponseSchema} from './common.js'

const NullableNumberSchema = Type.Union([Type.Number(), Type.Null()])
const NullableStringSchema = Type.Union([Type.String(), Type.Null()])
const NullableTimestampSchema = Type.Union([Type.String({format: 'date-time'}), Type.Null()])

export const WeightUnitSchema = Type.Union([Type.Literal('lb'), Type.Literal('kg')], {
  description: 'Weight display unit. Defaults to lb.',
  examples: ['lb'],
})

export const ApiWeightSchema = Type.Object({unit: WeightUnitSchema, value: NullableNumberSchema}, {additionalProperties: false})

export const WorkoutSetSchema = Type.Object(
  {
    id: Type.Integer({minimum: 1}),
    isWarmup: Type.Boolean({description: 'Always present, including when false.'}),
    reps: NullableNumberSchema,
    rpe: NullableNumberSchema,
    timeSeconds: NullableNumberSchema,
    volume: ApiWeightSchema,
    weight: ApiWeightSchema,
  },
  {additionalProperties: false},
)

export const PerformedExerciseSchema = Type.Object(
  {
    exerciseId: Type.Union([Type.Integer({description: 'Exercise-definition primary key.', minimum: 1}), Type.Null()]),
    id: Type.Integer({description: 'Performed exercise-result primary key.', minimum: 1}),
    name: NullableStringSchema,
    sets: Type.Array(WorkoutSetSchema),
  },
  {additionalProperties: false},
)

export const WorkoutReferenceSchema = Type.Object(
  {id: Type.Integer({minimum: 1}), name: NullableStringSchema},
  {additionalProperties: false},
)

export const NullableWorkoutReferenceSchema = Type.Union([WorkoutReferenceSchema, Type.Null()])

export const WorkoutSchema = Type.Object(
  {
    durationSeconds: NullableNumberSchema,
    id: Type.Integer({examples: [4001], minimum: 1}),
    program: NullableWorkoutReferenceSchema,
    routine: NullableWorkoutReferenceSchema,
    startedAt: NullableTimestampSchema,
  },
  {additionalProperties: false},
)

export const WorkoutDetailSchema = Type.Composite([
  WorkoutSchema,
  Type.Object({exercises: Type.Array(PerformedExerciseSchema)}, {additionalProperties: false}),
])

export const WorkoutCollectionSchema = Type.Object(
  {items: Type.Array(WorkoutSchema), nextCursor: Type.Optional(Type.String())},
  {additionalProperties: false},
)

export const WorkoutIdParamsSchema = Type.Object(
  {workoutId: Type.Integer({examples: [4001], minimum: 1})},
  {additionalProperties: false},
)

export const WorkoutListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({minLength: 1})),
    from: Type.Optional(Type.String({examples: ['2026-07-01'], format: 'date'})),
    limit: Type.Optional(Type.Integer({default: 50, maximum: 200, minimum: 1})),
    programId: Type.Optional(Type.Integer({description: 'Program primary key.', minimum: 1})),
    routineId: Type.Optional(Type.Integer({description: 'Routine primary key.', minimum: 1})),
    sort: Type.Optional(Type.Union([Type.Literal('startedAt'), Type.Literal('-startedAt')], {description: 'Single sort field; - means descending. Defaults to -startedAt.'})),
    to: Type.Optional(Type.String({examples: ['2026-07-31'], format: 'date'})),
  },
  {additionalProperties: false},
)

export const WorkoutDetailQuerySchema = Type.Object({unit: Type.Optional(WeightUnitSchema)}, {additionalProperties: false})

export const ListWorkoutsRouteSchema = {
  description: 'Returns workouts in deterministic startedAt/id order. Date filters are inclusive calendar dates in the server TZ; returned timestamps are UTC.',
  operationId: 'listWorkouts',
  response: {200: WorkoutCollectionSchema, 400: ErrorResponseSchema},
  summary: 'List completed workouts',
  tags: ['workouts'],
}

export const GetLatestWorkoutRouteSchema = {
  description: 'Returns the newest completed workout using the same detail shape as direct workout lookup.',
  operationId: 'getLatestWorkout',
  response: {200: WorkoutDetailSchema, 404: ErrorResponseSchema},
  summary: 'Get the latest completed workout',
  tags: ['workouts'],
}

export const GetWorkoutRouteSchema = {
  description: 'Includes performed exercises and all recorded sets, including warmups.',
  operationId: 'getWorkout',
  response: {200: WorkoutDetailSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema},
  summary: 'Get completed workout detail',
  tags: ['workouts'],
}

export const GetWorkoutRoutineRouteSchema = {
  description: 'Returns the planned routine linked to this completed workout.',
  operationId: 'getWorkoutRoutine',
  response: {200: WorkoutReferenceSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema},
  summary: 'Get a workout routine reference',
  tags: ['workouts'],
}
