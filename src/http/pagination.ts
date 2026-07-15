import {HttpError} from './errors.js'

type CursorSortValue = null | number | string

type DecodedCursor = {
  id: number
  sort: string
  value: CursorSortValue
}

type CursorRow = {
  id: number
}

function compareValues(left: CursorSortValue, right: CursorSortValue): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return typeof left === 'number' && typeof right === 'number' ? left - right : String(left).localeCompare(String(right))
}

function decodeCursor(value: string | undefined, expectedSort: string): DecodedCursor | undefined {
  if (!value) return undefined

  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error('Malformed cursor')

    const {id, sort, value: sortValue} = decoded as Record<string, unknown>
    if (
      !Number.isSafeInteger(id) ||
      typeof sort !== 'string' ||
      sort !== expectedSort ||
      !(sortValue === null || typeof sortValue === 'string' || (typeof sortValue === 'number' && Number.isFinite(sortValue)))
    ) {
      throw new Error('Malformed cursor')
    }

    return {id: id as number, sort, value: sortValue as CursorSortValue}
  } catch {
    throw new HttpError(400, 'invalid-cursor', 'Cursor is invalid')
  }
}

function encodeCursor(cursor: DecodedCursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

/**
 * Applies stable, opaque cursor pagination after a route has materialized its
 * filtered rows. Null values sort first in ascending order and last in
 * descending order; IDs are always the final ascending tie-breaker.
 */
export function paginateRows<Row extends CursorRow>(
  rows: Row[],
  options: {
    cursor?: string
    descending: boolean
    limit?: number
    sort: string
    value: (row: Row) => CursorSortValue
  },
): {items: Row[]; nextCursor?: string} {
  const cursor = decodeCursor(options.cursor, options.sort)
  const direction = options.descending ? -1 : 1
  const compare = (left: Row, right: {id: number; value: CursorSortValue}): number => {
    const byValue = compareValues(options.value(left), right.value) * direction
    return byValue || left.id - right.id
  }

  rows.sort((left, right) => compare(left, {id: right.id, value: options.value(right)}))
  const eligible = cursor ? rows.filter((row) => compare(row, cursor) > 0) : rows
  const limit = options.limit ?? 50
  const items = eligible.slice(0, limit)
  const last = items.at(-1)

  return {
    items,
    ...(eligible.length > limit && last ? {nextCursor: encodeCursor({id: last.id, sort: options.sort, value: options.value(last)})} : {}),
  }
}
