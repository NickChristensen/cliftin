import {writeFile} from 'node:fs/promises'

import type {DbContext} from './lib/db.js'

import {buildApp} from './app.js'

// Route registration is schema-only. A real database is opened only by src/server.ts.
const schemaOnlyDb = {} as DbContext

async function main(): Promise<void> {
  const app = await buildApp({db: schemaOnlyDb})

  try {
    await app.ready()
    const document = app.swagger({yaml: false})

    const openapiVersion = (document as {openapi?: unknown}).openapi
    if (openapiVersion !== '3.1.2') {
      throw new Error(`Expected OpenAPI 3.1.2, received ${String(openapiVersion)}`)
    }

    if (!process.argv.includes('--validate')) {
      const outputPath = process.env.OPENAPI_OUTPUT ?? 'openapi.json'
      await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`)
    }
  } finally {
    await app.close()
  }
}

try {
  await main()
} catch (error) {
  console.error(error)
  process.exitCode = 1
}
