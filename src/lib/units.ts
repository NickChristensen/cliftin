import {Kysely} from 'kysely'

import {DatabaseSchema} from './db.js'

const KG_TO_LB_MULTIPLIER = 2.2

export type UnitPreference = 'imperial' | 'metric' | 'unknown'

function normalizeUnitPreference(value: null | string): UnitPreference {
  if (!value) return 'unknown'

  const normalized = value.trim().toLowerCase()
  if (normalized.includes('imperial') || normalized === 'lbs' || normalized === 'lb') return 'imperial'
  if (normalized.includes('metric') || normalized === 'kg') return 'metric'
  return 'unknown'
}

export function convertKgToDisplayWeight(weight: null | number, unitPreference: UnitPreference): null | number {
  if (weight === null) return null
  if (unitPreference !== 'imperial') return weight
  return Number((weight * KG_TO_LB_MULTIPLIER).toFixed(2))
}

export function convertKgToDisplayVolume(volume: null | number, unitPreference: UnitPreference): null | number {
  if (volume === null) return null
  if (unitPreference !== 'imperial') return volume
  return Number((volume * KG_TO_LB_MULTIPLIER).toFixed(2))
}

export async function resolveGlobalWeightUnit(db: Kysely<DatabaseSchema>): Promise<UnitPreference> {
  const settings = await db
    .selectFrom('ZSETTINGS')
    .select('ZMEASURMENTUNIT as unit')
    .executeTakeFirst()

  return normalizeUnitPreference(settings?.unit ?? null)
}

export async function resolveProgramWeightUnit(
  db: Kysely<DatabaseSchema>,
  programId: number,
): Promise<UnitPreference> {
  const settingsUnit = await resolveGlobalWeightUnit(db)
  if (settingsUnit !== 'unknown') return settingsUnit

  const equipmentUnits = await db
    .selectFrom('ZROUTINE as r')
    .leftJoin('ZPERIOD as p', 'p.Z_PK', 'r.ZPERIOD')
    .leftJoin('Z_12ROUTINES as j', 'j.Z_28ROUTINES', 'r.Z_PK')
    .leftJoin('ZEXERCISECONFIGURATION as ec', 'ec.Z_PK', 'j.Z_12EXERCISES')
    .leftJoin('ZEXERCISEINFORMATION as ei', 'ei.Z_PK', 'ec.ZINFORMATION')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .select('eq.ZMEASURMENTUNIT as unit')
    .where((eb) => eb.or([eb('p.ZWORKOUTPLAN', '=', programId), eb('r.ZWORKOUTPLAN', '=', programId)]))
    .where('r.ZSOFTDELETED', 'is not', 1)
    .where('eq.ZMEASURMENTUNIT', 'is not', null)
    .execute()

  const normalized = new Set(equipmentUnits.map((row) => normalizeUnitPreference(row.unit)))
  if (normalized.has('imperial')) return 'imperial'
  if (normalized.has('metric')) return 'metric'
  return 'unknown'
}

export async function resolveExerciseWeightUnit(
  db: Kysely<DatabaseSchema>,
  exerciseId: number,
): Promise<UnitPreference> {
  const settingsUnit = await resolveGlobalWeightUnit(db)
  if (settingsUnit !== 'unknown') return settingsUnit

  const row = await db
    .selectFrom('ZEXERCISEINFORMATION as ei')
    .leftJoin('ZEQUIPMENT2 as eq', 'eq.Z_PK', 'ei.ZEQUIPMENT')
    .select('eq.ZMEASURMENTUNIT as unit')
    .where('ei.Z_PK', '=', exerciseId)
    .executeTakeFirst()

  return normalizeUnitPreference(row?.unit ?? null)
}
