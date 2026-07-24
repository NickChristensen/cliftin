import {Type} from '@fastify/type-provider-typebox'

import {ErrorResponseSchema} from './common.js'

const NullableStringSchema = Type.Union([Type.String(), Type.Null()])
const NullableNumberSchema = Type.Union([Type.Number(), Type.Null()])
const NullableTimestampSchema = Type.Union([Type.String({format: 'date-time'}), Type.Null()])

export const UnitSchema = Type.Union([Type.Literal('lb'), Type.Literal('kg')], {
  description: 'Weight display unit. Defaults to lb where applicable.',
  examples: ['lb'],
})

export const WeightSchema = Type.Object(
  {
    unit: UnitSchema,
    value: NullableNumberSchema,
  },
  {additionalProperties: false},
)

export const ProgramReferenceSchema = Type.Object(
  {
    id: Type.Integer({examples: [1], minimum: 1}),
    name: NullableStringSchema,
  },
  {additionalProperties: false},
)

export const ProgramSchema = Type.Object(
  {
    dateAdded: NullableTimestampSchema,
    id: Type.Integer({examples: [1], minimum: 1}),
    isActive: Type.Boolean(),
    isDeleted: Type.Boolean(),
    isTemplate: Type.Boolean(),
    name: NullableStringSchema,
  },
  {additionalProperties: false},
)

const PlannedSetBaseSchema = {
  id: Type.Union([Type.Integer({minimum: 1}), Type.Null()]),
  rpe: NullableNumberSchema,
  weight: WeightSchema,
}

export const TimerBasedPlannedSetSchema = Type.Object(
  {...PlannedSetBaseSchema, reps: Type.Null(), timeSeconds: Type.Number()},
  {additionalProperties: false},
)

export const RepBasedPlannedSetSchema = Type.Object(
  {...PlannedSetBaseSchema, reps: NullableNumberSchema, timeSeconds: Type.Null()},
  {additionalProperties: false},
)

const PlannedExerciseBaseSchema = {
  exerciseId: Type.Union([Type.Integer({description: 'Exercise definition primary key.', minimum: 1}), Type.Null()]),
  id: Type.Integer({description: 'Exercise configuration primary key.', minimum: 1}),
  name: NullableStringSchema,
}

export const PlannedExerciseSchema = Type.Union([
  Type.Object({...PlannedExerciseBaseSchema, sets: Type.Array(TimerBasedPlannedSetSchema), timerBased: Type.Literal(true)}, {additionalProperties: false}),
  Type.Object({...PlannedExerciseBaseSchema, sets: Type.Array(RepBasedPlannedSetSchema), timerBased: Type.Literal(false)}, {additionalProperties: false}),
])

export const PlannedRoutineSchema = Type.Object(
  {
    exercises: Type.Array(PlannedExerciseSchema),
    id: Type.Integer({minimum: 1}),
    name: NullableStringSchema,
  },
  {additionalProperties: false},
)

export const ProgramPlanSchema = Type.Object(
  {
    weeks: Type.Array(
      Type.Object(
        {
          id: Type.Integer({minimum: 1}),
          routines: Type.Array(PlannedRoutineSchema),
        },
        {additionalProperties: false},
      ),
    ),
  },
  {additionalProperties: false},
)

export const ProgramCollectionSchema = Type.Object(
  {
    items: Type.Array(ProgramSchema),
    nextCursor: Type.Optional(Type.String()),
  },
  {additionalProperties: false},
)

export const ProgramIdParamsSchema = Type.Object(
  {
    programId: Type.Integer({description: 'Program primary key.', examples: [1], minimum: 1}),
  },
  {additionalProperties: false},
)

export const ProgramListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({description: 'Opaque cursor returned by a previous page.', minLength: 1})),
    limit: Type.Optional(Type.Integer({default: 50, maximum: 200, minimum: 1})),
    q: Type.Optional(Type.String({description: 'Case-insensitive substring match on program name.', examples: ['strength'], minLength: 1})),
    sort: Type.Optional(Type.Union([Type.Literal('name'), Type.Literal('-name'), Type.Literal('dateAdded'), Type.Literal('-dateAdded')], {description: 'Single sort field; prefix with - for descending order.'})),
  },
  {additionalProperties: false},
)

export const UnitQuerySchema = Type.Object(
  {
    unit: Type.Optional(UnitSchema),
  },
  {additionalProperties: false},
)

const NotFoundResponse = ErrorResponseSchema

export const ListProgramsRouteSchema = {
  description: 'Returns non-deleted programs. Use q for a case-insensitive name substring, one explicit sort value, and an opaque cursor for pagination.',
  operationId: 'listPrograms',
  response: {200: ProgramCollectionSchema, 400: ErrorResponseSchema},
  summary: 'List programs',
  tags: ['programs'],
}

export const GetActiveProgramRouteSchema = {
  description: 'Returns the program selected by Liftin, with legacy current-program fallback when no selection exists.',
  operationId: 'getActiveProgram',
  response: {200: ProgramSchema, 404: NotFoundResponse},
  summary: 'Get the active program',
  tags: ['programs'],
}

export const GetProgramRouteSchema = {
  description: 'Returns program metadata separately from its planned hierarchy. Direct lookup can return a soft-deleted program with isDeleted true.',
  operationId: 'getProgram',
  response: {200: ProgramSchema, 404: NotFoundResponse},
  summary: 'Get program metadata',
  tags: ['programs'],
}

export const GetProgramPlanRouteSchema = {
  description: 'Returns a bounded normalized plan. Individual sets use their ordered child rows capped by configured set count; non-individual exercises synthesize default sets.',
  operationId: 'getProgramPlan',
  response: {200: ProgramPlanSchema, 400: ErrorResponseSchema, 404: NotFoundResponse},
  summary: 'Get a program plan',
  tags: ['programs'],
}
