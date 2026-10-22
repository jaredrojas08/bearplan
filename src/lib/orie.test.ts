import { describe, expect, it } from 'vitest'
import orieJson from '../templates/operations-research-engineering-bs.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const orie = orieJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: orie.id, entryTerm: 'FA24', gradTerm: 'SP28', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string) => placeFailure(empty, orie, { code, credits: 4 }, placement)

describe('ORIE', () => {
  it('validates and keeps the Engineering college sections', () => {
    expect(templateErrors(orie)).toEqual([])
    expect(orie.sections.map((s) => s.id)).toEqual(expect.arrayContaining(['fws', 'libstudies', 'pe']))
    expect(evaluatePlan(empty, orie, new Date(2026, 9, 1)).checks.map((c) => c.check.id)).toEqual(['ecr'])
  })

  it('applies the major rules', () => {
    expect(fits('ORIE 6300', 'core/r2')).toBeNull()
    expect(fits('ORIE 4580', 'orie-electives')).toBe("Needs an ORIE 4000+ course that isn't a required course")
    expect(fits('ORIE 4740', 'orie-electives')).toBeNull()
    expect(fits('ORIE 3741', 'orie-electives')).toBeNull()
    expect(fits('CHEM 2080', 'fourth/f1')).toBeNull()
    expect(fits('PSYCH 1101', 'major-approved')).toBe('Needs a technical course numbered 2000 or above')
  })
})
