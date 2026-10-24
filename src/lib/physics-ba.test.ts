import { describe, expect, it } from 'vitest'
import physicsJson from '../templates/physics-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const physics = physicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: physics.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, concentration = 'inside') => placeFailure(empty, withConcentrations(physics, [concentration]), { code, credits: 4 }, placement)

describe('Physics (BA)', () => {
  it('validates and copies the Arts and Sciences college parts', () => {
    expect(templateErrors(physics)).toEqual([])
    expect(physics.checks).toEqual(economicsJson.checks)
    expect(physics.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(physics.totalCredits).toBe(economicsJson.totalCredits)
    expect(physics.totalCreditsNote).toBe(economicsJson.totalCreditsNote)
    expect(physics.filters).toEqual(economicsJson.filters)
    expect(physics.failingGrades).toEqual(economicsJson.failingGrades)
    expect(physics.requiresConcentration).toBe(true)
  })

  it('accepts the mechanics alternative for students switching fields', () => {
    expect(fits('PHYS 2207', 'intro/mechanics')).toBeNull()
  })

  it('accepts the inside laboratory table without extending the outside list', () => {
    expect(fits('BME 4390', 'inside-labs/choice')).toBeNull()
    expect(fits('BME 4390', 'outside-lab/lab', 'outside')).not.toBeNull()
  })

  it('accepts the outside advanced laboratory alternative', () => {
    expect(fits('PHYS 4410', 'outside-lab/lab', 'outside')).toBeNull()
  })

  it('refuses core courses as electives beyond the core', () => {
    expect(fits('PHYS 3316', 'inside-electives')).not.toBeNull()
    expect(fits('PHYS 3316', 'outside-electives', 'outside')).not.toBeNull()
    expect(fits('ASTRO 4410', 'outside-electives', 'outside')).toBeNull()
    expect(fits('BME 4390', 'outside-electives', 'outside')).toBeNull()
  })
})
