import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('workouts', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists workouts', async () => {
    const {stdout} = await runCommand('workouts')
    expect(stdout).to.contain('Day A')
    expect(stdout).to.contain('program')
  })

  it('shows workout detail', async () => {
    const {stdout} = await runCommand('workouts 4000')
    expect(stdout).to.contain('Workout 4000')
    expect(stdout).to.contain('Exercise result 5000')
    expect(stdout).to.contain('220 lb')
  })

  it('includes weight unit metadata in json detail output', async () => {
    const {stdout} = await runCommand('workouts 4000 --json')
    const payload = JSON.parse(stdout)
    const firstSet = payload.data.exercises[0].sets[0]

    expect(firstSet.weight).to.deep.equal({unit: 'lb', value: 220})
  })

  it('does not support --yesterday', async () => {
    const {error} = await runCommand('workouts --yesterday')
    expect(error).to.be.instanceOf(Error)
    expect(error?.message).to.contain('Nonexistent flag: --yesterday')
  })
})
