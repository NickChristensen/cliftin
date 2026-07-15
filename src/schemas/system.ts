import {Type} from '@fastify/type-provider-typebox'

import {ErrorResponseSchema} from './common.js'

export const HealthResponseSchema = Type.Object(
  {
    status: Type.Literal('ok'),
  },
  {additionalProperties: false},
)

export const OpenApiResponseSchema = Type.Any()

export const HealthRouteSchema = {
  operationId: 'health',
  response: {
    200: HealthResponseSchema,
    400: ErrorResponseSchema,
    503: ErrorResponseSchema,
  },
  summary: 'Check database availability',
  tags: ['system'],
}

export const OpenApiRouteSchema = {
  operationId: 'getOpenApiDocument',
  response: {
    200: OpenApiResponseSchema,
    400: ErrorResponseSchema,
  },
  summary: 'Get the generated OpenAPI document',
  tags: ['system'],
}
