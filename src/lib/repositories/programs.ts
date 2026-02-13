import {Kysely} from 'kysely'

import {DatabaseSchema} from '../db.js'
import {formatExerciseDisplayName} from '../names.js'
import {normalizeRpe} from '../rpe.js'
import {appleSecondsToIso} from '../time.js'
import {PlannedExercise, PlannedSet, ProgramDetailTree, ProgramRoutine, ProgramSummary, ProgramWeek} from '../types.js'
import {convertKgToDisplayWeight, resolveProgramWeightUnit} from '../units.js'
import {resolveIdOrName} from './selectors.js'

function asBool(value: null | number): boolean {
  return value === 1
}

export async function listPrograms(db: Kysely<DatabaseSchema>): Promise<ProgramSummary[]> {
  const selectedProgram = await db
    .selectFrom('ZWORKOUTPROGRAMSINFO as info')
    .innerJoin('ZWORKOUTPLAN as plan', 'plan.ZID', 'info.ZSELECTEDWORKOUTPROGRAMID')
    .select('plan.Z_PK as id')
    .where('info.ZSELECTEDWORKOUTPROGRAMID', 'is not', null)
    .executeTakeFirst()

  const rows = await db
    .selectFrom('ZWORKOUTPLAN')
    .select([
      'Z_PK as id',
      'ZNAME as name',
      'ZISCURRENT as isActive',
      'ZISTEMPLATE as isTemplate',
      'ZDATEADDED as dateAdded',
    ])
    .where('ZSOFTDELETED', 'is not', 1)
    .orderBy('ZDATEADDED', 'desc')
    .execute()

  return rows.map((row) => ({
    dateAdded: appleSecondsToIso(row.dateAdded),
    id: row.id,
    isActive: selectedProgram ? row.id === selectedProgram.id : asBool(row.isActive),
    isTemplate: asBool(row.isTemplate),
    name: row.name ?? '(unnamed)',
  }))
}

export async function resolveProgramSelector(
  db: Kysely<DatabaseSchema>,
  selector: string | undefined,
  activeOnly: boolean,
): Promise<number> {
  if (activeOnly) {
    const selectedProgram = await db
      .selectFrom('ZWORKOUTPROGRAMSINFO as info')
      .innerJoin('ZWORKOUTPLAN as plan', 'plan.ZID', 'info.ZSELECTEDWORKOUTPROGRAMID')
      .select('plan.Z_PK as id')
      .where('info.ZSELECTEDWORKOUTPROGRAMID', 'is not', null)
      .executeTakeFirst()

    if (selectedProgram) return selectedProgram.id

    const fallbackRows = await db
      .selectFrom('ZWORKOUTPLAN')
      .select(['Z_PK as id'])
      .where('ZISCURRENT', '=', 1)
      .execute()

    if (fallbackRows.length !== 1) {
      throw new Error(
        `Expected exactly one active program. Found ${fallbackRows.length} via ZISCURRENT and no selected program in ZWORKOUTPROGRAMSINFO.`,
      )
    }

    return fallbackRows[0].id
  }

  if (!selector) throw new Error('Program selector is required unless --active/--current is set.')

  const programId = await resolveIdOrName(db, 'ZWORKOUTPLAN', selector)
  const nonDeleted = await db
    .selectFrom('ZWORKOUTPLAN')
    .select('Z_PK as id')
    .where('Z_PK', '=', programId)
    .where('ZSOFTDELETED', 'is not', 1)
    .executeTakeFirst()

  if (!nonDeleted) throw new Error(`Program ${programId} is soft-deleted and hidden from CLI output.`)

  return programId
}

