export type IdName = {
  id: number
  name: string
}

export type ProgramSummary = {
  dateAdded: null | string
  id: number
  isActive: boolean
  isTemplate: boolean
  name: string
}

export type PlannedSet = {
  id: null | number
  reps: null | number
  rpe: null | number
  timeSeconds: null | number
  weight: null | number
}

export type PlannedExercise = {
  exerciseConfigId: number
  id: null | number
  name: null | string
  plannedReps: null | number
  plannedSets: null | number
  plannedTimeSeconds: null | number
  plannedWeight: null | number
  sets: PlannedSet[]
}

export type ProgramRoutine = {
  exercises: PlannedExercise[]
  id: number
  name: null | string
}

export type ProgramWeek = {
  id: number
  routines: ProgramRoutine[]
}

export type ProgramDetailTree = {
  program: ProgramSummary
  weeks: ProgramWeek[]
}

export type WorkoutSummary = {
  date: null | string
  duration: null | number
  id: number
  program: null | string
  routine: null | string
}

export type WorkoutSet = {
  id: number
  reps: null | number
  rpe: null | number
  timeSeconds: null | number
  volume: null | number
  weight: null | number
}

export type WorkoutExerciseDetail = {
  exerciseResultId: number
  name: null | string
  sets: WorkoutSet[]
}

export type WorkoutDetail = {
  date: null | string
  duration: null | number
  exercises: WorkoutExerciseDetail[]
  id: number
  program: null | string
  routine: null | string
}

export type ExerciseSummary = {
  equipment: null | string
  id: number
  lastPerformed: null | string
  name: null | string
  primaryMuscles: null | string
  supports1RM: boolean
  timerBased: boolean
  timesPerformed: number
}

export type ExerciseHistoryRow = {
  date: null | string
  routine: null | string
  sets: number
  topReps: null | number
  topWeight: null | number
  totalReps: number
  volume: number
  workoutId: number
}

export type ExerciseDetail = {
  defaultProgressMetric: null | string
  equipment: null | string
  id: number
  lastHistoryEntry: ExerciseHistoryRow | null
  name: null | string
  perceptionScale: null | string
  primaryMuscles: null | string
  recentRoutines: string[]
  secondaryMuscles: null | string
  supports1RM: boolean
  timerBased: boolean
  totalRoutines: number
  totalWorkouts: number
}
