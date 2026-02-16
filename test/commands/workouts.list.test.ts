import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('workouts list', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists workouts', async () => {
    const {stdout} = await runCommand('workouts list')
    expect(stdout).to.contain('Day A')
    expect(stdout).to.contain('Active Program')
    expect(stdout).to.contain('58 minutes')
  })

  it('returns duration with unit metadata in json list output', async () => {
    const {stdout} = await runCommand('workouts list --json')
    const payload = JSON.parse(stdout)

    expect(payload[0].duration).to.deep.equal({unit: 'seconds', value: 3500})
  })

  it('supports --all to disable list limit', async () => {
    const {stdout: limitedStdout} = await runCommand('workouts list --limit 1 --json')
    const {stdout: allStdout} = await runCommand('workouts list --all --json')
    const limitedPayload = JSON.parse(limitedStdout)
    const allPayload = JSON.parse(allStdout)

    expect(limitedPayload).to.have.length(1)
    expect(allPayload).to.have.length(2)
  })

  it('does not support --yesterday', async () => {
    const {error} = await runCommand('workouts list --yesterday')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Nonexistent flag: --yesterday')
  })

  it('rejects --all with --limit', async () => {
    const {error} = await runCommand('workouts list --all --limit 1')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('cannot also be provided')
  })

  it('rejects --on with --from/--to', async () => {
    const {error} = await runCommand('workouts list --on 2026-01-01 --from 2026-01-01')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('cannot also be provided')
  })

  it('returns actionable json error for invalid date range', async () => {
    const {stdout} = await runCommand('workouts list --from 2026-02-01 --to 2026-01-01 --json')
    const payload = JSON.parse(stdout)

    expect(payload).to.deep.equal({
      error: {message: 'Invalid date range: --from must be before or equal to --to.'},
    })
  })
})
