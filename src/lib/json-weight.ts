import {ExerciseHistoryRow, NextWorkoutDetail, ProgramDetailTree, WorkoutDetail} from './types.js'
import {UnitPreference, withWeightUnit} from './units.js'

function omitId<T extends {id: unknown}>(value: T): Omit<T, 'id'> {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== 'id')) as Omit<T, 'id'>
}

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
  const program = omitId(detail.program)

  return {
    program: {...program, programId: detail.program.id},
    weeks: detail.weeks.map((week) => ({
      routines: week.routines.map((routine) => ({
        ...omitId(routine),
        exercises: routine.exercises.map((exercise) => ({
          ...omitId(exercise),
          exerciseId: exercise.id,
          plannedWeight: withWeightUnit(exercise.plannedWeight, unitPreference),
          sets: exercise.sets.map((set) => ({
            ...omitId(set),
            setId: set.id,
            weight: withWeightUnit(set.weight, unitPreference),
          })),
        })),
        routineId: routine.id,
      })),
      weekId: week.id,
    })),
  }
}

export function serializeNextWorkoutDetailWithWeightUnits(
  detail: NextWorkoutDetail,
  unitPreference: UnitPreference,
): unknown {
  const program = omitId(detail.program)

  return {
    program: {...program, programId: detail.program.id},
    routine: {
      ...omitId(detail.routine),
      exercises: detail.routine.exercises.map((exercise) => ({
        ...omitId(exercise),
        exerciseId: exercise.id,
        plannedWeight: withWeightUnit(exercise.plannedWeight, unitPreference),
        sets: exercise.sets.map((set) => ({
          ...omitId(set),
          setId: set.id,
          weight: withWeightUnit(set.weight, unitPreference),
        })),
      })),
      routineId: detail.routine.id,
    },
    week: {
      number: detail.week.number,
      weekId: detail.week.id,
    },
  }
}

export function serializeWorkoutDetailWithWeightUnits(detail: WorkoutDetail, unitPreference: UnitPreference): unknown {
  return {
    date: detail.date,
    duration: detail.duration,
    exercises: detail.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      exerciseResultId: exercise.exerciseResultId,
      name: exercise.name,
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        rpe: set.rpe,
        setId: set.id,
        timeSeconds: set.timeSeconds,
        volume: set.volume,
        weight: withWeightUnit(set.weight, unitPreference),
      })),
    })),
    program: detail.program,
    routine: detail.routine,
    workoutId: detail.id,
  }
}
