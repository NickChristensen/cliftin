import type {FastifyPluginAsyncTypebox} from '@fastify/type-provider-typebox'

import {paginateRows} from '../http/pagination.js'
import {withDeferredReadTransaction} from '../lib/db.js'
import {getApiRoutineDetail, listApiRoutines} from '../lib/repositories/routines.js'
import {GetRoutineRouteSchema, ListRoutinesRouteSchema, RoutineIdParamsSchema, RoutineListQuerySchema, UnitQuerySchema} from '../schemas/routines.js'

export const routineRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/v1/routines', {schema: {...ListRoutinesRouteSchema, querystring: RoutineListQuerySchema}}, async (request) => {
    const {cursor, limit, sort = 'weekId', ...filters} = request.query
    return withDeferredReadTransaction(app.db.db, async (db) => {
      const rows = await listApiRoutines(db, {...filters, sort})
      const sortField = sort.startsWith('-') ? sort.slice(1) : sort
      const page = paginateRows(rows, {
        cursor,
        descending: sort.startsWith('-'),
        filter: JSON.stringify({exerciseId: filters.exerciseId ?? null, programId: filters.programId ?? null, q: filters.q ?? null, weekId: filters.weekId ?? null}),
        idDescending: sort === '-weekId',
        limit,
        sort,
        value: (row) => (sortField === 'name' ? [row.routine.name] : [row.sortKey.weekOrder, row.sortKey.weekId, row.sortKey.routineOrder]),
        valueLength: sortField === 'name' ? 1 : 3,
      })

      return {...page, items: page.items.map((row) => row.routine)}
    })
  })

  app.get(
    '/v1/routines/:routineId',
    {schema: {...GetRoutineRouteSchema, params: RoutineIdParamsSchema, querystring: UnitQuerySchema}},
    async (request) => withDeferredReadTransaction(app.db.db, (db) => getApiRoutineDetail(db, request.params.routineId, request.query.unit ?? 'lb')),
  )
}
