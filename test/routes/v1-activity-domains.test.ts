import {TypeBoxTypeProvider, TypeBoxValidatorCompiler} from '@fastify/type-provider-typebox'
import {expect} from 'chai'
import Fastify from 'fastify'

import {registerErrorHandlers} from '../../src/http/errors.js'
import {registerFormats} from '../../src/http/formats.js'
import {closeDb, openDb} from '../../src/lib/db.js'
import {exerciseRoutes} from '../../src/routes/exercises.js'
import {workoutRoutes} from '../../src/routes/workouts.js'
import {createTestDb} from '../support/db.js'

describe('v1 activity workout and exercise routes', () => {
  const dbPath = createTestDb()

  async function createApp() {
    registerFormats()
    const db = openDb(dbPath)
    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()
    app.setValidatorCompiler(TypeBoxValidatorCompiler)
    app.decorate('db', db)
    registerErrorHandlers(app)
    await app.register(workoutRoutes)
    await app.register(exerciseRoutes)
    app.addHook('onClose', () => closeDb(db))
    return app
  }

  it('returns cursor-paginated workouts and preserves performed-result IDs with warmups', async () => {
    const app = await createApp()
    try {
      const firstPage = await app.inject({method: 'GET', url: '/v1/workouts?limit=1'})
      expect(firstPage.statusCode).to.equal(200)
      expect(firstPage.json().items).to.have.length(1)
      expect(firstPage.json().nextCursor).to.be.a('string')

      const nextPage = await app.inject({method: 'GET', url: `/v1/workouts?limit=1&cursor=${firstPage.json().nextCursor}`})
      const mismatchedSort = await app.inject({method: 'GET', url: `/v1/workouts?limit=1&sort=startedAt&cursor=${firstPage.json().nextCursor}`})
      const detail = await app.inject({method: 'GET', url: '/v1/workouts/4001?unit=kg'})

      expect(nextPage.json().items.map((item: {id: number}) => item.id)).to.deep.equal([4000])
      expect(mismatchedSort.statusCode).to.equal(400)
      expect(mismatchedSort.json()).to.include({code: 'invalid-cursor'})
      expect(detail.statusCode).to.equal(200)
      expect(detail.json()).to.include({durationSeconds: 3500, id: 4001})
      expect(detail.json().startedAt).to.match(/Z$/)
      const squat = detail.json().exercises.find((exercise: {exerciseId: number}) => exercise.exerciseId === 1000)
      expect(squat).to.include({exerciseId: 1000, id: 5001})
      expect(squat.sets[0]).to.include({id: 6002, isWarmup: false})
      expect(squat.sets[0].weight).to.deep.equal({unit: 'kg', value: 105})
    } finally {
      await app.close()
    }
  })

  it('returns latest and linked workout routine, with strict numeric route ids', async () => {
    const app = await createApp()
    try {
      const latest = await app.inject({method: 'GET', url: '/v1/workouts/latest'})
      const routine = await app.inject({method: 'GET', url: '/v1/workouts/4001/routine'})
      const meaninglessListUnit = await app.inject({method: 'GET', url: '/v1/workouts?unit=kg'})
      const meaninglessRoutineUnit = await app.inject({method: 'GET', url: '/v1/workouts/4001/routine?unit=kg'})
      const invalid = await app.inject({method: 'GET', url: '/v1/workouts/not-a-number'})

      expect(latest.json()).to.include({id: 4001})
      expect(routine.json()).to.deep.equal({id: 100, name: 'Day A'})
      expect(meaninglessListUnit.statusCode).to.equal(400)
      expect(meaninglessRoutineUnit.statusCode).to.equal(400)
      expect(invalid.statusCode).to.equal(400)
    } finally {
      await app.close()
    }
  })

  it('accepts valid inclusive date filters and rejects invalid ranges', async () => {
    const app = await createApp()
    try {
      const valid = await app.inject({method: 'GET', url: '/v1/workouts?from=2023-03-08&to=2023-03-09'})
      const reversed = await app.inject({method: 'GET', url: '/v1/workouts?from=2023-03-09&to=2023-03-08'})
      const invalidDate = await app.inject({method: 'GET', url: '/v1/workouts?from=2023-02-30'})

      expect(valid.statusCode).to.equal(200)
      expect(reversed.statusCode).to.equal(400)
      expect(reversed.json()).to.include({code: 'invalid-date-range'})
      expect(invalidDate.statusCode).to.equal(400)
      expect(invalidDate.json()).to.include({code: 'invalid-date-range'})
    } finally {
      await app.close()
    }
  })

  it('separates exercise metadata, statistics, and performances while normalizing search', async () => {
    const app = await createApp()
    try {
      const collection = await app.inject({method: 'GET', url: '/v1/exercises?q=barbell-squat'})
      const equipmentCollection = await app.inject({method: 'GET', url: '/v1/exercises?equipmentId=smithMachine'})
      const metadata = await app.inject({method: 'GET', url: '/v1/exercises/1000'})
      const statistics = await app.inject({method: 'GET', url: '/v1/exercises/1000/statistics?unit=lb'})
      const performances = await app.inject({method: 'GET', url: '/v1/exercises/1000/performances?unit=kg&limit=1'})

      expect(collection.json().items.map((item: {id: number}) => item.id)).to.deep.equal([1000])
      expect(collection.json().items[0].alternativeEnglishNames).to.deep.equal(['barbell_squat'])
      expect(collection.json().items[0].primaryMuscles).to.deep.equal(['Legs'])
      expect(equipmentCollection.json().items.map((item: {id: number}) => item.id)).to.deep.equal([1001, 1000])
      expect(metadata.json()).to.include({id: 1000, isDeleted: false, name: 'Squat'})
      expect(metadata.json()).to.not.have.property('statistics')
      expect(statistics.json()).to.include({performanceCount: 2, setCount: 2, totalReps: 11})
      expect(statistics.json().volume).to.deep.equal({unit: 'lb', value: 2513.5})
      expect(performances.json().items).to.have.length(1)
      expect(performances.json().items[0]).to.include({exerciseId: 1000, id: 5001, workoutId: 4001})
      expect(performances.json().items[0].sets[0].weight).to.deep.equal({unit: 'kg', value: 105})
    } finally {
      await app.close()
    }
  })

  it('hides deleted exercise definitions in collections but exposes direct deletion state', async () => {
    const app = await createApp()
    try {
      const collection = await app.inject({method: 'GET', url: '/v1/exercises'})
      const deleted = await app.inject({method: 'GET', url: '/v1/exercises/1003'})
      const invalidFilter = await app.inject({method: 'GET', url: '/v1/exercises/1000/performances?programId=wrong'})

      expect(collection.json().items.map((item: {id: number}) => item.id)).to.not.include(1003)
      expect(deleted.json()).to.include({id: 1003, isDeleted: true})
      expect(invalidFilter.statusCode).to.equal(400)
    } finally {
      await app.close()
    }
  })

  it('cursor-paginates exercise metadata in descending name order', async () => {
    const app = await createApp()
    try {
      const firstPage = await app.inject({method: 'GET', url: '/v1/exercises?sort=-name&limit=1'})
      const secondPage = await app.inject({method: 'GET', url: `/v1/exercises?sort=-name&limit=1&cursor=${firstPage.json().nextCursor}`})
      const mismatchedSort = await app.inject({method: 'GET', url: `/v1/exercises?sort=name&cursor=${firstPage.json().nextCursor}`})

      expect(firstPage.json().items.map((exercise: {id: number}) => exercise.id)).to.deep.equal([1000])
      expect(secondPage.json().items.map((exercise: {id: number}) => exercise.id)).to.deep.equal([1001])
      expect(mismatchedSort.statusCode).to.equal(400)
      expect(mismatchedSort.json()).to.include({code: 'invalid-cursor'})
    } finally {
      await app.close()
    }
  })
})
