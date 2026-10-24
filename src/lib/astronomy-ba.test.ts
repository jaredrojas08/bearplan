import { describe, expect, it } from 'vitest'
import astronomyJson from '../templates/astronomy-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const astronomy = astronomyJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: astronomy.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const astrophysics = withConcentrations(astronomy, ['astrophysics-concentration'])
const general = withConcentrations(astronomy, ['general-astronomy-concentration'])
const fits = (template: Template, code: string, placement: string, distributions: string[] = []) => placeFailure(empty, template, { code, credits: 4, distributions }, placement)

describe('Astronomy (BA)', () => {
  it('validates and preserves the Arts and Sciences requirements', () => {
    expect(templateErrors(astronomy)).toEqual([])
    expect(astronomy.checks.slice(0, economicsJson.checks.length)).toEqual(economicsJson.checks)
    for (const key of ['checkGroups', 'totalCredits', 'totalCreditsNote', 'filters', 'failingGrades'] as const) {
      expect(Reflect.get(astronomy, key)).toEqual(Reflect.get(economicsJson, key))
    }
    expect(astronomy.sections.find(s => s.id === 'pe')).toEqual(economicsJson.sections.find(s => s.id === 'pe'))
    expect(astronomy.requiresConcentration).toBe(true)
  })

  it('accepts the listed math alternative and excludes writing seminars', () => {
    expect(fits(general, 'ASTRO 3340', 'math/s3')).toBeNull()
    expect(fits(general, 'ASTRO 3340', 'math/s3', ['FWS'])).not.toBeNull()
  })

  it('requires both courses in the paired Physics III alternative', () => {
    expect(fits(general, 'PHYS 2218', 'physics/p4')).toBeNull()
    expect(fits(general, 'PHYS 2210', 'physics/p4')).not.toBeNull()
    expect(astronomy.sections[0].slots?.filter(s => s.option === 'PHYS 2218 + PHYS 2210').map(s => s.rule?.[0].codes)).toEqual([['PHYS 2218'], ['PHYS 2210']])
  })

  it('restricts the Astrophysics core data course to ASTRO 4410', () => {
    expect(fits(astrophysics, 'ASTRO 4410', 'data-1/data')).toBeNull()
    expect(fits(astrophysics, 'ASTRO 3334', 'data-1/data')).not.toBeNull()
    expect(fits(general, 'ASTRO 3334', 'data-3/data')).toBeNull()
  })

  it('accepts either subject for the cross-listed statistical thermodynamics course', () => {
    expect(fits(astrophysics, 'PHYS 4230', 'astrophysics/a1-s4')).toBeNull()
    expect(fits(astrophysics, 'AEP 4230', 'astrophysics/a1-s4')).toBeNull()
  })

  it('keeps the General Astronomy choice list specific', () => {
    expect(fits(general, 'ASTRO 4523', 'general-astronomy-co-astronomy/s5')).toBeNull()
    expect(fits(general, 'ASTRO 4940', 'general-astronomy-co-astronomy/s5')).not.toBeNull()
  })

  it('counts upper-level credits only inside the complementary area', () => {
    const plan: Plan = { ...empty, courses: [{ uid: '1', code: 'BIOEE 3000', title: 'T', credits: 8, term: 'FA26', placement: 'additional' }] }
    const check = (p: Plan) => evaluatePlan(p, general, new Date(2026, 9, 1)).checks.find(c => c.check.id === 'external-upper')
    expect(check(plan)?.met).toBe(false)
    expect(check({ ...plan, courses: [{ ...plan.courses[0], placement: 'external' }] })?.met).toBe(true)
  })

  it('only applies the complementary-area check to General Astronomy', () => {
    const plan: Plan = { ...empty, concentrations: ['astrophysics-concentration'] }
    const ids = evaluatePlan(plan, astrophysics, new Date(2026, 9, 1)).checks.map((c) => c.check.id)
    expect(ids).not.toContain('external-upper')
    expect(evaluatePlan(plan, general, new Date(2026, 9, 1)).checks.map((c) => c.check.id)).toContain('external-upper')
  })
})
