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

export type ApiPlannedSet = {
  id: null | number
  reps: null | number
  rpe: null | number
  timeSeconds: null | number
  weight: ApiWeight
}

export type ApiPlannedExercise = {
  exerciseId: null | number
  id: number
  name: null | string
  sets: ApiPlannedSet[]
}

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
