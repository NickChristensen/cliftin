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

    expect(payload.duration).to.deep.equal({unit: 'seconds', value: 3600})
    expect(exerciseOrder).to.deep.equal([5002, 5000])
    expect(benchExercise.exerciseId).to.equal(1001)
    expect(squatExercise.exerciseId).to.equal(1000)
    expect(benchExercise.sets.map((set: {setId: number}) => set.setId)).to.deep.equal([6004, 6003])
    expect(squatExercise.sets[0].weight).to.deep.equal({unit: 'lb', value: 220})
  })
})
