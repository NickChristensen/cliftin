import swagger from '@fastify/swagger'
import {TypeBoxTypeProvider, TypeBoxValidatorCompiler} from '@fastify/type-provider-typebox'
import Fastify from 'fastify'

import type {AppOptions, CliftinApp} from './http/types.js'

import {registerErrorHandlers} from './http/errors.js'
import {registerFormats} from './http/formats.js'
import {exerciseRoutes} from './routes/exercises.js'
import {programRoutes} from './routes/programs.js'
import {routineRoutes} from './routes/routines.js'
import {systemRoutes} from './routes/system.js'
import {workoutRoutes} from './routes/workouts.js'

export async function buildApp({closeDb, db}: AppOptions): Promise<CliftinApp> {
  registerFormats()
  const app = Fastify({logger: true}).withTypeProvider<TypeBoxTypeProvider>()
  app.setValidatorCompiler(TypeBoxValidatorCompiler)
  app.decorate('db', db)

  if (closeDb) {
    app.addHook('onClose', closeDb)
  }

  await app.register(swagger, {
    openapi: {
      info: {
        license: {
          identifier: 'MIT',
          name: 'MIT',
        },
        title: 'Cliftin API',
        version: '1.0.0',
      },
      openapi: '3.1.2',
      security: [],
      servers: [{url: '/'}],
    },
  })

  registerErrorHandlers(app)
  await app.register(systemRoutes)
  await app.register(programRoutes)
  await app.register(routineRoutes)
  await app.register(workoutRoutes)
  await app.register(exerciseRoutes)

  return app
}
