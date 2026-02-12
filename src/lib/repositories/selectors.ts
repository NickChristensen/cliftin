import {Kysely, sql} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {IdName} from '../types.js'

function isNumeric(value: string): boolean {
  return /^\d+$/.test(value)
}

function renderCandidateList(candidates: IdName[]): string {
  return candidates.map((candidate) => `${candidate.id}:${candidate.name}`).join(', ')
}

const asIdName = (rows: Array<{id: number; name: null | string}>): IdName[] =>
  rows.map((row) => ({id: row.id, name: row.name ?? '(unnamed)'}))

export async function resolveIdOrName(
  db: Kysely<DatabaseSchema>,
  table: 'ZEXERCISEINFORMATION' | 'ZROUTINE' | 'ZWORKOUTPLAN',
  selector: string,
): Promise<number> {
  if (isNumeric(selector)) return Number(selector)

  const exact = await db
    .selectFrom(table)
    .select(['Z_PK as id', 'ZNAME as name'])
    .where(sql<boolean>`lower(ZNAME) = ${selector.toLowerCase()}`)
    .execute()

  if (exact.length === 1) return exact[0].id

  if (exact.length > 1) {
    const candidates = asIdName(exact)
    throw new Error(`Selector "${selector}" is ambiguous: ${renderCandidateList(candidates)}`)
  }

  const partial = await db
    .selectFrom(table)
    .select(['Z_PK as id', 'ZNAME as name'])
    .where(sql<boolean>`lower(ZNAME) like ${`%${selector.toLowerCase()}%`}`)
    .execute()

  if (partial.length === 1) return partial[0].id

  if (partial.length > 1) {
    const candidates = asIdName(partial)
    throw new Error(`Selector "${selector}" is ambiguous: ${renderCandidateList(candidates)}`)
  }

  throw new Error(`No records found for selector: ${selector}`)
}
