import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('exercises', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists exercises with lastPerformed and timesPerformed', async () => {
    const {stdout} = await runCommand('exercises')
    expect(stdout).to.contain('lastPerformed')
    expect(stdout).to.contain('timesPerformed')
    expect(stdout).to.contain('squat')
  })

  it('returns detail with most recent history row', async () => {
    const detail = await runCommand('exercises squat --json')
    const history = await runCommand('exercises history squat --limit 1 --json')

    const detailJson = JSON.parse(detail.stdout)
    const historyJson = JSON.parse(history.stdout)

    expect(detailJson.data.lastHistoryEntry).to.deep.equal(historyJson.data[0])
  })

  it('supports min/max reps and weight filters in history mode', async () => {
    const {stdout} = await runCommand('exercises history squat --min-reps 6 --max-reps 6 --min-weight 105 --max-weight 105')
    expect(stdout).to.contain('105')
    expect(stdout).to.not.contain('102.5')
  })

  it('errors on ambiguous selector', async () => {
    const {error} = await runCommand('exercises ben')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('ambiguous')
  })

  it('errors when db path is missing', async () => {
    delete process.env.LIFTIN_DB_PATH
    const {error} = await runCommand('exercises')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Missing LIFTIN_DB_PATH')
  })
})
