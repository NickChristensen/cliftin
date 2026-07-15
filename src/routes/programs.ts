import type {FastifyPluginAsyncTypebox} from '@fastify/type-provider-typebox'

import {paginateRows} from '../http/pagination.js'
import {withDeferredReadTransaction} from '../lib/db.js'
import {getActiveApiProgram, getApiProgram, getApiProgramPlan, listApiPrograms} from '../lib/repositories/programs.js'
import {getActiveApiNextRoutine} from '../lib/repositories/routines.js'
import {EmptyObjectSchema} from '../schemas/common.js'
import {
  GetActiveProgramRouteSchema,
  GetProgramPlanRouteSchema,
  GetProgramRouteSchema,
  ListProgramsRouteSchema,
  ProgramIdParamsSchema,
  ProgramListQuerySchema,
  UnitQuerySchema,
} from '../schemas/programs.js'
import {ActiveNextRoutineRouteSchema} from '../schemas/routines.js'

export const programRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/v1/programs', {schema: {...ListProgramsRouteSchema, querystring: ProgramListQuerySchema}}, async (request) => {
    const {cursor, limit, sort = '-dateAdded', ...filters} = request.query
    const sortField = sort.startsWith('-') ? sort.slice(1) : sort
    return withDeferredReadTransaction(app.db.db, async (db) => {
      return paginateRows(await listApiPrograms(db, filters), {
        cursor,
        descending: sort.startsWith('-'),
        limit,
        sort,
        value: (program) => (sortField === 'name' ? program.name : program.dateAdded),
      })
    })
  })

  app.get('/v1/programs/active', {schema: {...GetActiveProgramRouteSchema, querystring: EmptyObjectSchema}}, async () =>
    withDeferredReadTransaction(app.db.db, (db) => getActiveApiProgram(db)),
  )

  app.get(
    '/v1/programs/active/next-routine',
    {schema: {...ActiveNextRoutineRouteSchema, querystring: UnitQuerySchema}},
    async (request) => withDeferredReadTransaction(app.db.db, (db) => getActiveApiNextRoutine(db, request.query.unit ?? 'lb')),
  )

  app.get(
    '/v1/programs/:programId',
    {schema: {...GetProgramRouteSchema, params: ProgramIdParamsSchema, querystring: EmptyObjectSchema}},
    async (request) => withDeferredReadTransaction(app.db.db, (db) => getApiProgram(db, request.params.programId)),
  )

  app.get(
    '/v1/programs/:programId/plan',
    {schema: {...GetProgramPlanRouteSchema, params: ProgramIdParamsSchema, querystring: UnitQuerySchema}},
    async (request) => withDeferredReadTransaction(app.db.db, (db) => getApiProgramPlan(db, request.params.programId, request.query.unit ?? 'lb')),
  )
}
