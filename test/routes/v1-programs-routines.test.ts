import {TypeBoxTypeProvider, TypeBoxValidatorCompiler} from '@fastify/type-provider-typebox'
import {expect} from 'chai'
import Database from 'better-sqlite3'
import Fastify from 'fastify'

import {registerErrorHandlers} from '../../src/http/errors.js'
import {closeDb, openDb} from '../../src/lib/db.js'
import {programRoutes} from '../../src/routes/programs.js'
import {routineRoutes} from '../../src/routes/routines.js'
import {createTestDb} from '../support/db.js'

describe('v1 programs and routines routes', () => {
  const dbPath = createTestDb()

  async function createApp(path = dbPath) {
    const db = openDb(path)
    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()
    app.setValidatorCompiler(TypeBoxValidatorCompiler)
    app.decorate('db', db)
    registerErrorHandlers(app)
    await app.register(programRoutes)
    await app.register(routineRoutes)
    app.addHook('onClose', () => closeDb(db))
    return app
  }

  it('separates program metadata from normalized plan data', async () => {
    const app = await createApp()
    try {
      const metadata = await app.inject({method: 'GET', url: '/v1/programs/1'})
      const plan = await app.inject({method: 'GET', url: '/v1/programs/1/plan?unit=lb'})

      expect(metadata.statusCode).to.equal(200)
      expect(metadata.json()).to.include({id: 1, isActive: true, isDeleted: false, isTemplate: false, name: 'Active Program'})
      expect(plan.statusCode).to.equal(200)
      expect(plan.json()).to.not.have.property('program')

      const planPayload = plan.json()
      const squat = planPayload.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 2000)
      const trailingRowExercise = planPayload.weeks[0].routines[1].exercises.find((exercise: {id: number}) => exercise.id === 2004)
      const defaultSetExercise = planPayload.weeks[0].routines[1].exercises.find((exercise: {id: number}) => exercise.id === 2002)

      expect(squat).to.include({exerciseId: 1000, id: 2000, name: 'Squat'})
      expect(squat).to.not.have.property('plannedSets')
      expect(squat.sets.map((set: {id: null | number}) => set.id)).to.deep.equal([3000, 3001])
      expect(trailingRowExercise.sets.map((set: {id: null | number}) => set.id)).to.deep.equal([3005, 3006])
      expect(defaultSetExercise.sets).to.deep.equal([
        {id: null, reps: 8, rpe: null, timeSeconds: 120, weight: {unit: 'lb', value: 181.5}},
        {id: null, reps: 8, rpe: null, timeSeconds: 120, weight: {unit: 'lb', value: 181.5}},
      ])
    } finally {
      await app.close()
    }
  })

  it('hides soft-deleted programs in collections but returns them by numeric id', async () => {
    const app = await createApp()
    try {
      const collection = await app.inject({method: 'GET', url: '/v1/programs?q=program&sort=name'})
      const deleted = await app.inject({method: 'GET', url: '/v1/programs/3'})

      expect(collection.statusCode).to.equal(200)
      expect(collection.json().items.map((program: {id: number}) => program.id)).to.deep.equal([1, 2])
      expect(deleted.statusCode).to.equal(200)
      expect(deleted.json()).to.include({id: 3, isDeleted: true})
    } finally {
      await app.close()
    }
  })

  it('hides soft-deleted routines in collections but returns them by numeric id', async () => {
    const app = await createApp()
    try {
      const collection = await app.inject({method: 'GET', url: '/v1/routines'})
      const deleted = await app.inject({method: 'GET', url: '/v1/routines/102'})

      expect(collection.statusCode).to.equal(200)
      expect(collection.json().items.map((routine: {id: number}) => routine.id)).to.deep.equal([100, 101])
      expect(deleted.statusCode).to.equal(200)
      expect(deleted.json()).to.include({id: 102, isDeleted: true})
      expect(deleted.json().exercises).to.deep.equal([])
    } finally {
      await app.close()
    }
  })

  it('preserves planned definition IDs when historical exercise metadata is missing', async () => {
    const historicalDbPath = createTestDb()
    const fixtureDb = new Database(historicalDbPath)
    fixtureDb.prepare('insert into ZEXERCISECONFIGURATION values (?, ?, ?, ?, ?, ?, ?)').run(2005, 9999, 5, 3, 90, null, 0)
    fixtureDb.prepare('insert into Z_12ROUTINES values (?, ?, ?)').run(2005, 100, 300)
    fixtureDb.close()

    const app = await createApp(historicalDbPath)
    try {
      const plan = await app.inject({method: 'GET', url: '/v1/programs/1/plan'})

      expect(plan.statusCode).to.equal(200)
      expect(plan.json().weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 2005)).to.include({exerciseId: 9999, name: '(unnamed)'})
    } finally {
      await app.close()
    }
  })

  it('filters routines by planned exercise and returns bounded detail in the requested unit', async () => {
    const app = await createApp()
    try {
      const collection = await app.inject({method: 'GET', url: '/v1/routines?exerciseId=1000&sort=name'})
      const detail = await app.inject({method: 'GET', url: '/v1/routines/100?unit=kg'})
      const next = await app.inject({method: 'GET', url: '/v1/programs/active/next-routine'})

      expect(collection.statusCode).to.equal(200)
      expect(collection.json().items).to.deep.equal([
        {
          id: 100,
          isDeleted: false,
          isNext: false,
          name: 'Day A',
          program: {id: 1, name: 'Active Program'},
          week: {id: 10, number: 1},
        },
      ])
      expect(detail.statusCode).to.equal(200)
      expect(detail.json().exercises.find((exercise: {id: number}) => exercise.id === 2000).sets[0].weight).to.deep.equal({unit: 'kg', value: 100})
      expect(next.statusCode).to.equal(200)
      expect(next.json()).to.include({id: 101, isNext: true})
    } finally {
      await app.close()
    }
  })

  it('enforces numeric ids and strict query schemas', async () => {
    const app = await createApp()
    try {
      const invalidId = await app.inject({method: 'GET', url: '/v1/programs/not-a-number'})
      const invalidQuery = await app.inject({method: 'GET', url: '/v1/routines?sort=unexpected'})
      const meaninglessUnit = await app.inject({method: 'GET', url: '/v1/programs/1?unit=kg'})
      const missing = await app.inject({method: 'GET', url: '/v1/routines/999'})

      expect(invalidId.statusCode).to.equal(400)
      expect(invalidQuery.statusCode).to.equal(400)
      expect(meaninglessUnit.statusCode).to.equal(400)
      expect(missing.statusCode).to.equal(404)
      expect(missing.json()).to.include({code: 'routine-not-found', status: 404})
    } finally {
      await app.close()
    }
  })

  it('cursor-paginates program and routine collections with stable sort ordering', async () => {
    const seed = new Database(dbPath)
    seed.prepare('insert into ZWORKOUTPLAN values (?, ?, ?, ?, ?, ?, ?)').run(4, null, 0, 0, 0, null, Buffer.from('DD44', 'hex'))
    seed.close()

    const app = await createApp()
    try {
      const firstProgramPage = await app.inject({method: 'GET', url: '/v1/programs?sort=name&limit=1'})
      const programCursor = firstProgramPage.json().nextCursor
      const secondProgramPage = await app.inject({method: 'GET', url: `/v1/programs?sort=name&limit=1&cursor=${programCursor}`})
      const descendingPrograms = await app.inject({method: 'GET', url: '/v1/programs?sort=-name&limit=2'})
      const descendingProgramPage = await app.inject({method: 'GET', url: `/v1/programs?sort=-name&limit=2&cursor=${descendingPrograms.json().nextCursor}`})
      const mismatchedSort = await app.inject({method: 'GET', url: `/v1/programs?sort=-name&cursor=${programCursor}`})
      const malformedCursor = await app.inject({method: 'GET', url: '/v1/programs?cursor=not-a-cursor'})
      const firstRoutinePage = await app.inject({method: 'GET', url: '/v1/routines?limit=1'})
      const secondRoutinePage = await app.inject({method: 'GET', url: `/v1/routines?limit=1&cursor=${firstRoutinePage.json().nextCursor}`})
      const descendingRoutinePage = await app.inject({method: 'GET', url: '/v1/routines?sort=-weekId&limit=1'})

      expect(firstProgramPage.json().items.map((program: {id: number}) => program.id)).to.deep.equal([4])
      expect(secondProgramPage.json().items.map((program: {id: number}) => program.id)).to.deep.equal([1])
      expect(descendingPrograms.json().items.map((program: {id: number}) => program.id)).to.deep.equal([2, 1])
      expect(descendingProgramPage.json().items.map((program: {id: number}) => program.id)).to.deep.equal([4])
      expect(mismatchedSort).to.have.property('statusCode', 400)
      expect(mismatchedSort.json()).to.include({code: 'invalid-cursor'})
      expect(malformedCursor).to.have.property('statusCode', 400)
      expect(firstRoutinePage.json().items.map((routine: {id: number}) => routine.id)).to.deep.equal([100])
      expect(secondRoutinePage.json().items.map((routine: {id: number}) => routine.id)).to.deep.equal([101])
      expect(descendingRoutinePage.json().items.map((routine: {id: number}) => routine.id)).to.deep.equal([101])
    } finally {
      await app.close()
    }
  })
})
