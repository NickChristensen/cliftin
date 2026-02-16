import {runCommand} from '@oclif/test'
import {expect} from 'chai'

import {createTestDb} from '../support/db.js'

describe('programs list', () => {
  const dbPath = createTestDb()

  beforeEach(() => {
    process.env.LIFTIN_DB_PATH = dbPath
  })

  it('lists programs', async () => {
    const {stdout} = await runCommand('programs list --json')
    const payload = JSON.parse(stdout)
    const names = payload.map((item: {name: string}) => item.name)

    expect(names).to.include('Active Program')
    expect(names).to.not.include('Deleted Program')
    expect(payload[0]).to.have.property('isActive')
    expect(payload[0]).to.not.have.property('isDeleted')
  })
})
