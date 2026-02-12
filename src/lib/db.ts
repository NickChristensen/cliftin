import Database from 'better-sqlite3'
import {Kysely, SqliteDialect} from 'kysely'

import {getDbPath} from './config.js'

export interface DatabaseSchema {
  Z_12ROUTINES: {
    Z_12EXERCISES: number
    Z_28ROUTINES: number
  }
  ZEQUIPMENT2: {
    Z_PK: number
    ZNAME: null | string
  }
  ZEXERCISECONFIGURATION: {
    Z_PK: number
    ZINFORMATION: null | number
    ZREPS: null | number
    ZSETS: null | number
    ZTIME: null | number
    ZWEIGHT: null | number
  }
  ZEXERCISEINFORMATION: {
    Z_PK: number
    ZDEFAULTPROGRESSMETRIC: null | string
    ZEQUIPMENT: null | number
    ZMUSCLES: null | string
    ZNAME: null | string
    ZPERCEPTIONSCALE: null | string
    ZSECONDARYMUSCLES: null | string
    ZSOFTDELETED: null | number
    ZSUPPORTSONEREPMAX: null | number
    ZTIMERBASED: null | number
  }
  ZEXERCISERESULT: {
    Z_PK: number
    ZCONFIGURATION: null | number
    ZWORKOUT: null | number
  }
  ZGYMSETRESULT: {
    Z_PK: number
    ZEXERCISE: null | number
    ZREPS: null | number
    ZRPE: null | number
    ZTIME: null | number
    ZVOLUME: null | number
    ZWEIGHT: null | number
  }
  ZPERIOD: {
    Z_FOK_WORKOUTPLAN: null | number
    Z_PK: number
    ZWORKOUTPLAN: null | number
  }
  ZROUTINE: {
    Z_PK: number
    ZNAME: null | string
    ZPERIOD: null | number
    ZSOFTDELETED: null | number
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
    Z_PK: number
    ZSECONDARYWORKOUTPROGRAMID: Buffer | null
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

export function openDb(): DbContext {
  const path = getDbPath()
  const sqlite = new Database(path, {fileMustExist: true, readonly: true})
  const db = new Kysely<DatabaseSchema>({
    dialect: new SqliteDialect({database: sqlite}),
  })

  return {db, sqlite}
}

export async function closeDb(context: DbContext): Promise<void> {
  await context.db.destroy()
  context.sqlite.close()
}
