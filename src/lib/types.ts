export type ApiWeightUnit = 'kg' | 'lb'

export type ApiWeight = {
  unit: ApiWeightUnit
  value: null | number
}

export type ApiResourceReference = {
  id: number
  name: null | string
}

export type ApiProgram = {
  dateAdded: null | string
  id: number
  isActive: boolean
  isDeleted: boolean
  isTemplate: boolean
  name: null | string
}

type ApiPlannedSetBase = {
  id: null | number
  rpe: null | number
  weight: ApiWeight
}

export type ApiTimerBasedPlannedSet = ApiPlannedSetBase & {
  reps: null
  timeSeconds: number
}

export type ApiRepBasedPlannedSet = ApiPlannedSetBase & {
  reps: null | number
  timeSeconds: null
}

export type ApiPlannedSet = ApiRepBasedPlannedSet | ApiTimerBasedPlannedSet

type ApiPlannedExerciseBase = {
  exerciseId: null | number
  id: number
  name: null | string
}

export type ApiPlannedExercise =
  | (ApiPlannedExerciseBase & {sets: ApiRepBasedPlannedSet[]; timerBased: false})
  | (ApiPlannedExerciseBase & {sets: ApiTimerBasedPlannedSet[]; timerBased: true})

export type ApiPlannedRoutine = {
  exercises: ApiPlannedExercise[]
  id: number
  name: null | string
}

export type ApiProgramPlan = {
  weeks: Array<{
    id: number
    routines: ApiPlannedRoutine[]
  }>
}

export type ApiRoutineSummary = {
  id: number
  isDeleted: boolean
  isNext: boolean
  name: null | string
  program: ApiResourceReference
  week: {
    id: number
    number: number
  }
}

export type ApiRoutineDetail = ApiRoutineSummary & {
  exercises: ApiPlannedExercise[]
}
