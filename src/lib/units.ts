const KG_TO_LB_MULTIPLIER = 2.2

export type WeightUnit = 'kg' | 'lb'

export function convertApiWeightToKg(weight: number, unit: WeightUnit): number {
  return unit === 'lb' ? weight / KG_TO_LB_MULTIPLIER : weight
}

export function convertKgToApiWeight(weight: null | number, unit: WeightUnit): null | number {
  if (weight === null) return null

  const converted = unit === 'lb' ? weight * KG_TO_LB_MULTIPLIER : weight
  return Number(converted.toFixed(2))
}
