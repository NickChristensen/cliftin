import {HttpError} from './errors.js'

type CursorSortValue = null | number | string
type CursorSortValues = CursorSortValue | CursorSortValue[]

type DecodedCursor = {
  filter?: string
  id: number
  sort: string
  value: CursorSortValues
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

function isCursorSortValue(value: unknown): value is CursorSortValue {
  return value === null || typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))
}

function isCursorSortValues(value: unknown, expectedValueLength: number | undefined): value is CursorSortValues {
  if (expectedValueLength === undefined) return isCursorSortValue(value)
  return Array.isArray(value) && value.length === expectedValueLength && value.every(isCursorSortValue)
}

function compareCursorValues(left: CursorSortValues, right: CursorSortValues): number {
  if (!Array.isArray(left) && !Array.isArray(right)) return compareValues(left, right)
  if (!Array.isArray(left) || !Array.isArray(right) || left.length !== right.length) throw new Error('Cursor value shape does not match row value shape')

  for (let index = 0; index < left.length; index++) {
    const comparison = compareValues(left[index], right[index])
    if (comparison !== 0) return comparison
  }

  return 0
}

function decodeCursor(value: string | undefined, expectedSort: string, expectedFilter: string | undefined, expectedValueLength: number | undefined): DecodedCursor | undefined {
  if (!value) return undefined

  try {
    const decoded: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'))
    if (typeof decoded !== 'object' || decoded === null || Array.isArray(decoded)) throw new Error('Malformed cursor')

    const {filter, id, sort, value: sortValue} = decoded as Record<string, unknown>
    if (
      !Number.isSafeInteger(id) ||
      typeof sort !== 'string' ||
      sort !== expectedSort ||
      (filter !== undefined && typeof filter !== 'string') ||
      filter !== expectedFilter ||
      !isCursorSortValues(sortValue, expectedValueLength)
    ) {
      throw new Error('Malformed cursor')
    }

    return {filter: filter as string | undefined, id: id as number, sort, value: sortValue as CursorSortValues}
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
 * descending order; IDs are the final tie-breaker (ascending by default).
 */
export function paginateRows<Row extends CursorRow>(
  rows: Row[],
  options: {
    cursor?: string
    descending: boolean
    filter?: string
    idDescending?: boolean
    limit?: number
    sort: string
    value: (row: Row) => CursorSortValues
    valueLength?: number
  },
): {items: Row[]; nextCursor?: string} {
  const cursor = decodeCursor(options.cursor, options.sort, options.filter, options.valueLength)
  const direction = options.descending ? -1 : 1
  const compare = (left: Row, right: {id: number; value: CursorSortValues}): number => {
    const byValue = compareCursorValues(options.value(left), right.value) * direction
    return byValue || (left.id - right.id) * (options.idDescending ? -1 : 1)
  }

  rows.sort((left, right) => compare(left, {id: right.id, value: options.value(right)}))
  const eligible = cursor ? rows.filter((row) => compare(row, cursor) > 0) : rows
  const limit = options.limit ?? 50
  const items = eligible.slice(0, limit)
  const last = items.at(-1)

  return {
    items,
    ...(eligible.length > limit && last ? {nextCursor: encodeCursor({filter: options.filter, id: last.id, sort: options.sort, value: options.value(last)})} : {}),
  }
}
