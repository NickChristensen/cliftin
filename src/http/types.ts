import type {TypeBoxTypeProvider} from '@fastify/type-provider-typebox'
import type {FastifyInstance} from 'fastify'

import type {DbContext} from '../lib/db.js'

declare module 'fastify' {
  interface FastifyInstance {
    db: DbContext
  }
}

export type CliftinApp = FastifyInstance<
  import('fastify').RawServerDefault,
  import('fastify').RawRequestDefaultExpression,
  import('fastify').RawReplyDefaultExpression,
  import('fastify').FastifyBaseLogger,
  TypeBoxTypeProvider
>

export type AppOptions = {
  closeDb?: () => Promise<void>
  db: DbContext
}
