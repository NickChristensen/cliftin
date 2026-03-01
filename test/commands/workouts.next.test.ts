import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('workouts next', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('shows the up-next routine from the active program', async () => {
    const {stdout} = await runCommand('workouts next')

    expect(stdout).to.contain('[101] Day B')
    expect(stdout).to.contain('Program: Active Program')
    expect(stdout).to.contain('Week: 1')
    expect(stdout).to.contain('[1001] Bench Press')
    expect(stdout).to.contain('181.5 lb')
  })

  it('returns planned routine detail in json mode', async () => {
    const {stdout} = await runCommand('workouts next --json')
    const payload = JSON.parse(stdout)

    expect(payload.program.programId).to.equal(1)
    expect(payload.program).to.not.have.property('id')
    expect(payload.week).to.deep.equal({number: 1, weekId: 10})
    expect(payload.routine.routineId).to.equal(101)
    expect(payload.routine).to.not.have.property('id')
    expect(payload.routine.exercises[0].exerciseId).to.equal(1001)
    expect(payload.routine.exercises[0]).to.not.have.property('id')
    expect(payload.routine.exercises[0].plannedWeight).to.deep.equal({unit: 'lb', value: 181.5})
    expect(payload.routine.exercises[0].sets[0].weight).to.deep.equal({unit: 'lb', value: 181.5})
    expect(payload.routine.exercises[0].sets[0]).to.have.property('setId', null)
  })
})
