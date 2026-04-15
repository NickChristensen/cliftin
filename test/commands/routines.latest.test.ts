import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('routines latest', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('shows the planned routine for the latest workout', async () => {
    const {stdout} = await runCommand('routines latest')

    expect(stdout).to.contain('[100] Day A')
    expect(stdout).to.contain('Workout: [4001] Day A')
  })

  it('returns linked workout metadata in json mode', async () => {
    const {stdout} = await runCommand('routines latest --json')
    const payload = JSON.parse(stdout)

    expect(payload.routine.routineId).to.equal(100)
    expect(payload.workout.workoutId).to.equal(4001)
    expect(payload.workout.duration).to.deep.equal({unit: 'seconds', value: 3500})
  })
})
