import {FormatRegistry} from '@sinclair/typebox'

const fullDate = /^\d{4}-\d{2}-\d{2}$/
const rfc3339DateTime = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

export function registerFormats(): void {
  if (!FormatRegistry.Has('date')) FormatRegistry.Set('date', (value) => fullDate.test(value))
  if (!FormatRegistry.Has('date-time')) FormatRegistry.Set('date-time', (value) => rfc3339DateTime.test(value))
}
