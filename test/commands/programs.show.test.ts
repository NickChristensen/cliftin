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
  })

  it('converts planned weights to pounds when unit preference is imperial', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const squatExercise = payload.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 1000)
    const benchExercise = payload.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 1001)

    expect(squatExercise).to.exist
    expect(squatExercise.plannedWeight).to.deep.equal({unit: 'lb', value: 220})
    expect(squatExercise.sets[0].weight).to.deep.equal({unit: 'lb', value: 220})
    expect(squatExercise.sets[1].weight).to.deep.equal({unit: 'lb', value: 225.5})
    expect(benchExercise.name).to.equal('Bench Press')
  })

  it('expands fallback planned sets to one row per ZSETS', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const benchExercise = payload.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 1001)

    expect(benchExercise.sets).to.have.length(3)
    expect(benchExercise.sets[0]).to.not.have.property('setIndex')
  })

  it('orders exercises by routine relationship order', async () => {
    const {stdout} = await runCommand('programs show --json')
    const payload = JSON.parse(stdout)
    const exerciseIds = payload.weeks[0].routines[0].exercises.map((exercise: {id: number}) => exercise.id)

    expect(exerciseIds).to.deep.equal([1001, 1000])
  })

  it('errors when selector does not exist', async () => {
    const {error} = await runCommand('programs show does-not-exist')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('No records found for selector')
  })
})
