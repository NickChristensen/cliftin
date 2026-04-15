import {runCommand} from '@oclif/test'
import {expect} from 'chai'

describe('workouts next', () => {
  it('redirects to routines next', async () => {
    const {stdout} = await runCommand('workouts next')

    expect(stdout).to.contain('workouts next has moved')
    expect(stdout).to.contain('cliftin routines next')
  })

  it('returns redirect metadata in json mode', async () => {
    const {stdout} = await runCommand('workouts next --json')
    const payload = JSON.parse(stdout)

    expect(payload.command).to.equal('routines next')
    expect(payload.message).to.contain('workouts next has moved')
  })
})
