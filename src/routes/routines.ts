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

      if (sort === 'weekId' || sort === '-weekId') {
        const positions = new Map(rows.map((routine, index) => [routine.id, index]))
        return paginateRows(rows, {
          cursor,
          descending: false,
          limit,
          sort,
          value: (routine) => positions.get(routine.id)!,
        })
      }

      const sortField = sort.startsWith('-') ? sort.slice(1) : sort
      return paginateRows(rows, {
        cursor,
        descending: sort.startsWith('-'),
        limit,
        sort,
        value: (routine) => (sortField === 'name' ? routine.name : routine.week.id),
      })
    })
  })

  app.get(
    '/v1/routines/:routineId',
    {schema: {...GetRoutineRouteSchema, params: RoutineIdParamsSchema, querystring: UnitQuerySchema}},
    async (request) => withDeferredReadTransaction(app.db.db, (db) => getApiRoutineDetail(db, request.params.routineId, request.query.unit ?? 'lb')),
  )
}
