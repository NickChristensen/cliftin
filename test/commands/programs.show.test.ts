import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('programs show', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('defaults to active program', async () => {
    const {stdout} = await runCommand('programs show')
    expect(stdout).to.contain('[1] Active Program')
    expect(stdout).to.contain('week')
    expect(stdout).to.contain('220 lb')
  })

  it('normalizes default planned rpe (16) to null', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const firstSet = payload.weeks[0].routines[0].exercises[0].sets[0]

    expect(firstSet.rpe).to.equal(null)
    expect(firstSet).to.have.property('setId')
    expect(firstSet).to.not.have.property('id')
  })

  it('converts planned weights to pounds when unit preference is imperial', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const squatExercise = payload.weeks[0].routines[0].exercises.find((exercise: {exerciseId: number}) => exercise.exerciseId === 1000)
    const benchExercise = payload.weeks[0].routines[0].exercises.find((exercise: {exerciseId: number}) => exercise.exerciseId === 1001)

    expect(squatExercise).to.exist
    expect(squatExercise.plannedWeight).to.deep.equal({unit: 'lb', value: 220})
    expect(squatExercise.sets[0].weight).to.deep.equal({unit: 'lb', value: 220})
    expect(squatExercise.sets[1].weight).to.deep.equal({unit: 'lb', value: 225.5})
    expect(benchExercise.name).to.equal('Bench Press')
    expect(payload.program).to.have.property('programId', 1)
    expect(payload.program).to.not.have.property('id')
    expect(payload.weeks[0]).to.have.property('weekId', 10)
    expect(payload.weeks[0].routines[0]).to.have.property('routineId', 100)
  })

  it('expands fallback planned sets to one row per ZSETS', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const benchExercise = payload.weeks[0].routines[0].exercises.find((exercise: {exerciseId: number}) => exercise.exerciseId === 1001)

    expect(benchExercise.sets).to.have.length(3)
    expect(benchExercise.sets[0]).to.not.have.property('setIndex')
  })

  it('keeps fewer individual set rows without synthesizing the missing configured set', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const squatExercise = payload.weeks[0].routines[0].exercises.find((exercise: {exerciseId: number}) => exercise.exerciseId === 1000)

    expect(squatExercise.plannedSets).to.equal(3)
    expect(squatExercise.sets).to.deep.equal([
      {reps: 5, rpe: null, setId: 3000, timeSeconds: null, weight: {unit: 'lb', value: 220}},
      {reps: 5, rpe: null, setId: 3001, timeSeconds: null, weight: {unit: 'lb', value: 225.5}},
    ])
  })

  it('excludes trailing individual set rows beyond the configured set count', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const benchExercise = payload.weeks[0].routines[1].exercises.find((exercise: {exerciseConfigId: number}) => exercise.exerciseConfigId === 2004)

    expect(benchExercise.sets).to.deep.equal([
      {reps: 8, rpe: null, setId: 3005, timeSeconds: null, weight: {unit: 'lb', value: 50}},
      {reps: 8, rpe: null, setId: 3006, timeSeconds: null, weight: {unit: 'lb', value: 50}},
    ])
  })

  it('ignores stale child sets when individual sets are disabled', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const benchExercise = payload.weeks[0].routines[1].exercises.find((exercise: {exerciseConfigId: number}) => exercise.exerciseConfigId === 2002)

    expect(benchExercise.sets).to.deep.equal([
      {reps: 8, rpe: null, setId: null, timeSeconds: 120, weight: {unit: 'lb', value: 181.5}},
      {reps: 8, rpe: null, setId: null, timeSeconds: 120, weight: {unit: 'lb', value: 181.5}},
    ])
  })

  it('orders exercises by routine relationship order', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const exerciseIds = payload.weeks[0].routines[0].exercises.map((exercise: {exerciseId: number}) => exercise.exerciseId)

    expect(exerciseIds).to.deep.equal([1001, 1000])
  })

  it('errors when selector does not exist', async () => {
    const {error} = await runCommand('programs show does-not-exist')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('No records found for selector')
  })
})
