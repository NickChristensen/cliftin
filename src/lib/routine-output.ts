import {ProgramRoutine} from './types.js'

export function buildRoutineRows(
  routine: ProgramRoutine,
  unitLabel: string,
): Array<Record<string, unknown>> {
  return routine.exercises.flatMap((exercise) => {
    const headingRow: Record<string, unknown> = {
      exercise: `[${exercise.id ?? exercise.exerciseConfigId}] ${exercise.name ?? '(unnamed)'}`,
      reps: null,
      rpe: null,
      timeSeconds: null,
      weight: null,
    }

    const setRows = exercise.sets.map((set) => ({
      exercise: '',
      reps: set.reps,
      rpe: set.rpe,
      timeSeconds: set.timeSeconds,
      weight: set.weight === null ? null : `${set.weight} ${unitLabel}`,
    }))

    return [headingRow, ...setRows]
  })
}
