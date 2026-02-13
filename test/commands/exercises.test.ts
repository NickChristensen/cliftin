import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('exercises', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists exercises with lastPerformed and timesPerformed', async () => {
    const {stdout} = await runCommand('exercises --json')
    const payload = JSON.parse(stdout)
    const squat = payload.find((item: {name: string}) => item.name === 'Squat')
    const benchPress = payload.find((item: {name: string}) => item.name === 'Bench Press')

    expect(squat).to.exist
    expect(benchPress).to.exist
    expect(squat).to.have.property('lastPerformed')
    expect(squat).to.have.property('timesPerformed')
  })

  it('returns detail with most recent history row', async () => {
    const detail = await runCommand('exercises squat --json')
    const history = await runCommand('exercises history squat --limit 1 --json')

    const detailJson = JSON.parse(detail.stdout)
    const historyJson = JSON.parse(history.stdout)

    expect(detailJson.lastHistoryEntry).to.deep.equal(historyJson[0])
  })

  it('supports min/max reps and weight filters in history mode', async () => {
    const {stdout} = await runCommand('exercises history squat --min-reps 6 --max-reps 6 --min-weight 231 --max-weight 231 --json')
    const payload = JSON.parse(stdout)

    expect(payload).to.have.length(1)
    expect(payload[0].topWeight).to.deep.equal({unit: 'lb', value: 231})
    expect(payload[0].topReps).to.equal(6)
  })

  it('shows unit suffix in table history output', async () => {
    const {stdout} = await runCommand('exercises history squat --limit 1')
    expect(stdout).to.contain('231 lb')
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
