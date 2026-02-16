import {Command, Flags} from '@oclif/core'

import {closeDb, openDb} from '../../lib/db.js'
import {renderTable} from '../../lib/output.js'
import {listExercises} from '../../lib/repositories/exercises.js'

function formatMusclesCell(primaryMuscles: null | string, secondaryMuscles: null | string): string {
  const primary = primaryMuscles ?? 'n/a'
  if (!secondaryMuscles) return primary
  const secondaryLines = secondaryMuscles
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n')
  return `${primary}\n${secondaryLines}`
}

export default class Exercises extends Command {
  static description = 'List exercises'
  static enableJsonFlag = true
  static sortOptions = ['name', 'lastPerformed', 'timesPerformed'] as const
  static flags = {
    equipment: Flags.string({description: 'Filter by equipment name'}),
    muscle: Flags.string({description: 'Filter by muscle group'}),
    name: Flags.string({description: 'Filter by name contains'}),
    sort: Flags.option({
      default: 'name',
      options: Exercises.sortOptions,
    })(),
  }

  async run(): Promise<unknown | void> {
    const {flags} = await this.parse(Exercises)
    const context = openDb()

    try {
      const exercises = await listExercises(context.db, {
        equipment: flags.equipment,
        muscle: flags.muscle,
        name: flags.name,
        sort: flags.sort,
      })

      if (this.jsonEnabled()) return exercises

      this.log(
        renderTable(
          exercises.map((exercise) => ({
            equipment: exercise.equipment,
            id: exercise.id,
            lastPerformed: exercise.lastPerformed,
            muscles: formatMusclesCell(exercise.primaryMuscles, exercise.secondaryMuscles),
            name: exercise.name,
            timesPerformed: exercise.timesPerformed,
          })),
        ),
      )
    } finally {
      await closeDb(context)
    }
  }
}
