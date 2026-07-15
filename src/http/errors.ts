import type {FastifyError, FastifyInstance} from 'fastify'

import {type ErrorIssue, errorResponse} from '../schemas/common.js'

export class HttpError extends Error {
  public constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly issues?: ErrorIssue[],
  ) {
    super(message)
  }
}

export function notFound(code: string, message: string): HttpError {
  return new HttpError(404, code, message)
}

function validationIssues(error: FastifyError): ErrorIssue[] | undefined {
  if (!error.validation) return undefined

  return error.validation.map((issue) => ({
    message: issue.message ?? 'Invalid value',
    path: issue.instancePath ?? '',
  }))
}

export function registerErrorHandlers(app: FastifyInstance): void {
  app.setNotFoundHandler((request, reply) => reply.code(404).send(errorResponse(404, 'not-found', `Route ${request.method} ${request.url} was not found`)))

  app.setErrorHandler((error, request, reply) => {
    const fastifyError = error as FastifyError
    if (fastifyError.validation) {
      return reply.code(400).send(errorResponse(400, 'invalid-request', 'Request validation failed', validationIssues(fastifyError)))
    }

    if (fastifyError instanceof HttpError) {
      return reply.code(fastifyError.status).send(errorResponse(fastifyError.status, fastifyError.code, fastifyError.message, fastifyError.issues))
    }

    const status = fastifyError.statusCode !== undefined && fastifyError.statusCode >= 400 && fastifyError.statusCode < 600 ? fastifyError.statusCode : 500
    if (status >= 500) request.log.error(fastifyError)

    return reply.code(status).send(errorResponse(status, status === 500 ? 'internal-error' : 'request-error', status === 500 ? 'An unexpected error occurred' : fastifyError.message))
  })
}
