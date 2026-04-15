import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('routines from-workout', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('defaults to the latest workout', async () => {
    const {stdout} = await runCommand('routines from-workout')

    expect(stdout).to.contain('[100] Day A')
    expect(stdout).to.contain('Workout: [4001] Day A')
  })

  it('shows the planned routine for a specific workout', async () => {
    const {stdout} = await runCommand('routines from-workout 4000 --json')
    const payload = JSON.parse(stdout)

    expect(payload.routine.routineId).to.equal(100)
    expect(payload.workout.workoutId).to.equal(4000)
  })
})
