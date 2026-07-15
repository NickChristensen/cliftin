import {TypeBoxTypeProvider, TypeBoxValidatorCompiler} from '@fastify/type-provider-typebox'
import Database from 'better-sqlite3'
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

  async function createApp(path = dbPath) {
    registerFormats()
    const db = openDb(path)
    const app = Fastify().withTypeProvider<TypeBoxTypeProvider>()
    app.setValidatorCompiler(TypeBoxValidatorCompiler)
    app.decorate('db', db)
    registerErrorHandlers(app)
    await app.register(workoutRoutes)
    await app.register(exerciseRoutes)
    app.addHook('onClose', () => closeDb(db))
    return app
  }

  function captureReadStatements(sqlite: Database.Database) {
    const statements: Array<{parameters: unknown[]; sql: string}> = []
    const prepare = sqlite.prepare.bind(sqlite)
    sqlite.prepare = ((source: string) => {
      const statement = prepare(source)
      return new Proxy(statement, {
        get(target, property) {
          if (property === 'all') {
            return (...parameters: unknown[]) => {
              statements.push({parameters, sql: source})
              return Reflect.apply(target.all, target, parameters)
            }
          }
          const value = Reflect.get(target, property)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
    }) as typeof sqlite.prepare
    return statements
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

  it('paginates exercise performances in SQL before hydrating the selected page', async () => {
    const app = await createApp()
    try {
      const statements = captureReadStatements(app.db.sqlite)
      const firstPage = await app.inject({method: 'GET', url: '/v1/exercises/1000/performances?limit=1'})
      const setReads = statements.filter((statement) => statement.sql.includes('from "ZGYMSETRESULT"'))

      expect(firstPage.statusCode).to.equal(200)
      expect(firstPage.json().items.map((item: {id: number}) => item.id)).to.deep.equal([5001])
      expect(firstPage.json().nextCursor).to.be.a('string')
      expect(setReads).to.have.length(1)
      expect(setReads[0].sql).to.match(/"ZEXERCISE" in \(\?\)/)
      expect(setReads[0].parameters.flat()).to.deep.equal([5001])

      const nextPage = await app.inject({method: 'GET', url: `/v1/exercises/1000/performances?limit=1&cursor=${firstPage.json().nextCursor}`})
      const ascending = await app.inject({method: 'GET', url: '/v1/exercises/1000/performances?sort=startedAt&limit=1'})
      const nextAscending = await app.inject({method: 'GET', url: `/v1/exercises/1000/performances?sort=startedAt&limit=1&cursor=${ascending.json().nextCursor}`})
      expect(nextPage.statusCode).to.equal(200)
      expect(nextPage.json().items.map((item: {id: number}) => item.id)).to.deep.equal([5000])
      expect(nextPage.json()).to.not.have.property('nextCursor')
      expect(ascending.statusCode).to.equal(200)
      expect(ascending.json().items.map((item: {id: number}) => item.id)).to.deep.equal([5000])
      expect(nextAscending.statusCode).to.equal(200)
      expect(nextAscending.json().items.map((item: {id: number}) => item.id)).to.deep.equal([5001])
    } finally {
      await app.close()
    }
  })

  it('cursor-paginates null and non-null timestamps without omissions or duplicates', async () => {
    const nullableDbPath = createTestDb()
    const fixtureDb = new Database(nullableDbPath)
    fixtureDb.prepare('insert into ZWORKOUTRESULT values (?, ?, ?, ?, ?)').run(4002, 100, 'Day A', null, 3400)
    fixtureDb.prepare('insert into ZWORKOUTRESULT values (?, ?, ?, ?, ?)').run(4003, 100, 'Day A', null, 3300)
    fixtureDb.prepare('insert into ZWORKOUTRESULT values (?, ?, ?, ?, ?)').run(4004, 100, 'Day A', 700000100, 3200)
    fixtureDb.prepare('insert into ZEXERCISERESULT values (?, ?, ?, ?, ?)').run(5005, 4002, 2000, 1000, 300)
    fixtureDb.prepare('insert into ZEXERCISERESULT values (?, ?, ?, ?, ?)').run(5006, 4003, 2000, 1000, 400)
    fixtureDb.prepare('insert into ZEXERCISERESULT values (?, ?, ?, ?, ?)').run(5007, 4004, 2000, 1000, 500)
    fixtureDb.close()

    const app = await createApp(nullableDbPath)
    try {
      async function allPageIds(url: string): Promise<number[]> {
        const ids: number[] = []
        let cursor: string | undefined
        do {
          const response = await app.inject({method: 'GET', url: `${url}&limit=1${cursor === undefined ? '' : `&cursor=${cursor}`}`})
          expect(response.statusCode, response.body).to.equal(200)
          const page = response.json()
          ids.push(...page.items.map((item: {id: number}) => item.id))
          cursor = page.nextCursor
        } while (cursor !== undefined)
        return ids
      }

      const descendingWorkouts = await allPageIds('/v1/workouts?sort=-startedAt')
      const ascendingWorkouts = await allPageIds('/v1/workouts?sort=startedAt')
      const descendingPerformances = await allPageIds('/v1/exercises/1000/performances?sort=-startedAt')
      const ascendingPerformances = await allPageIds('/v1/exercises/1000/performances?sort=startedAt')

      expect(descendingWorkouts).to.deep.equal([4001, 4004, 4000, 4003, 4002])
      expect(ascendingWorkouts).to.deep.equal([4002, 4003, 4000, 4004, 4001])
      expect(descendingPerformances).to.deep.equal([5001, 5007, 5000, 5006, 5005])
      expect(ascendingPerformances).to.deep.equal([5005, 5006, 5000, 5007, 5001])
      expect(new Set(descendingWorkouts)).to.have.length(descendingWorkouts.length)
      expect(new Set(ascendingWorkouts)).to.have.length(ascendingWorkouts.length)
      expect(new Set(descendingPerformances)).to.have.length(descendingPerformances.length)
      expect(new Set(ascendingPerformances)).to.have.length(ascendingPerformances.length)
    } finally {
      await app.close()
    }
  })

  it('computes exercise statistics with SQL aggregates without hydrating performance sets', async () => {
    const app = await createApp()
    try {
      const statements = captureReadStatements(app.db.sqlite)
      const statistics = await app.inject({method: 'GET', url: '/v1/exercises/1000/statistics?minReps=6&unit=kg'})
      const setReads = statements.filter((statement) => statement.sql.includes('from "ZGYMSETRESULT"'))

      expect(statistics.statusCode, statistics.body).to.equal(200)
      expect(statistics.json()).to.include({performanceCount: 1, setCount: 1, topReps: 6, totalReps: 6, workoutCount: 1})
      expect(statistics.json().topWeight).to.deep.equal({unit: 'kg', value: 105})
      expect(statistics.json().volume).to.deep.equal({unit: 'kg', value: 630})
      expect(setReads).to.deep.equal([])
    } finally {
      await app.close()
    }
  })

  it('finds a derived parenthetical exercise display name without normalizing unrelated punctuation', async () => {
    const searchDbPath = createTestDb()
    const fixtureDb = new Database(searchDbPath)
    fixtureDb.prepare(`
      insert into ZEXERCISEINFORMATION (
        Z_PK, ZNAME, ZMUSCLES, ZSECONDARYMUSCLES, ZEQUIPMENT, ZTIMERBASED,
        ZSUPPORTSONEREPMAX, ZISUSERCREATED, ZSOFTDELETED,
        ZDEFAULTPROGRESSMETRIC, ZPERCEPTIONSCALE
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(1004, 'chin_up_weighted', 'back', 'biceps', null, 0, 1, 0, 0, 'maxWeight', 'rpe')
    fixtureDb.close()

    const app = await createApp(searchDbPath)
    try {
      const friendlyName = await app.inject({method: 'GET', url: '/v1/exercises?q=Chin%20Up%20%28Weighted%29'})
      const unrelatedPunctuation = await app.inject({method: 'GET', url: '/v1/exercises?q=Chin%20Up%20%5BWeighted%5D'})

      expect(friendlyName.statusCode).to.equal(200)
      expect(friendlyName.json().items.find((item: {id: number}) => item.id === 1004)).to.include({id: 1004, name: 'Chin Up (Weighted)'})
      expect(unrelatedPunctuation.json().items).to.deep.equal([])
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
