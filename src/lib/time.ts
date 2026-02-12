const APPLE_EPOCH_UNIX_OFFSET_SECONDS = 978_307_200

export type DateFilterInput = {
  from?: string
  on?: string
  to?: string
}

export function appleSecondsToIso(value: null | number): null | string {
  if (value === null || value === undefined) return null

  const unixMilliseconds = (value + APPLE_EPOCH_UNIX_OFFSET_SECONDS) * 1000
  return new Date(unixMilliseconds).toISOString()
}

function parseLocalDate(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    throw new Error(`Invalid date format: ${value}. Use YYYY-MM-DD.`)
  }

  const [, yearText, monthText, dayText] = match
  const year = Number(yearText)
  const month = Number(monthText) - 1
  const day = Number(dayText)
  return new Date(year, month, day)
}

function dateToAppleSeconds(date: Date): number {
  return date.getTime() / 1000 - APPLE_EPOCH_UNIX_OFFSET_SECONDS
}

export function dateRangeToAppleSeconds(input: DateFilterInput): {from?: number; to?: number} {
  if (input.on) {
    const start = parseLocalDate(input.on)
    const end = new Date(start)
    end.setHours(23, 59, 59, 999)

    return {
      from: dateToAppleSeconds(start),
      to: dateToAppleSeconds(end),
    }
  }

  const output: {from?: number; to?: number} = {}

  if (input.from) {
    const start = parseLocalDate(input.from)
    output.from = dateToAppleSeconds(start)
  }

  if (input.to) {
    const end = parseLocalDate(input.to)
    end.setHours(23, 59, 59, 999)
    output.to = dateToAppleSeconds(end)
  }

  if (output.from !== undefined && output.to !== undefined && output.from > output.to) {
    throw new Error('Invalid date range: --from must be before or equal to --to.')
  }

  return output
}
