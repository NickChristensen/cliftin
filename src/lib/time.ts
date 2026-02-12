import {endOfDay, formatISO, isAfter, isValid, parse, startOfDay} from 'date-fns'

const APPLE_EPOCH_UNIX_OFFSET_SECONDS = 978_307_200

export type DateFilterInput = {
  from?: string
  on?: string
  to?: string
}

export function appleSecondsToIso(value: null | number): null | string {
  if (value === null || value === undefined) return null

  return formatISO(appleSecondsToDate(value))
}

function parseLocalDate(value: string): Date {
  const date = parse(value, 'yyyy-MM-dd', new Date())
  if (!isValid(date)) {
    throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD.`)
  }

  // Guard against partial parse behavior; require exact YYYY-MM-DD roundtrip.
  if (formatISO(date, {representation: 'date'}) !== value) {
    throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD.`)
  }

  return date
}

function appleSecondsToDate(value: number): Date {
  return new Date((value + APPLE_EPOCH_UNIX_OFFSET_SECONDS) * 1000)
}

function dateToAppleSeconds(date: Date): number {
  return date.getTime() / 1000 - APPLE_EPOCH_UNIX_OFFSET_SECONDS
}

export function dateRangeToAppleSeconds(input: DateFilterInput): {from?: number; to?: number} {
  if (input.on) {
    const start = startOfDay(parseLocalDate(input.on))
    const end = endOfDay(start)

    return {
      from: dateToAppleSeconds(start),
      to: dateToAppleSeconds(end),
    }
  }

  const output: {from?: number; to?: number} = {}

  if (input.from) {
    const start = startOfDay(parseLocalDate(input.from))
    output.from = dateToAppleSeconds(start)
  }

  if (input.to) {
    const end = endOfDay(parseLocalDate(input.to))
    output.to = dateToAppleSeconds(end)
  }

  if (
    output.from !== undefined &&
    output.to !== undefined &&
    isAfter(appleSecondsToDate(output.from), appleSecondsToDate(output.to))
  ) {
    throw new Error('Invalid date range: --from must be before or equal to --to.')
  }

  return output
}
