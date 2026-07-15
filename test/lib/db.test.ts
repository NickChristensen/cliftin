import {expect} from 'chai'
import Database from 'better-sqlite3'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'

import {closeDb, openDb, withDeferredReadTransaction} from '../../src/lib/db.js'
import {createTestDb} from '../support/db.js'

describe('withDeferredReadTransaction', () => {
  it('keeps all reads in an assembled response on the first query snapshot', async () => {
    const dbPath = createTestDb()
    const writer = new Database(dbPath)
    writer.pragma('journal_mode = WAL')
    const reader = openDb(dbPath)

    try {
      const names = await withDeferredReadTransaction(reader.db, async (transaction) => {
        const before = await transaction
          .selectFrom('ZWORKOUTPLAN')
          .select('ZNAME as name')
          .where('Z_PK', '=', 1)
          .executeTakeFirstOrThrow()

        writer.prepare('update ZWORKOUTPLAN set ZNAME = ? where Z_PK = ?').run('Changed by Liftin', 1)

        const after = await transaction
          .selectFrom('ZWORKOUTPLAN')
          .select('ZNAME as name')
          .where('Z_PK', '=', 1)
          .executeTakeFirstOrThrow()

        return {after: after.name, before: before.name}
      })

      expect(names).to.deep.equal({after: 'Active Program', before: 'Active Program'})
      const current = await reader.db
        .selectFrom('ZWORKOUTPLAN')
        .select('ZNAME as name')
        .where('Z_PK', '=', 1)
        .executeTakeFirstOrThrow()
      expect(current.name).to.equal('Changed by Liftin')
    } finally {
      await closeDb(reader)
      writer.close()
    }
  })
})

describe('openDb', () => {
  it('rejects a readable SQLite file that is not a Liftin database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'cliftin-test-'))
    const dbPath = join(dir, 'empty.sqlite')
    const sqlite = new Database(dbPath)
    sqlite.close()

    expect(() => openDb(dbPath)).to.throw(
      `Database at ${dbPath} is not a compatible Liftin database; missing table Z_12ROUTINES`,
    )
  })
})
