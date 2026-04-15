import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('routines next', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('shows the up-next planned routine', async () => {
    const {stdout} = await runCommand('routines next')

    expect(stdout).to.contain('[101] Day B')
    expect(stdout).to.contain('Program: Active Program')
    expect(stdout).to.contain('Week: 1')
  })

  it('returns routine detail in json mode', async () => {
    const {stdout} = await runCommand('routines next --json')
    const payload = JSON.parse(stdout)

    expect(payload.routine.routineId).to.equal(101)
    expect(payload).to.not.have.property('workout')
  })
})
