export function toJsonErrorPayload(error: unknown): {error: {message: string}} {
  if (error instanceof Error) {
    return {error: {message: error.message}}
  }

  return {error: {message: String(error)}}
}

