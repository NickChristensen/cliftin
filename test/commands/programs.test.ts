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
    expect(payload.data[0]).to.have.property('isActive')
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

  it('normalizes default planned rpe (16) to null', async () => {
    const {stdout} = await runCommand('programs --active --json')
    const payload = JSON.parse(stdout)
    const firstSet = payload.data.weeks[0].routines[0].exercises[0].sets[0]

    expect(firstSet.rpe).to.equal(null)
  })

  it('errors when selector does not exist', async () => {
    const {error} = await runCommand('programs does-not-exist')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('No records found for selector')
  })
})
