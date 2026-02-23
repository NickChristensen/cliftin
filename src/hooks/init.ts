import {Hook} from '@oclif/core'

const hook: Hook.Init = async function (options) {
  if (['--version', '-v'].includes(process.argv[2])) {
    this.log(`v${options.config.version}`)
    // eslint-disable-next-line n/no-process-exit, unicorn/no-process-exit
    process.exit(0)
  }
}

export default hook
