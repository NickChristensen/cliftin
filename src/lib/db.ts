import Database from 'better-sqlite3'
import {Kysely, SqliteDialect} from 'kysely'

import {getDbPath} from './config.js'

export interface DatabaseSchema {
  Z_12ROUTINES: {
    Z_12EXERCISES: number
    Z_28ROUTINES: number
    Z_FOK_12EXERCISES: null | number
  }
  ZEQUIPMENT2: {
    Z_PK: number
    ZID: null | string
    ZNAME: null | string
  }
  ZEXERCISECONFIGURATION: {
    Z_PK: number
    ZINFORMATION: null | number
    ZREPS: null | number
    ZSETS: null | number
    ZTIME: null | number
    ZUSEINDIVIDUALSETS: null | number
    ZWEIGHT: null | number
  }
  ZEXERCISEINFORMATION: {
    Z_PK: number
    ZALTERNATIVEENGLISHNAMES: null | string
    ZDEFAULTPROGRESSMETRIC: null | string
    ZEQUIPMENT: null | number
    ZISUSERCREATED: null | number
    ZMUSCLES: null | string
    ZNAME: null | string
    ZPERCEPTIONSCALE: null | string
    ZSECONDARYMUSCLES: null | string
    ZSOFTDELETED: null | number
    ZSUPPORTSONEREPMAX: null | number
    ZTIMERBASED: null | number
  }
  ZEXERCISERESULT: {
    Z_FOK_WORKOUT: null | number
    Z_PK: number
    ZEXERCISE: null | number
    ZWORKOUT: null | number
  }
  ZGYMSETRESULT: {
    Z_FOK_EXERCISE: null | number
    Z_PK: number
    ZEXERCISE: null | number
    ZREPS: null | number
    ZRPE: null | number
    ZTIME: null | number
    ZVOLUME: null | number
    ZWARMUPSET: null | number
    ZWEIGHT: null | number
  }
  ZPERIOD: {
    Z_FOK_WORKOUTPLAN: null | number
    Z_PK: number
    ZWORKOUTPLAN: null | number
  }
  ZROUTINE: {
    Z_FOK_PERIOD: null | number
    Z_PK: number
    ZNAME: null | string
    ZPERIOD: null | number
    ZSOFTDELETED: null | number
    ZUPNEXT: null | number
    ZWORKOUTPLAN: null | number
  }
  ZSETCONFIGURATION: {
    Z_PK: number
    ZEXERCISECONFIGURATION: null | number
    ZREPS: null | number
    ZRPE: null | number
    ZSETINDEX: null | number
    ZTIME: null | number
    ZWEIGHT: null | number
  }
  ZWORKOUTPLAN: {
    Z_PK: number
    ZDATEADDED: null | number
    ZID: Buffer | null
    ZISCURRENT: null | number
    ZISTEMPLATE: null | number
    ZNAME: null | string
    ZSOFTDELETED: null | number
  }
  ZWORKOUTPROGRAMSINFO: {
    ZSELECTEDWORKOUTPROGRAMID: Buffer | null
  }
  ZWORKOUTRESULT: {
    Z_PK: number
    ZDURATION: null | number
    ZROUTINE: null | number
    ZROUTINENAME: null | string
    ZSTARTDATE: null | number
  }
}

export type DbContext = {
  db: Kysely<DatabaseSchema>
  sqlite: Database.Database
}

/**
 * Columns used by the API. Checking these at open time prevents a readable
 * SQLite file (for example, an empty database created by mistake) from being
 * treated as a valid Liftin export and failing later on the first route call.
 */
