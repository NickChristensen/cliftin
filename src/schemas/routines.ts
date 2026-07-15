import {Type} from '@fastify/type-provider-typebox'

import {ErrorResponseSchema} from './common.js'
import {PlannedExerciseSchema, ProgramReferenceSchema, } from './programs.js'

export const RoutineWeekSchema = Type.Object(
  {
    id: Type.Integer({examples: [10], minimum: 1}),
    number: Type.Integer({examples: [1], minimum: 1}),
  },
  {additionalProperties: false},
)

export const RoutineSummarySchema = Type.Object(
  {
    id: Type.Integer({examples: [100], minimum: 1}),
    isDeleted: Type.Boolean(),
    isNext: Type.Boolean(),
    name: Type.Union([Type.String(), Type.Null()]),
    program: ProgramReferenceSchema,
    week: RoutineWeekSchema,
  },
  {additionalProperties: false},
)

export const RoutineDetailSchema = Type.Intersect(
  [
    RoutineSummarySchema,
    Type.Object(
      {
        exercises: Type.Array(PlannedExerciseSchema),
      },
      {additionalProperties: false},
    ),
  ],
  {additionalProperties: false},
)

export const RoutineCollectionSchema = Type.Object(
  {
    items: Type.Array(RoutineSummarySchema),
    nextCursor: Type.Optional(Type.String()),
  },
  {additionalProperties: false},
)

export const RoutineIdParamsSchema = Type.Object(
  {
    routineId: Type.Integer({examples: [100], minimum: 1}),
  },
  {additionalProperties: false},
)

export const RoutineListQuerySchema = Type.Object(
  {
    cursor: Type.Optional(Type.String({description: 'Opaque cursor returned by a previous page.', minLength: 1})),
    exerciseId: Type.Optional(Type.Integer({minimum: 1})),
    limit: Type.Optional(Type.Integer({default: 50, maximum: 200, minimum: 1})),
    programId: Type.Optional(Type.Integer({minimum: 1})),
    q: Type.Optional(Type.String({description: 'Case-insensitive substring match on routine name.', examples: ['upper'], minLength: 1})),
    sort: Type.Optional(Type.Union([Type.Literal('name'), Type.Literal('-name'), Type.Literal('weekId'), Type.Literal('-weekId')], {description: 'Single sort field; prefix with - for descending order.'})),
    weekId: Type.Optional(Type.Integer({minimum: 1})),
  },
  {additionalProperties: false},
)

export const ListRoutinesRouteSchema = {
  description: 'Returns non-deleted routines and supports q, programId, weekId, exerciseId, one explicit sort value, and opaque cursor pagination.',
  operationId: 'listRoutines',
  response: {200: RoutineCollectionSchema, 400: ErrorResponseSchema},
  summary: 'List planned routines',
  tags: ['routines'],
}

export const GetRoutineRouteSchema = {
  description: 'Returns a routine with its normalized planned exercises and sets. Direct lookup can return a soft-deleted routine with isDeleted true.',
  operationId: 'getRoutine',
  response: {200: RoutineDetailSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema},
  summary: 'Get planned routine detail',
  tags: ['routines'],
}

export const ActiveNextRoutineRouteSchema = {
  description: 'Returns the single up-next routine for the active program with normalized planned exercises and sets.',
  operationId: 'getActiveProgramNextRoutine',
  response: {200: RoutineDetailSchema, 400: ErrorResponseSchema, 404: ErrorResponseSchema},
  summary: 'Get the active program next routine',
  tags: ['programs'],
}



export {UnitQuerySchema} from './programs.js'
