import { describe, expect, it } from 'vitest'
import germanJson from '../templates/german-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const german = germanJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: german.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, german, { code, credits: 3, distributions }, placement)

describe('German Studies BA', () => {
  it('validates and preserves the Arts and Sciences requirements', () => {
    expect(templateErrors(german)).toEqual([])
    for (const key of ['checks', 'checkGroups', 'totalCredits', 'totalCreditsNote', 'filters', 'failingGrades'] as const) {
      expect(Reflect.get(germanJson, key)).toEqual(Reflect.get(economicsJson, key))
    }
    expect(german.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
  })

  it('accepts the admission and major course ranges and excludes FWS', () => {
    expect(fits('GERST 2020', 'admission/a1')).toBeNull()
    expect(fits('GERST 3000', 'major-courses/l1')).toBeNull()
    expect(fits('GERST 3210', 'major-courses/l1')).not.toBeNull()
    expect(fits('GERST 3210', 'major-courses/g1')).toBeNull()
    expect(fits('GERST 3210', 'major-courses/g1', ['FWS'])).not.toBeNull()
  })

  it('requires 25 credits even when all eight course rows are filled', () => {
    const section = german.sections.find((s) => s.id === 'major-courses')!
    const plan: Plan = { ...empty, courses: section.slots!.map((slot, i) => ({ uid: String(i), code: `GERST ${3000 + i}`, title: 'T', credits: 3, term: 'FA26', placement: `${section.id}/${slot.id}` })) }
    const result = evaluatePlan(plan, german, new Date(2026, 9, 1)).sections.find((s) => s.section.id === section.id)!
    expect(result.complete).toBe(false)
    expect(result.chips.find((c) => c.label === 'Major coursework credits')?.ok).toBe(false)
    plan.courses[0]!.credits = 4
    expect(evaluatePlan(plan, german, new Date(2026, 9, 1)).sections.find((s) => s.section.id === section.id)?.complete).toBe(true)
  })
})
