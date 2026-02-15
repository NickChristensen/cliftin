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
    expect(squat).to.have.property('secondaryMuscles', 'Glutes')
    expect(squat).to.have.property('equipment', 'Smith Machine')
    expect(payload.find((item: {id: number}) => item.id === 1003)).to.equal(undefined)
  })

  it('filters list by secondary muscles with --muscle', async () => {
    const {stdout} = await runCommand('exercises --muscle glutes --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)

    expect(ids).to.include(1000)
  })

  it('sorts list by name by default', async () => {
    const {stdout} = await runCommand('exercises --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)
    expect(ids).to.deep.equal([1002, 1001, 1000])
  })

  it('sorts list by timesPerformed when requested', async () => {
    const {stdout} = await runCommand('exercises --sort timesPerformed --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)
    expect(ids).to.deep.equal([1000, 1001, 1002])
  })

  it('sorts list by lastPerformed when requested', async () => {
    const {stdout} = await runCommand('exercises --sort lastPerformed --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)
    expect(ids).to.deep.equal([1000, 1001, 1002])
  })

  it('returns detail with most recent history row', async () => {
    const detail = await runCommand('exercises squat --json')
    const history = await runCommand('exercises history squat --json')

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

  it('supports history program filter via period-linked program fallback', async () => {
    const {stdout} = await runCommand('exercises history squat --program 1 --json')
    const payload = JSON.parse(stdout)

    expect(payload).to.have.length(2)
  })

  it('supports history --all to disable limit', async () => {
    const {stdout: limitedStdout} = await runCommand('exercises history squat --limit 1 --json')
    const {stdout: allStdout} = await runCommand('exercises history squat --all --json')
    const limitedPayload = JSON.parse(limitedStdout)
    const allPayload = JSON.parse(allStdout)

    expect(limitedPayload).to.have.length(1)
    expect(allPayload).to.have.length(2)
  })

  it('shows unit suffix in table history output', async () => {
    const {stdout} = await runCommand('exercises history squat')
    expect(stdout).to.contain('231 lb')
  })

  it('formats muscles in title case in plain output', async () => {
    const {stdout} = await runCommand('exercises 1000')
    expect(stdout).to.contain('Primary muscles: Legs')
    expect(stdout).to.contain('Secondary muscles: Glutes')
  })

  it('renders list muscles with newline-separated primary/secondary values', async () => {
    const {stdout} = await runCommand('exercises --name squat')
    expect(stdout).to.contain('Legs')
    expect(stdout).to.contain('Glutes')
  })

  it('errors on ambiguous selector', async () => {
    const {error} = await runCommand('exercises ben')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('ambiguous')
  })

  it('does not support include-deleted list flag', async () => {
    const {error} = await runCommand('exercises --include-deleted')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Nonexistent flag: --include-deleted')
  })

  it('rejects --all with --limit in history mode', async () => {
    const {error} = await runCommand('exercises history squat --all --limit 1')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('cannot also be provided')
  })

  it('errors when db path is missing', async () => {
    delete process.env.LIFTIN_DB_PATH
    const {error} = await runCommand('exercises')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Missing LIFTIN_DB_PATH')
  })
})
