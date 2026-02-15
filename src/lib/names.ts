const PARENTHETICAL_SUFFIXES = new Set(['assisted', 'weighted'])
const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function toTitleWord(word: string): string {
  return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
}

export function formatIdentifierTitleCase(value: string): string {
  const spaced = value
    .replaceAll(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replaceAll('-', ' ')
    .replaceAll(/\s+/g, ' ')
    .trim()

  if (!spaced) return ''
  return spaced
    .split(' ')
    .map((word) => toTitleWord(word))
    .join(' ')
}

export function formatMuscleLabel(value: null | string): null | string {
  if (!value) return null

  const formatted = value
    .split(/([^a-zA-Z0-9]+)/)
    .map((part) => (/^[a-zA-Z0-9]+$/.test(part) ? formatIdentifierTitleCase(part) : part))
    .join('')

  return formatted.replaceAll(/\s*,\s*/g, ', ')
}

function isLocalizationKey(value: string): boolean {
  const normalized = value.trim().toLowerCase()
  return normalized.includes(':') || normalized.endsWith('_name')
}

function isUuidLike(value: string): boolean {
  return UUID_LIKE.test(value.trim())
}

export function formatEquipmentDisplayName(zName: null | string, zId: null | string): null | string {
  const name = zName?.trim() ?? ''
  const id = zId?.trim() ?? ''

  if (name && !isLocalizationKey(name)) {
    return formatIdentifierTitleCase(name)
  }

  if (id && !isUuidLike(id)) {
    return formatIdentifierTitleCase(id)
  }

  if (name) return formatIdentifierTitleCase(name)
  if (id) return id
  return null
}

export function formatExerciseName(name: string): string {
  const words = name.split('_')
  const lastWord = words.at(-1)?.toLowerCase()
  const shouldWrapLast = lastWord ? PARENTHETICAL_SUFFIXES.has(lastWord) : false

  const formattedWords = words.map((word, index) => {
    const formatted = formatIdentifierTitleCase(word).replaceAll(' ', '-')

    if (shouldWrapLast && index === words.length - 1) return `(${formatted})`
    return formatted
  })

  return formattedWords.join(' ')
}

export function formatExerciseDisplayName(name: null | string, isUserCreated: boolean): string {
  if (!name) return '(unnamed)'
  if (isUserCreated) return name
  return formatExerciseName(name)
}
