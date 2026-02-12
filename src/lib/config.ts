import dotenv from 'dotenv'
import {accessSync, constants} from 'node:fs'
import {resolve} from 'node:path'

let loaded = false

function loadEnv(): void {
  if (loaded) return
  dotenv.config({path: resolve(process.cwd(), '.env.local'), quiet: true})
  loaded = true
}

export function getDbPath(): string {
  loadEnv()

  const path = process.env.LIFTIN_DB_PATH
  if (!path) {
    throw new Error(
      'Missing LIFTIN_DB_PATH. Add it to .env.local, for example: LIFTIN_DB_PATH=/Users/nick/code/cliftin/data/BelloDataModel.sqlite',
    )
  }

  try {
    accessSync(path, constants.R_OK)
  } catch {
    throw new Error(`Database file is not readable at LIFTIN_DB_PATH=${path}`)
  }

  return path
}
