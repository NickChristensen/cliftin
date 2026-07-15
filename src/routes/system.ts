import type {FastifyPluginAsyncTypebox} from '@fastify/type-provider-typebox'

import {EmptyObjectSchema, errorResponse} from '../schemas/common.js'
import {HealthRouteSchema, OpenApiRouteSchema} from '../schemas/system.js'

export const systemRoutes: FastifyPluginAsyncTypebox = async (app) => {
  app.get('/health', {schema: {...HealthRouteSchema, querystring: EmptyObjectSchema}}, async (_request, reply) => {
    try {
      app.db.sqlite.prepare('select 1').get()
      return {status: 'ok' as const}
    } catch (error) {
      app.log.warn({err: error}, 'Database health check failed')
      return reply.code(503).send(errorResponse(503, 'database-unavailable', 'Database is unavailable'))
    }
  })

  app.get('/openapi.json', {schema: {...OpenApiRouteSchema, querystring: EmptyObjectSchema}}, async () => app.swagger())
}
