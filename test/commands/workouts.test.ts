import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('workouts', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists workouts', async () => {
    const {stdout} = await runCommand('workouts')
    expect(stdout).to.contain('Day A')
    expect(stdout).to.contain('Active Program')
    expect(stdout).to.contain('58 minutes')
  })

  it('returns duration with unit metadata in json list output', async () => {
    const {stdout} = await runCommand('workouts --json')
    const payload = JSON.parse(stdout)

    expect(payload[0].duration).to.deep.equal({unit: 'seconds', value: 3500})
  })

  it('supports --all to disable list limit', async () => {
    const {stdout: limitedStdout} = await runCommand('workouts --limit 1 --json')
    const {stdout: allStdout} = await runCommand('workouts --all --json')
    const limitedPayload = JSON.parse(limitedStdout)
    const allPayload = JSON.parse(allStdout)

    expect(limitedPayload).to.have.length(1)
    expect(allPayload).to.have.length(2)
  })

  it('shows workout detail', async () => {
    const {stdout} = await runCommand('workouts 4000')
    expect(stdout).to.contain('[4000] Day A')
    expect(stdout).to.contain('[1001] Bench Press')
    expect(stdout).to.contain('[1000] Squat')
    expect(stdout).to.contain('Duration: 60 minutes')
    expect(stdout).to.contain('220 lb')
  })

  it('includes weight unit metadata in json detail output', async () => {
    const {stdout} = await runCommand('workouts 4000 --json')
    const payload = JSON.parse(stdout)
    const exerciseOrder = payload.exercises.map((exercise: {exerciseResultId: number}) => exercise.exerciseResultId)
    const benchExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5002)
    const squatExercise = payload.exercises.find((exercise: {exerciseResultId: number}) => exercise.exerciseResultId === 5000)

    expect(payload.duration).to.deep.equal({unit: 'seconds', value: 3600})
    expect(exerciseOrder).to.deep.equal([5002, 5000])
    expect(benchExercise.exerciseId).to.equal(1001)
    expect(squatExercise.exerciseId).to.equal(1000)
    expect(benchExercise.sets.map((set: {id: number}) => set.id)).to.deep.equal([6004, 6003])
    expect(squatExercise.sets[0].weight).to.deep.equal({unit: 'lb', value: 220})
  })

  it('does not support --yesterday', async () => {
    const {error} = await runCommand('workouts --yesterday')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Nonexistent flag: --yesterday')
  })

  it('rejects --all with --limit', async () => {
    const {error} = await runCommand('workouts --all --limit 1')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('cannot also be provided')
  })
})
