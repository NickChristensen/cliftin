import {expect} from 'chai'

import {formatExerciseDisplayName, formatExerciseName, formatMuscleLabel} from '../../src/lib/names.js'

describe('names', () => {
  it('formats built-in snake_case names to title case', () => {
    expect(formatExerciseName('barbell_curl')).to.equal('Barbell Curl')
    expect(formatExerciseName('pull_up_weighted')).to.equal('Pull Up (Weighted)')
    expect(formatExerciseName('iso-lateral_chest_press')).to.equal('Iso-Lateral Chest Press')
  })

  it('preserves user-created names', () => {
    expect(formatExerciseDisplayName('My Custom Exercise', true)).to.equal('My Custom Exercise')
  })

  it('formats muscle lists with comma spacing', () => {
    expect(formatMuscleLabel('hamstrings,glutes')).to.equal('Hamstrings, Glutes')
  })
})
