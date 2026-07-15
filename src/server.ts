import {fileURLToPath} from 'node:url'

import {buildApp} from './app.js'
import {getDbPath, loadEnv} from './lib/config.js'
import {closeDb, openDb} from './lib/db.js'

export type ServerConfig = {
  dbPath: string
  port: number
}

export function readServerConfig(env = process.env): ServerConfig {
  loadEnv()

  if (!env.TZ) {
    throw new Error('TZ is required')
  }

  try {
    new Intl.DateTimeFormat('en-US', {timeZone: env.TZ}).format()
  } catch {
    throw new Error(`TZ must be a valid IANA timezone; received ${env.TZ}`)
  }

  const dbPath = getDbPath(env)
  const portText = env.PORT ?? '3000'
  const port = Number(portText)
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error(`PORT must be an integer between 1 and 65535; received ${portText}`)
  }

  return {dbPath, port}
}

export async function startServer(config = readServerConfig()): Promise<Awaited<ReturnType<typeof buildApp>>> {
  const db = openDb(config.dbPath)
  const app = await buildApp({closeDb: () => closeDb(db), db})

  try {
    await app.listen({host: '0.0.0.0', port: config.port})
  } catch (error) {
    await app.close()
    throw error
  }

  const shutdown = async (): Promise<void> => {
    await app.close()
  }

  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
  return app
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await startServer()
  } catch (error) {
    console.error(error)
    process.exitCode = 1
  }
}
