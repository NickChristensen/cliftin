import {Args, Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../lib/db.js'
import {printJson, renderTable} from '../lib/output.js'
import {getProgramDetail, listPrograms, resolveProgramSelector} from '../lib/repositories/programs.js'

export default class Programs extends Command {
  static args = {
    selector: Args.string({description: 'program id or name', required: false}),
  }
static description = 'List programs, or show one program hierarchy'
static examples = [
    '<%= config.bin %> <%= command.id %>',
    '<%= config.bin %> <%= command.id %> --active',
    '<%= config.bin %> <%= command.id %> "MAPS 15 Adapted"',
  ]
static flags = {
    active: Flags.boolean({description: 'Show active program detail'}),
    current: Flags.boolean({description: 'Alias for --active'}),
    json: Flags.boolean({description: 'Output JSON'}),
  }

  async run(): Promise<void> {
    const {args, flags} = await this.parse(Programs)
    const context = openDb()

    try {
      const useActive = flags.active || flags.current

      if (args.selector && useActive) {
        throw new Error('Use either a selector or --active/--current, not both.')
      }

      if (!args.selector && !useActive) {
        const programs = await listPrograms(context.db)

        if (flags.json) {
          printJson(this.log.bind(this), {data: programs})
          return
        }

        this.log(
          renderTable(
            programs.map((program) => ({
              dateAdded: program.dateAdded,
              id: program.id,
              isActive: program.isActive,
              isDeleted: program.isDeleted,
              isTemplate: program.isTemplate,
              name: program.name,
            })),
          ),
        )
        return
      }

      const programId = await resolveProgramSelector(context.db, args.selector, Boolean(useActive))
      const detail = await getProgramDetail(context.db, programId)

      if (flags.json) {
        printJson(this.log.bind(this), {data: detail})
        return
      }

      this.log(`Program ${detail.program.id}: ${detail.program.name}`)
      this.log(`Active: ${detail.program.isActive}  Template: ${detail.program.isTemplate}`)
      this.log('')

      for (const week of detail.weeks) {
        this.log(`Week ${week.id}`)

        for (const routine of week.routines) {
          this.log(`  Routine ${routine.id}: ${routine.name ?? '(unnamed)'}`)

          for (const exercise of routine.exercises) {
            this.log(`    Exercise ${exercise.id ?? exercise.exerciseConfigId}: ${exercise.name ?? '(unnamed)'}`)
            this.log(
              renderTable(
                exercise.sets.map((set) => ({
                  reps: set.reps,
                  rpe: set.rpe,
                  setIndex: set.setIndex,
                  timeSeconds: set.timeSeconds,
                  weight: set.weight,
                })),
              )
                .split('\n')
                .map((line) => `      ${line}`)
                .join('\n'),
            )
          }
        }

        this.log('')
      }
    } finally {
      await closeDb(context)
    }
  }
}
