import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('routines show', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('shows planned routine detail', async () => {
    const {stdout} = await runCommand('routines show 100')

    expect(stdout).to.contain('[100] Day A')
    expect(stdout).to.contain('Program: Active Program')
    expect(stdout).to.contain('Week: 1')
    expect(stdout).to.contain('[1001] Bench Press')
    expect(stdout).to.contain('176 lb')
  })

  it('returns routine detail in json mode', async () => {
    const {stdout} = await runCommand('routines show 100 --json')
    const payload = JSON.parse(stdout)

    expect(payload.program.programId).to.equal(1)
    expect(payload.week).to.deep.equal({number: 1, weekId: 10})
    expect(payload.routine.routineId).to.equal(100)
    expect(payload).to.not.have.property('workout')
  })
})
