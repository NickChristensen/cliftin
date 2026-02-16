import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('exercises show', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('returns detail with history rows', async () => {
    const {stdout} = await runCommand('exercises show squat --json')
    const payload = JSON.parse(stdout)

    expect(payload.history).to.have.length.greaterThan(0)
    expect(payload.history[0]).to.have.property('workoutId')
    expect(payload.history[0]).to.have.property('sets').that.is.an('array')
  })

  it('returns set-level history rows and no duplicated lastPerformed in detail json output', async () => {
    const {stdout} = await runCommand('exercises show squat --json')
    const payload = JSON.parse(stdout)

    expect(payload).to.not.have.property('lastPerformed')
    expect(payload.history[0]).to.include({
      routine: 'Day A',
      workoutId: 4001,
    })
    expect(payload.history[0].topWeight).to.deep.equal({unit: 'lb', value: 231})
    expect(payload.history[0].sets[0]).to.include({
      reps: 6,
      setId: 6002,
    })
    expect(payload.history[0].sets[0].weight).to.deep.equal({unit: 'lb', value: 231})
  })

  it('supports min/max reps and weight filters in history mode', async () => {
    const {stdout} = await runCommand('exercises show squat --min-reps 6 --max-reps 6 --min-weight 231 --max-weight 231 --json')
    const payload = JSON.parse(stdout)

    expect(payload.history).to.have.length(1)
    expect(payload.history[0].topWeight).to.deep.equal({unit: 'lb', value: 231})
    expect(payload.history[0].topReps).to.equal(6)
    expect(payload.history[0].sets).to.have.length(1)
    expect(payload.history[0].sets[0].setId).to.equal(6002)
    expect(payload.history[0].sets[0].weight).to.deep.equal({unit: 'lb', value: 231})
    expect(payload.history[0].sets[0].reps).to.equal(6)
  })

  it('supports history program filter via period-linked program fallback', async () => {
    const {stdout} = await runCommand('exercises show squat --program 1 --json')
    const payload = JSON.parse(stdout)

    expect(payload.history).to.have.length(2)
  })

  it('supports history --all to disable limit', async () => {
    const {stdout: limitedStdout} = await runCommand('exercises show squat --limit 1 --json')
    const {stdout: allStdout} = await runCommand('exercises show squat --all --json')
    const limitedPayload = JSON.parse(limitedStdout)
    const allPayload = JSON.parse(allStdout)

    expect(limitedPayload.history).to.have.length(1)
    expect(allPayload.history).to.have.length(2)
  })

  it('shows unit suffix in table history output', async () => {
    const {stdout} = await runCommand('exercises show squat')
    expect(stdout).to.contain('231 lb')
  })

  it('formats muscles in title case in plain output', async () => {
    const {stdout} = await runCommand('exercises show 1000')
    expect(stdout).to.contain('Primary muscles: Legs')
    expect(stdout).to.contain('Secondary muscles: Glutes')
  })

  it('shows last performed workout header and selected exercise sets in detail plain output', async () => {
    const {stdout} = await runCommand('exercises show squat')
    expect(stdout).to.contain('Last performed')
    expect(stdout).to.contain('[4001] Day A')
    expect(stdout).to.contain('Program: Active Program')
    expect(stdout).to.match(/Date: \d{4}-\d{2}-\d{2} \d{2}:\d{2}/)
    expect(stdout).to.contain('6002')
    expect(stdout).to.contain('231 lb')
  })

  it('errors on ambiguous selector', async () => {
    const {error} = await runCommand('exercises show ben')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('ambiguous')
    expect(error?.message).to.contain('Bench Press')
  })

  it('resolves built-in exercise by human-friendly name', async () => {
    const {stdout} = await runCommand('exercises show "Bench Press" --json')
    const payload = JSON.parse(stdout)
    expect(payload.id).to.equal(1001)
  })

  it('rejects --all with --limit in history mode', async () => {
    const {error} = await runCommand('exercises show squat --all --limit 1')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('cannot also be provided')
  })
})
