const PARENTHETICAL_SUFFIXES = new Set(['assisted', 'weighted'])

export function formatExerciseName(name: string): string {
  const words = name.split('_')
  const lastWord = words.at(-1)?.toLowerCase()
  const shouldWrapLast = lastWord ? PARENTHETICAL_SUFFIXES.has(lastWord) : false

  const formattedWords = words.map((word, index) => {
    const formatted = word
      .split('-')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
      .join('-')

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