export async function getProgramDetail(db: Kysely<DatabaseSchema>, programId: number): Promise<ProgramDetailTree> {
  const unitPreference = await resolveProgramWeightUnit(db, programId)

  const selectedProgram = await db
    .selectFrom('ZWORKOUTPROGRAMSINFO as info')
    .innerJoin('ZWORKOUTPLAN as plan', 'plan.ZID', 'info.ZSELECTEDWORKOUTPROGRAMID')
    .select('plan.Z_PK as id')
    .where('info.ZSELECTEDWORKOUTPROGRAMID', 'is not', null)
    .executeTakeFirst()

  const programRow = await db
    .selectFrom('ZWORKOUTPLAN')
    .select([
      'Z_PK as id',
      'ZNAME as name',
      'ZISCURRENT as isActive',
      'ZISTEMPLATE as isTemplate',
      'ZDATEADDED as dateAdded',
    ])
    .where('Z_PK', '=', programId)
    .where('ZSOFTDELETED', 'is not', 1)
    .executeTakeFirst()

  if (!programRow) throw new Error(`Program not found: ${programId}`)

  const weeks = await db
    .selectFrom('ZPERIOD')
    .select(['Z_PK as id'])
    .where('ZWORKOUTPLAN', '=', programId)
    .orderBy('Z_FOK_WORKOUTPLAN', 'asc')
    .orderBy('Z_PK', 'asc')
    .execute()

  const routines = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .select(['r.Z_PK as id', 'r.ZNAME as name', 'r.ZPERIOD as weekId'])
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', programId), eb('r.ZWORKOUTPLAN', '=', programId)]))
    .where('r.ZSOFTDELETED', 'is not', 1)
    .orderBy('r.Z_FOK_PERIOD', 'asc')
    .orderBy('r.Z_PK', 'asc')
    .execute()

  const exercises = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('Z_12ROUTINES as j', 'j.Z_28ROUTINES', 'r.Z_PK')
    .leftJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'j.Z_12EXERCISES')
    .leftJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'ec.ZINFORMATION')
    .select([
      'r.Z_PK as routineId',
      'ec.Z_PK as exerciseConfigId',
      'j.Z_FOK_12EXERCISES as routineExerciseOrder',
      'ec.ZSETS as plannedSets',
      'ec.ZREPS as plannedReps',
      'ec.ZWEIGHT as plannedWeight',
      'ec.ZTIME as plannedTimeSeconds',
      'ei.Z_PK as exerciseId',
      'ei.ZISUSERCREATED as isUserCreated',
      'ei.ZNAME as exerciseName',
    ])
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', programId), eb('r.ZWORKOUTPLAN', '=', programId)]))
    .where('r.ZSOFTDELETED', 'is not', 1)
    .where('ec.Z_PK', 'is not', null)
    .orderBy('r.Z_PK', 'asc')
    .orderBy('j.Z_FOK_12EXERCISES', 'asc')
    .orderBy('ec.Z_PK', 'asc')
    .execute()

  const exerciseConfigIds = exercises
    .map((exercise) => exercise.exerciseConfigId)
    .filter((value): value is number => value !== null)

  const setRows =
    exerciseConfigIds.length === 0
      ? []
      : await db
          .selectFrom('ZSETCONFIGURATION')
          .select([
            'Z_PK as id',
            'ZEXERCISECONFIGURATION as exerciseConfigId',
            'ZREPS as reps',
            'ZRPE as rpe',
            'ZWEIGHT as weight',
            'ZTIME as timeSeconds',
          ])
          .where('ZEXERCISECONFIGURATION', 'in', exerciseConfigIds)
          .orderBy('ZSETINDEX', 'asc')
          .execute()

  const setsByExerciseConfig = new Map<number, PlannedSet[]>()
  for (const row of setRows) {
    if (row.exerciseConfigId === null) continue

    const current = setsByExerciseConfig.get(row.exerciseConfigId) ?? []
    current.push({
      id: row.id,
      reps: row.reps,
      rpe: normalizeRpe(row.rpe),
      timeSeconds: row.timeSeconds,
      weight: convertKgToDisplayWeight(row.weight, unitPreference),
    })
    setsByExerciseConfig.set(row.exerciseConfigId, current)
  }

  const exercisesByRoutine = new Map<number, PlannedExercise[]>()
  for (const row of exercises) {
    if (row.exerciseConfigId === null) continue

    const current = exercisesByRoutine.get(row.routineId) ?? []
    const explicitSets = setsByExerciseConfig.get(row.exerciseConfigId) ?? []
    const fallbackSet: PlannedSet[] = explicitSets.length > 0
      ? explicitSets
      : Array.from({length: Math.max(row.plannedSets ?? 1, 1)}, () => ({
          id: null,
          reps: row.plannedReps,
          rpe: null,
          timeSeconds: row.plannedTimeSeconds,
          weight: convertKgToDisplayWeight(row.plannedWeight, unitPreference),
        }))

    current.push({
      exerciseConfigId: row.exerciseConfigId,
      id: row.exerciseId,
      name: formatExerciseDisplayName(row.exerciseName, asBool(row.isUserCreated)),
      plannedReps: row.plannedReps,
      plannedSets: row.plannedSets,
      plannedTimeSeconds: row.plannedTimeSeconds,
      plannedWeight: convertKgToDisplayWeight(row.plannedWeight, unitPreference),
      sets: fallbackSet,
    })

    exercisesByRoutine.set(row.routineId, current)
  }

  const routinesByWeek = new Map<number, ProgramRoutine[]>()
  for (const routine of routines) {
    if (routine.weekId === null) continue

    const current = routinesByWeek.get(routine.weekId) ?? []
    current.push({
      exercises: exercisesByRoutine.get(routine.id) ?? [],
      id: routine.id,
      name: routine.name,
    })
    routinesByWeek.set(routine.weekId, current)
  }

  const weekTree: ProgramWeek[] = weeks.map((week) => ({
    id: week.id,
    routines: routinesByWeek.get(week.id) ?? [],
  }))

  return {
    program: {
      dateAdded: appleSecondsToIso(programRow.dateAdded),
      id: programRow.id,
      isActive: selectedProgram ? programRow.id === selectedProgram.id : asBool(programRow.isActive),
      isTemplate: asBool(programRow.isTemplate),
      name: programRow.name ?? '(unnamed)',
    },
    weeks: weekTree,
  }
}
