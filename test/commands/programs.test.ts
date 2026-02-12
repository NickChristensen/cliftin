import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('programs', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists programs', async () => {
    const {stdout} = await runCommand('programs')
    expect(stdout).to.contain('Active Program')
    expect(stdout).to.contain('isActive')
  })

  it('uses --active for detail mode', async () => {
    const {stdout} = await runCommand('programs --active')
    expect(stdout).to.contain('Program 1: Active Program')
    expect(stdout).to.contain('Week 10')
  })

  it('supports --current alias', async () => {
    const {stdout} = await runCommand('programs --current')
    expect(stdout).to.contain('Program 1: Active Program')
  })

  it('errors when selector does not exist', async () => {
    const {error} = await runCommand('programs does-not-exist')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('No records found for selector')
  })
})
