import {ExerciseHistoryRow, ProgramDetailTree, WorkoutDetail} from './types.js'
import {UnitPreference, withWeightUnit} from './units.js'

export function serializeExerciseHistoryRowsWithWeightUnits(
  rows: ExerciseHistoryRow[],
  unitPreference: UnitPreference,
): Array<Omit<ExerciseHistoryRow, 'topWeight'> & {topWeight: ReturnType<typeof withWeightUnit>}> {
  return rows.map((row) => ({
    ...row,
    topWeight: withWeightUnit(row.topWeight, unitPreference),
  }))
}

export function serializeProgramDetailWithWeightUnits(
  detail: ProgramDetailTree,
  unitPreference: UnitPreference,
): unknown {
  return {
    ...detail,
    weeks: detail.weeks.map((week) => ({
      ...week,
      routines: week.routines.map((routine) => ({
        ...routine,
        exercises: routine.exercises.map((exercise) => ({
          ...exercise,
          plannedWeight: withWeightUnit(exercise.plannedWeight, unitPreference),
          sets: exercise.sets.map((set) => ({
            ...set,
            weight: withWeightUnit(set.weight, unitPreference),
          })),
        })),
      })),
    })),
  }
}

export function serializeWorkoutDetailWithWeightUnits(detail: WorkoutDetail, unitPreference: UnitPreference): unknown {
  return {
    ...detail,
    exercises: detail.exercises.map((exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set) => ({
        ...set,
        weight: withWeightUnit(set.weight, unitPreference),
      })),
    })),
  }
}
