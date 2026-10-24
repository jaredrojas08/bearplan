import { describe, expect, it } from 'vitest'
import chemistryJson from '../templates/chemistry-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const chemistry = chemistryJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: chemistry.id, entryTerm: 'FA22', gradTerm: 'SP28', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string) => placeFailure(empty, chemistry, { code, credits: 4 }, placement)

describe('Chemistry BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(chemistry)).toEqual([])
    expect(chemistry.checks.slice(0, economicsJson.checks.length)).toEqual(economicsJson.checks)
    expect(chemistry.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(chemistry.totalCredits).toEqual(economicsJson.totalCredits)
    expect(chemistry.totalCreditsNote).toEqual(economicsJson.totalCreditsNote)
    expect(chemistry.filters).toEqual(economicsJson.filters)
    expect(chemistry.failingGrades).toEqual(economicsJson.failingGrades)
  })

  it('accepts honors general chemistry in its own alternative', () => {
    expect(fits('CHEM 2150', 'general/o2-1')).toBeNull()
    expect(fits('CHEM 2070', 'general/o2-1')).not.toBeNull()
  })

  it('keeps the organic sequences together', () => {
    expect(fits('CHEM 3580', 'organic/o1-2')).toBeNull()
    expect(fits('CHEM 3600', 'organic/o1-2')).not.toBeNull()
  })

  it('rejects non-calculus physics', () => {
    expect(fits('PHYS 1110', 'physics/o2-2')).toBeNull()
    expect(fits('PHYS 1101', 'physics/o1-1')).not.toBeNull()
  })

  it('accepts advanced laboratories and rejects independent research', () => {
    expect(fits('CHEM 3020', 'laboratories')).toBeNull()
    expect(fits('CHEM 4210', 'laboratories')).not.toBeNull()
  })

  it('requires both physical chemistry courses in a sequence', () => {
    const plan: Plan = { ...empty, courses: [{ uid: '1', code: 'CHEM 3870', title: '', credits: 3, term: 'FA26', placement: 'physical/o1-1' }] }
    const result = evaluatePlan(plan, chemistry, new Date(2026, 9, 23))
    expect(result.sections.find((s) => s.section.id === 'physical')?.complete).toBe(false)
  })
})
