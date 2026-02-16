import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('exercises list', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists exercises with lastPerformed and timesPerformed', async () => {
    const {stdout} = await runCommand('exercises list --json')
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
    const {stdout} = await runCommand('exercises list --muscle glutes --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)

    expect(ids).to.include(1000)
  })

  it('sorts list by name by default', async () => {
    const {stdout} = await runCommand('exercises list --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)
    expect(ids).to.deep.equal([1002, 1001, 1000])
  })

  it('sorts list by timesPerformed when requested', async () => {
    const {stdout} = await runCommand('exercises list --sort timesPerformed --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)
    expect(ids).to.deep.equal([1000, 1001, 1002])
  })

  it('sorts list by lastPerformed when requested', async () => {
    const {stdout} = await runCommand('exercises list --sort lastPerformed --json')
    const payload = JSON.parse(stdout)
    const ids = payload.map((item: {id: number}) => item.id)
    expect(ids).to.deep.equal([1000, 1001, 1002])
  })

  it('renders list muscles with newline-separated primary/secondary values', async () => {
    const {stdout} = await runCommand('exercises list --name squat')
    expect(stdout).to.contain('Legs')
    expect(stdout).to.contain('Glutes')
  })

  it('does not support include-deleted list flag', async () => {
    const {error} = await runCommand('exercises list --include-deleted')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Nonexistent flag: --include-deleted')
  })

  it('rejects history filters without exercise selector', async () => {
    const {error} = await runCommand('exercises list --from 2026-01-01')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Nonexistent flag: --from')
  })

  it('errors when db path is missing', async () => {
    const previousDbPath = process.env.LIFTIN_DB_PATH
    try {
      delete process.env.LIFTIN_DB_PATH
      const {error} = await runCommand('exercises list')
      expect(error).to.be.instanceOf(Error)
      expect(error?.message).to.contain('Missing LIFTIN_DB_PATH')
    } finally {
      if (previousDbPath === undefined) {
        delete process.env.LIFTIN_DB_PATH
      } else {
        process.env.LIFTIN_DB_PATH = previousDbPath
      }
    }
  })
})
