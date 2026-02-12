function toText(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  return String(value)
}

export function renderTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return '(no rows)'

  const columns = Object.keys(rows[0])
  const widths = new Map<string, number>()

  for (const column of columns) {
    widths.set(column, column.length)
  }

  for (const row of rows) {
    for (const column of columns) {
      const cell = toText(row[column])
      widths.set(column, Math.max(widths.get(column) ?? 0, cell.length))
    }
  }

  const header = columns.map((column) => column.padEnd(widths.get(column) ?? column.length)).join('  ')
  const separator = columns.map((column) => '-'.repeat(widths.get(column) ?? column.length)).join('  ')
  const body = rows.map((row) => columns.map((column) => toText(row[column]).padEnd(widths.get(column) ?? column.length)).join('  '))

  return [header, separator, ...body].join('\n')
}

export function printJson(log: (line: string) => void, value: unknown): void {
  log(JSON.stringify(value, null, 2))
}
