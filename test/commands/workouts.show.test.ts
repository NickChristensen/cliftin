import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('workouts show', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('defaults to latest workout', async () => {
    const {stdout} = await runCommand('workouts show')
    expect(stdout).to.contain('[4001]')
  })

  it('shows workout detail', async () => {
    const {stdout} = await runCommand('workouts show 4000')
    expect(stdout).to.contain('[4000] Day A')
    expect(stdout).to.contain('[1001] Bench Press')
    expect(stdout).to.contain('[1000] Squat')
    expect(stdout).to.contain('Duration: 60 minutes')
    expect(stdout).to.contain('220 lb')
  })

  it('includes weight unit metadata in json detail output', async () => {
    const {stdout} = await runCommand('workouts show 4000 --json')
    const payload = JSON.parse(stdout)
    const exerciseOrder = payload.exercises.map((exercise: {exerciseResultId: number}) => exercise.exerciseResultId)
    const benchExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5002)
    const squatExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5000)

    expect(payload).to.have.property('workoutId', 4000)
    expect(payload).to.not.have.property('id')
    expect(payload.duration).to.deep.equal({unit: 'seconds', value: 3600})
    expect(exerciseOrder).to.deep.equal([5002, 5000])
    expect(benchExercise.exerciseId).to.equal(1001)
    expect(squatExercise.exerciseId).to.equal(1000)
    expect(benchExercise.sets.map((set: {setId: number}) => set.setId)).to.deep.equal([6004, 6003])
    expect(squatExercise.sets[0].weight).to.deep.equal({unit: 'lb', value: 220})
  })

  it('uses the exercise result definition when its configuration differs or has no definition', async () => {
    const {stdout} = await runCommand('workouts show 4001 --json')
    const payload = JSON.parse(stdout)
    const directDefinitionExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5004)
    const configurationWithoutDefinitionExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5003)

    expect(directDefinitionExercise.exerciseId).to.equal(1002)
    expect(directDefinitionExercise.name).to.equal('bench')
    expect(configurationWithoutDefinitionExercise.exerciseId).to.equal(1001)
    expect(configurationWithoutDefinitionExercise.name).to.equal('Bench Press')
  })

  it('supports --no-warmup in plain output', async () => {
    const {stdout} = await runCommand('workouts show 4000 --no-warmup')

    expect(stdout).to.not.contain('true')
    expect(stdout).to.contain('6001')
    expect(stdout).to.not.contain('6000')
    expect(stdout).to.not.contain('6003')
  })

  it('supports --no-warmup in json output', async () => {
    const {stdout} = await runCommand('workouts show 4000 --no-warmup --json')
    const payload = JSON.parse(stdout)
    const benchExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5002)
    const squatExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5000)

    expect(benchExercise.sets.map((set: {setId: number}) => set.setId)).to.deep.equal([6004])
    expect(squatExercise.sets.map((set: {setId: number}) => set.setId)).to.deep.equal([6001])
    expect(benchExercise.sets.every((set: {isWarmup: boolean}) => set.isWarmup === false)).to.equal(true)
  })
})
