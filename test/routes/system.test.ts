import {expect} from 'chai'
import Database from 'better-sqlite3'

import {buildApp} from '../../src/app.js'
import {closeDb, openDb} from '../../src/lib/db.js'
import {readServerConfig} from '../../src/server.js'
import {createTestDb} from '../support/db.js'

describe('system routes', () => {
  const dbPath = createTestDb()

  async function createApp(path = dbPath) {
    const db = openDb(path)
    return buildApp({closeDb: () => closeDb(db), db})
  }

  it('returns healthy when a read-only database query succeeds', async () => {
    const app = await createApp()
    try {
      const response = await app.inject({method: 'GET', url: '/health'})

      expect(response.statusCode).to.equal(200)
      expect(response.json()).to.deep.equal({status: 'ok'})
    } finally {
      await app.close()
    }
  })

  it('returns healthy for an empty database with the Liftin schema', async () => {
    const emptyDbPath = createTestDb()
    const writer = new Database(emptyDbPath)
    for (const table of [
      'Z_12ROUTINES',
      'ZEQUIPMENT2',
      'ZEXERCISECONFIGURATION',
      'ZEXERCISEINFORMATION',
      'ZEXERCISERESULT',
      'ZGYMSETRESULT',
      'ZPERIOD',
      'ZROUTINE',
      'ZSETCONFIGURATION',
      'ZWORKOUTPLAN',
      'ZWORKOUTPROGRAMSINFO',
      'ZWORKOUTRESULT',
    ]) {
      writer.prepare(`delete from "${table}"`).run()
    }
    writer.close()

    const app = await createApp(emptyDbPath)
    try {
      const response = await app.inject({method: 'GET', url: '/health'})

      expect(response.statusCode).to.equal(200)
      expect(response.json()).to.deep.equal({status: 'ok'})
    } finally {
      await app.close()
    }
  })

  it('returns the generated OpenAPI 3.1.2 document', async () => {
    const app = await createApp()
    try {
      const response = await app.inject({method: 'GET', url: '/openapi.json'})
      const document = response.json()

      expect(response.statusCode).to.equal(200)
      expect(document.openapi).to.equal('3.1.2')
      expect(document.paths).to.have.property('/health')
    } finally {
      await app.close()
    }
  })

  it('rejects unknown query parameters instead of silently stripping them', async () => {
    const app = await createApp()
    try {
      const response = await app.inject({method: 'GET', url: '/health?unexpected=true'})

      expect(response.statusCode).to.equal(400)
      expect(response.json()).to.include({code: 'invalid-request', message: 'Request validation failed', status: 400})
    } finally {
      await app.close()
    }
  })

  it('reports database-unavailable when the health query fails', async () => {
    const db = {
      sqlite: {
        prepare() {
          throw new Error('database is closed')
        },
      },
    }
    const app = await buildApp({db: db as never})
    try {
      const response = await app.inject({method: 'GET', url: '/health'})

      expect(response.statusCode).to.equal(503)
      expect(response.json()).to.deep.equal({
        code: 'database-unavailable',
        message: 'Database is unavailable',
        status: 503,
      })
    } finally {
      await app.close()
    }
  })

  it('requires LIFTIN_DB_PATH and TZ at startup', () => {
    expect(() => readServerConfig({})).to.throw('TZ is required')
    expect(() => readServerConfig({TZ: 'not-a-timezone'})).to.throw('TZ must be a valid IANA timezone')
    expect(() => readServerConfig({TZ: 'America/Chicago'})).to.throw('LIFTIN_DB_PATH is required')
  })

  it('uses PORT 3000 by default', () => {
    expect(readServerConfig({LIFTIN_DB_PATH: dbPath, TZ: 'America/Chicago'})).to.deep.equal({dbPath, port: 3000})
  })
})
