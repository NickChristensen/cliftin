/**
 * Liftin stores overloaded set fields for both repetition- and timer-based
 * exercises. Normalize them only after consulting the exercise definition;
 * set values themselves are not a reliable discriminator.
 */
export function normalizeTimerBasedSet(
  timerBased: true,
  set: {reps: null | number; timeSeconds: null | number},
  source: string,
): {reps: null; timeSeconds: number}
export function normalizeTimerBasedSet(
  timerBased: false,
  set: {reps: null | number; timeSeconds: null | number},
  source: string,
): {reps: null | number; timeSeconds: null}
export function normalizeTimerBasedSet(
  timerBased: boolean,
  set: {reps: null | number; timeSeconds: null | number},
  source: string,
): {reps: null | number; timeSeconds: null | number} {
  if (!timerBased) return {reps: set.reps, timeSeconds: null}
  if (set.timeSeconds === null) throw new Error(`Invalid Liftin source data: timer-based ${source} has no time.`)
  return {reps: null, timeSeconds: set.timeSeconds}
}
