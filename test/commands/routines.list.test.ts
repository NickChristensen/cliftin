import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('routines list', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists planned routines', async () => {
    const {stdout} = await runCommand('routines list')

    expect(stdout).to.contain('Day A')
    expect(stdout).to.contain('Day B')
    expect(stdout).to.contain('Active Program')
  })

  it('filters routines in json mode', async () => {
    const {stdout} = await runCommand('routines list --program 1 --week 1 --json')
    const payload = JSON.parse(stdout)

    expect(payload).to.have.length(2)
    expect(payload.map((routine: {routineId: number}) => routine.routineId)).to.deep.equal([100, 101])
    expect(payload.every((routine: {week: number}) => routine.week === 1)).to.equal(true)
  })
})
