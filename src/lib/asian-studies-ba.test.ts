import { describe, expect, it } from 'vitest'
import asianJson from '../templates/asian-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const asian = asianJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: asian.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string) => placeFailure(empty, asian, { code, credits: 3 }, 'major')
const planWith = (...codes: string[]): Plan => ({
  ...empty,
  courses: codes.map((code, i) => ({ uid: String(i), code, title: code, credits: 3, term: 'FA25', placement: 'major', grade: 'B' })),
})
const majorResult = (plan: Plan) => evaluatePlan(plan, asian, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'major')!

describe('Asian Studies BA', () => {
  it('validates and copies the Arts and Sciences college parts exactly', () => {
    expect(templateErrors(asian)).toEqual([])
    expect(asian.college).toBe('Arts and Sciences')
    expect(asian.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(asian, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(asian.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(asian.totalCredits).toBe(economicsJson.totalCredits)
    expect(asian.totalCreditsNote).toBe(economicsJson.totalCreditsNote)
    expect(asian.filters).toEqual(economicsJson.filters)
    expect(asian.failingGrades).toEqual(['B-', 'C+', 'C', 'C-', ...economicsJson.failingGrades])
  })

  it('accepts listed cross-listings at 2200 or above and refuses lower or unrelated courses', () => {
    expect(fits('RELST 2279')).toBeNull()
    expect(fits('HIST 1740')).not.toBeNull()
    expect(fits('ECON 1110')).not.toBeNull()
    expect(placeFailure(empty, asian, { code: 'ASIAN 2208', credits: 3, distributions: ['FWS'] }, 'major')).not.toBeNull()
  })

  it('requires the specified ASIAN levels and two distinct content categories', () => {
    const result = majorResult(planWith('ASIAN 3303', 'ASIAN 4411'))
    expect(result.chips.map((c) => c.ok)).toEqual([true, true, false, true])
    const broader = majorResult(planWith('ASIAN 3303', 'ASIAN 4411', 'RELST 2299'))
    expect(broader.chips.every((c) => c.ok)).toBe(true)
    expect(majorResult(planWith('ASIAN 3501', 'ASIAN 4506')).chips.slice(0, 2).map((c) => c.ok)).toEqual([false, false])
  })

  it('refuses a third listed introductory course', () => {
    const plan = planWith('ASIAN 2208', 'ASIAN 2211')
    expect(placeFailure(plan, asian, { code: 'ASIAN 2218', credits: 3 }, 'major')).toBe('Only two of the eight listed introductory ASIAN courses may count toward the major.')
    expect(placeFailure(plan, asian, { code: 'ASIAN 2279', credits: 3 }, 'major')).toBeNull()
  })

  it('requires 30 credits without treating table Hours as extra minimums', () => {
    const result = majorResult(planWith('ASIAN 3303', 'ASIAN 4411', 'RELST 2299'))
    expect(result.creditsToGo).toBe(21)
    expect(result.complete).toBe(false)
    expect(asian.sections.find((s) => s.id === 'major')?.constraints?.some((c) => c.type === 'minCredits')).toBe(false)
  })

  it('warns for grades below B and for S/U', () => {
    for (const grade of ['B-', 'C+', 'C', 'C-', 'S', 'U']) {
      const plan = planWith('ASIAN 3303')
      plan.courses[0].grade = grade
      expect(evaluatePlan(plan, asian, new Date(2026, 9, 1)).warnings['0']).toBeDefined()
    }
    expect(evaluatePlan(planWith('ASIAN 3303'), asian, new Date(2026, 9, 1)).warnings).toEqual({})
  })
})
