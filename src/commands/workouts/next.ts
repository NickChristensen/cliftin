import {Command} from '@oclif/core'

export default class WorkoutsNext extends Command {
  static description = 'Redirect to routines next'
  static enableJsonFlag = true

  async run(): Promise<unknown | void> {
    await this.parse(WorkoutsNext)

    const message = 'workouts next has moved. Use "cliftin routines next" instead.'

    if (this.jsonEnabled()) {
      return {
        command: 'routines next',
        message,
      }
    }

    this.log(message)
  }
}
