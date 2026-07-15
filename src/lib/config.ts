import dotenv from 'dotenv'
import {accessSync, constants} from 'node:fs'
import {resolve} from 'node:path'

let loaded = false

export function loadEnv(): void {
  if (loaded) return
  dotenv.config({path: resolve(process.cwd(), '.env.local'), quiet: true})
  loaded = true
}

export function getDbPath(env: NodeJS.ProcessEnv = process.env): string {
  loadEnv()

  const path = env.LIFTIN_DB_PATH
  if (!path) {
    throw new Error('LIFTIN_DB_PATH is required')
  }

  try {
    accessSync(path, constants.R_OK)
  } catch {
    throw new Error(`Database file is not readable at path=${path}`)
  }

  return path
}
