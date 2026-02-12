export const DEFAULT_RPE_SENTINEL = 16

export function normalizeRpe(rpe: null | number): null | number {
  return rpe === DEFAULT_RPE_SENTINEL ? null : rpe
}
