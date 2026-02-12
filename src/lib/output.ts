import {format, isValid, parseISO} from 'date-fns'
import Table from 'tty-table'

type TableFormatterContext = {
  style: (...args: string[]) => string
}

type TableFormatter = (this: TableFormatterContext, cellValue: unknown) => string

function formatDateString(value: string, dateFormat: string): null | string {
  const parsed = parseISO(value)
  if (!isValid(parsed)) return null
  return format(parsed, dateFormat)
}

function valueFormatter(this: TableFormatterContext, cellValue: unknown, dateFormat: string): string {
  if (cellValue === null || cellValue === undefined) return ''

  if (typeof cellValue === 'string') {
    const formattedDate = formatDateString(cellValue, dateFormat)
    if (formattedDate) return this.style(String(formattedDate), 'magenta')
    return cellValue
  }

  if (typeof cellValue === 'number') return this.style(String(cellValue), 'blue')

  if (typeof cellValue === 'boolean') {
    return cellValue ? this.style('✔︎', 'green', 'bold') : this.style('×', 'red', 'bold')
  }

  return this.style(JSON.stringify(cellValue), 'yellow')
}

export const createValueFormatter = (dateFormat: string): TableFormatter =>
  function (this: TableFormatterContext, cellValue: unknown): string {
    return valueFormatter.call(this, cellValue, dateFormat)
  }

function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function renderTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '(no rows)'

  const keys = Object.keys(rows[0])
  const orderedKeys = keys.includes('id')
    ? ['id', ...keys.filter((key) => key !== 'id')]
    : keys
  const widths = new Map<string, number>()
  const formatter = createValueFormatter('yyyy-MM-dd HH:mm')

  const normalizedRows = rows.map((row) => {
    const output: Record<string, unknown> = {}
    for (const key of orderedKeys) {
      const raw = row[key]
      const text = toText(raw)
      output[key] = raw
      widths.set(key, Math.max(widths.get(key) ?? key.length, text.length))
    }

    return output
  })

  const columns = orderedKeys.map((key) => ({
    alias: key,
    align: 'left',
    formatter,
    headerAlign: 'left',
    value: key,
    width: (widths.get(key) ?? key.length) + 2,
  }))

  // eslint-disable-next-line new-cap
  return Table(columns, normalizedRows, {
    borderStyle: 'solid',
    compact: true,
    width: 'auto',
  }).render()
}

export function printJson(log: (line: string) => void, value: unknown): void {
  log(JSON.stringify(value, null, 2))
}