const REQUIRED_LIFTIN_SCHEMA: Readonly<Record<keyof DatabaseSchema, readonly string[]>> = {
  Z_12ROUTINES: ['Z_12EXERCISES', 'Z_28ROUTINES', 'Z_FOK_12EXERCISES'],
  ZEQUIPMENT2: ['Z_PK', 'ZID', 'ZNAME'],
  ZEXERCISECONFIGURATION: ['Z_PK', 'ZINFORMATION', 'ZREPS', 'ZSETS', 'ZTIME', 'ZUSEINDIVIDUALSETS', 'ZWEIGHT'],
  ZEXERCISEINFORMATION: [
    'Z_PK',
    'ZALTERNATIVEENGLISHNAMES',
    'ZDEFAULTPROGRESSMETRIC',
    'ZEQUIPMENT',
    'ZISUSERCREATED',
    'ZMUSCLES',
    'ZNAME',
    'ZPERCEPTIONSCALE',
    'ZSECONDARYMUSCLES',
    'ZSOFTDELETED',
    'ZSUPPORTSONEREPMAX',
    'ZTIMERBASED',
  ],
  ZEXERCISERESULT: ['Z_FOK_WORKOUT', 'Z_PK', 'ZEXERCISE', 'ZWORKOUT'],
  ZGYMSETRESULT: ['Z_FOK_EXERCISE', 'Z_PK', 'ZEXERCISE', 'ZREPS', 'ZRPE', 'ZTIME', 'ZVOLUME', 'ZWARMUPSET', 'ZWEIGHT'],
  ZPERIOD: ['Z_FOK_WORKOUTPLAN', 'Z_PK', 'ZWORKOUTPLAN'],
  ZROUTINE: ['Z_FOK_PERIOD', 'Z_PK', 'ZNAME', 'ZPERIOD', 'ZSOFTDELETED', 'ZUPNEXT', 'ZWORKOUTPLAN'],
  ZSETCONFIGURATION: ['Z_PK', 'ZEXERCISECONFIGURATION', 'ZREPS', 'ZRPE', 'ZSETINDEX', 'ZTIME', 'ZWEIGHT'],
  ZWORKOUTPLAN: ['Z_PK', 'ZDATEADDED', 'ZID', 'ZISCURRENT', 'ZISTEMPLATE', 'ZNAME', 'ZSOFTDELETED'],
  ZWORKOUTPROGRAMSINFO: ['ZSELECTEDWORKOUTPROGRAMID'],
  ZWORKOUTRESULT: ['Z_PK', 'ZDURATION', 'ZROUTINE', 'ZROUTINENAME', 'ZSTARTDATE'],
}

type TableInfoRow = {name: string}

function assertLiftinSchema(sqlite: Database.Database, path: string): void {
  const missing: string[] = []

  for (const [table, columns] of Object.entries(REQUIRED_LIFTIN_SCHEMA)) {
    const tableInfo = sqlite.prepare(`PRAGMA table_info("${table}")`).all() as TableInfoRow[]
    const present = new Set(tableInfo.map((column) => column.name))

    if (tableInfo.length === 0) {
      missing.push(`table ${table}`)
      continue
    }

    for (const column of columns) {
      if (!present.has(column)) missing.push(`column ${table}.${column}`)
    }
  }

  if (missing.length > 0) {
    throw new Error(`Database at ${path} is not a compatible Liftin database; missing ${missing.join(', ')}`)
  }
}

/**
 * Runs related reads against one SQLite snapshot. SQLite's plain `BEGIN`
 * transaction is deferred, so it does not acquire a lock until the first
 * query while ensuring every subsequent query observes that same snapshot.
 */
export async function withDeferredReadTransaction<T>(
  db: Kysely<DatabaseSchema>,
  operation: (transaction: Kysely<DatabaseSchema>) => Promise<T>,
): Promise<T> {
  return db.transaction().execute(operation)
}

export function openDb(path = getDbPath()): DbContext {
  const sqlite = new Database(path, {fileMustExist: true, readonly: true})
  try {
    sqlite.pragma('query_only = ON')
    assertLiftinSchema(sqlite, path)
  } catch (error) {
    sqlite.close()
    throw error
  }
  const db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({database: sqlite}),
  })

  return {db, sqlite}
}

export async function closeDb(context: DbContext): Promise<void> {
  await context.db.destroy()
  context.sqlite.close()
}
