import {type TSchema} from '@sinclair/typebox'
import * as value from '@sinclair/typebox/value'
import {expect} from 'chai'

import {ExercisePerformanceSchema} from '../../src/schemas/exercises.js'
import {PlannedExerciseSchema} from '../../src/schemas/programs.js'
import {PerformedExerciseSchema} from '../../src/schemas/workouts.js'

type ExerciseWithSets = {
  sets: Array<Record<string, unknown>>
  timerBased: boolean
  [key: string]: unknown
}

const check = value.Value.Check

function withSet(exercise: ExerciseWithSets, set: Record<string, unknown>): ExerciseWithSets {
  return {...exercise, sets: [{...exercise.sets[0], ...set}]}
}

function assertTimerDiscriminatedSetContract(schema: TSchema, timerExercise: ExerciseWithSets, repExercise: ExerciseWithSets): void {
  expect(check(schema, timerExercise)).to.equal(true)
  expect(check(schema, repExercise)).to.equal(true)
  expect(check(schema, withSet(repExercise, {reps: null}))).to.equal(true)
  expect(check(schema, withSet(timerExercise, {timeSeconds: null}))).to.equal(false)
  expect(check(schema, withSet(timerExercise, {reps: 12}))).to.equal(false)
  expect(check(schema, withSet(repExercise, {timeSeconds: 120}))).to.equal(false)
}

describe('timer-based exercise schemas', () => {
  it('enforces timer and rep set branches across planned and performed exercise surfaces', () => {
    const weight = {unit: 'lb', value: null}

    assertTimerDiscriminatedSetContract(
      PlannedExerciseSchema,
      {exerciseId: 1000, id: 2000, name: 'Plank', sets: [{id: null, reps: null, rpe: null, timeSeconds: 45, weight}], timerBased: true},
      {exerciseId: 1001, id: 2001, name: 'Squat', sets: [{id: null, reps: 8, rpe: null, timeSeconds: null, weight}], timerBased: false},
    )

    assertTimerDiscriminatedSetContract(
      PerformedExerciseSchema,
      {exerciseId: 1000, id: 5000, name: 'Plank', sets: [{id: 6000, isWarmup: false, reps: null, rpe: null, timeSeconds: 45, volume: weight, weight}], timerBased: true},
      {exerciseId: 1001, id: 5001, name: 'Squat', sets: [{id: 6001, isWarmup: false, reps: 8, rpe: null, timeSeconds: null, volume: weight, weight}], timerBased: false},
    )

    assertTimerDiscriminatedSetContract(
      ExercisePerformanceSchema,
      {
        exerciseId: 1000,
        id: 5000,
        program: null,
        routine: null,
        sets: [{id: 6000, isWarmup: false, reps: null, rpe: null, timeSeconds: 45, volume: weight, weight}],
        startedAt: null,
        statistics: {setCount: 1, topReps: null, topWeight: weight, totalReps: 0, volume: weight},
        timerBased: true,
        workoutId: 4000,
      },
      {
        exerciseId: 1001,
        id: 5001,
        program: null,
        routine: null,
        sets: [{id: 6001, isWarmup: false, reps: 8, rpe: null, timeSeconds: null, volume: weight, weight}],
        startedAt: null,
        statistics: {setCount: 1, topReps: 8, topWeight: weight, totalReps: 8, volume: weight},
        timerBased: false,
        workoutId: 4000,
      },
    )
  })
})
