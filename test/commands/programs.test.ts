import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('programs', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists programs', async () => {
    const {stdout} = await runCommand('programs --json')
    const payload = JSON.parse(stdout)
    const names = payload.data.map((item: {name: string}) => item.name)

    expect(names).to.include('Active Program')
    expect(names).to.not.include('Deleted Program')
    expect(payload.data[0]).to.have.property('isActive')
    expect(payload.data[0]).to.not.have.property('isDeleted')
  })

  it('uses --active for detail mode', async () => {
    const {stdout} = await runCommand('programs --active')
    expect(stdout).to.contain('[1] Active Program')
    expect(stdout).to.contain('Week 1')
    expect(stdout).to.contain('[1001] Bench Press')
    expect(stdout).to.contain('220 lb')
  })

  it('supports --current alias', async () => {
    const {stdout} = await runCommand('programs --current')
    expect(stdout).to.contain('[1] Active Program')
  })

  it('normalizes default planned rpe (16) to null', async () => {
    const {stdout} = await runCommand('programs --active --json')
    const payload = JSON.parse(stdout)
    const firstSet = payload.data.weeks[0].routines[0].exercises[0].sets[0]

    expect(firstSet.rpe).to.equal(null)
  })

  it('converts planned weights to pounds when unit preference is imperial', async () => {
    const {stdout} = await runCommand('programs --active --json')
    const payload = JSON.parse(stdout)
    const squatExercise = payload.data.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 1000)
    const benchExercise = payload.data.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 1001)

    expect(squatExercise).to.exist
    expect(squatExercise.plannedWeight).to.deep.equal({unit: 'lb', value: 220})
    expect(squatExercise.sets[0].weight).to.deep.equal({unit: 'lb', value: 220})
    expect(squatExercise.sets[1].weight).to.deep.equal({unit: 'lb', value: 225.5})
    expect(benchExercise.name).to.equal('Bench Press')
  })

  it('expands fallback planned sets to one row per ZSETS', async () => {
    const {stdout} = await runCommand('programs --active --json')
    const payload = JSON.parse(stdout)
    const benchExercise = payload.data.weeks[0].routines[0].exercises.find((exercise: {id: number}) => exercise.id === 1001)

    expect(benchExercise.sets).to.have.length(3)
    expect(benchExercise.sets[0]).to.not.have.property('setIndex')
  })

  it('orders exercises by routine relationship order', async () => {
    const {stdout} = await runCommand('programs --active --json')
    const payload = JSON.parse(stdout)
    const exerciseIds = payload.data.weeks[0].routines[0].exercises.map((exercise: {id: number}) => exercise.id)

    expect(exerciseIds).to.deep.equal([1001, 1000])
  })

  it('errors when selector does not exist', async () => {
    const {error} = await runCommand('programs does-not-exist')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('No records found for selector')
  })
})
