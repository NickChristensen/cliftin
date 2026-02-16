import {Args, Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {serializeProgramDetailWithWeightUnits} from '../../lib/json-weight.js'
import {renderTable} from '../../lib/output.js'
import {getProgramDetail, resolveProgramSelector} from '../../lib/repositories/programs.js'
import {resolveProgramWeightUnit, weightUnitLabel} from '../../lib/units.js'

type ProgramRoutine = {
  exercises: Array<{
    exerciseConfigId: number
    id: null | number
    name: null | string
    sets: Array<{reps: null | number; rpe: null | number; timeSeconds: null | number; weight: null | number}>
  }>
  id: number
  name: null | string
}

type ProgramWeek = {
  routines: ProgramRoutine[]
}

function buildProgramRows(
  weeks: ProgramWeek[],
  unitLabel: string,
): Array<Record<string, unknown>> {
  return weeks.flatMap((week, weekIndex) =>
    week.routines.flatMap((routine, routineIndex) =>
      routine.exercises.flatMap((exercise, exerciseIndex) => {
        const headingRow: Record<string, unknown> = {}
        headingRow.week = routineIndex === 0 && exerciseIndex === 0 ? `Week ${weekIndex + 1}` : ''
        headingRow.routine = exerciseIndex === 0 ? `[${routine.id}] ${routine.name ?? '(unnamed)'}` : ''
        headingRow.exercise = `[${exercise.id ?? exercise.exerciseConfigId}] ${exercise.name ?? '(unnamed)'}`
        headingRow.reps = null
        headingRow.rpe = null
        headingRow.timeSeconds = null
        headingRow.weight = null

        const setRows = exercise.sets.map((set) => {
          const row: Record<string, unknown> = {}
          row.week = ''
          row.routine = ''
          row.exercise = ''
          row.reps = set.reps
          row.rpe = set.rpe
          row.timeSeconds = set.timeSeconds
          row.weight = set.weight === null ? null : `${set.weight} ${unitLabel}`
          return row
        })

        return [headingRow, ...setRows]
      }),
    ),
  )
}

export default class ProgramsShow extends Command {
  static args = {
    selector: Args.string({description: 'program id or name', ignoreStdin: true, required: false}),
  }
  static description = 'Show one program hierarchy'
  static enableJsonFlag = true
  static flags = {
    active: Flags.boolean({description: 'Show active program detail'}),
    current: Flags.boolean({description: 'Alias for --active'}),
  }

  async run(): Promise<unknown | void> {
    const {args, flags} = await this.parse(ProgramsShow)
    const context = openDb()

    try {
      const useActive = flags.active || flags.current

      if (args.selector && useActive) {
        throw new Error('Use either a selector or --active/--current, not both.')
      }

      if (!args.selector && !useActive) {
        throw new Error('Provide a selector or use --active/--current.')
      }

      const programId = await resolveProgramSelector(context.db, args.selector, Boolean(useActive))
      const detail = await getProgramDetail(context.db, programId)
      const unitPreference = await resolveProgramWeightUnit(context.db, detail.program.id)
      const unitLabel = weightUnitLabel(unitPreference)

      if (this.jsonEnabled()) {
        return serializeProgramDetailWithWeightUnits(detail, unitPreference)
      }

      this.log(`[${detail.program.id}] ${detail.program.name}`)
      this.log(`Active: ${detail.program.isActive}  Template: ${detail.program.isTemplate}`)
      this.log('')
      const programRows = buildProgramRows(detail.weeks, unitLabel)
      const renderedTable = renderTable(programRows).replace(/^\n+/, '')
      this.log(renderedTable)
      this.log('')
    } finally {
      await closeDb(context)
    }
  }
}
