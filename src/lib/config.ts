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

  const defaultPath = `${process.env.HOME}/Library/Containers/com.nstrm.Bello/Data/Library/Application Support/Liftin/BelloDataModel.sqlite`
  const path = process.env.LIFTIN_DB_PATH ?? defaultPath

  try {
    accessSync(path, constants.R_OK)
  } catch {
    throw new Error(`Database file is not readable at path=${path}`)
  }

  return path
}
