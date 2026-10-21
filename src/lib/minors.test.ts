import { describe, expect, it } from 'vitest'
import aemJson from '../templates/aem-cals-2025.json'
import businessJson from '../templates/business-minor.json'
import engineersJson from '../templates/business-minor-engineers.json'
import csJson from '../templates/cs-engineering-fa24.json'
import type { Plan, PlanCourse, Template } from '../types'
import { evaluatePlan, placeFailure, withMinors } from './requirements'
import { normalizePlan, templateErrors } from './validate'

const cs = csJson as Template
const business = businessJson as Template
const engineers = engineersJson as Template
const OCTOBER_2026 = new Date(2026, 9, 18)

const course = (code: string, placement: string, credits = 3, grade?: string): PlanCourse => ({
  uid: `${code}@${placement}`, code, title: '', credits, term: 'FA25', placement, ...(grade ? { grade } : {}),
})
const planWith = (courses: PlanCourse[], minors = ['business-minor-engineers']): Plan => ({
  version: 1, name: 'Test', templateId: cs.id, entryTerm: 'FA24', gradTerm: 'SP28', swimTest: false, spclArea: '', courses, minors,
})
const template = withMinors(cs, [engineers])
const check = (plan: Plan, id: string) => evaluatePlan(plan, template, OCTOBER_2026).checks.find((c) => c.check.id === id)!

describe('minors', () => {
  it('validates the bundled minors', () => {
    expect(templateErrors(business)).toEqual([])
    expect(templateErrors(engineers)).toEqual([])
    expect(templateErrors({ ...business, totalCredits: 18, minUniqueCredits: -1 })).toEqual([
      '"minUniqueCredits" must be a number of at least 0',
      'A minor can\'t set "totalCredits"',
    ])
  })

  it('adds prefixed sections, a filter and scoped checks', () => {
    expect(template.sections.slice(-2).map((s) => [s.id, s.filter, s.minor])).toEqual([
      ['business-minor-engineers.core', 'minor:business-minor-engineers', 'business-minor-engineers'],
      ['business-minor-engineers.career', 'minor:business-minor-engineers', 'business-minor-engineers'],
    ])
    expect(template.filters.at(-1)).toEqual({ id: 'minor:business-minor-engineers', label: 'Business for Engineers', icon: 'book' })
    expect(template.checks.at(-1)?.id).toBe('business-minor-engineers.jcb')
  })

  it('lets one course count for the major and the minor, but not twice in the major', () => {
    const plan = planWith([course('ECON 1110', 'libstudies/ls1')])
    expect(placeFailure(plan, template, { code: 'ECON 1110', credits: 3 }, 'business-minor-engineers.core/micro')).toBeNull()
    expect(placeFailure(plan, template, { code: 'ECON 1110', credits: 3 }, 'libstudies/ls2')).toBe('Already counted in Liberal Studies')
    const shared = planWith([course('ECON 1110', 'libstudies/ls1'), course('ECON 1110', 'business-minor-engineers.core/micro')])
    const summary = evaluatePlan(shared, template, OCTOBER_2026)
    expect(Object.values(summary.warnings).flat()).not.toContain('Used twice')
    // Shared courses count once toward the degree total.
    expect(summary.credits.total).toBe(3)
  })

  it('counts unique credits and scopes business-school credits to the minor', () => {
    const plan = planWith([
      course('ECON 1110', 'libstudies/ls1'),
      course('ECON 1110', 'business-minor-engineers.core/micro'),
      course('AEM 2241', 'business-minor-engineers.core/fin'),
      course('AEM 2210', 'advisor-approved'),
    ])
    expect(check(plan, 'business-minor-engineers.unique').text).toBe('3 / 12 cr not shared with your major so far.')
    // AEM 2210 sits in the major, so it doesn't count toward the minor's business-school credits.
    expect(check(plan, 'business-minor-engineers.jcb').text).toMatch(/^3 \/ 7.5 cr so far \(AEM 2241\)/)
  })

  it('flags S/U in minor rows even when the major lists no failing grades', () => {
    const aem = withMinors(aemJson as Template, [business])
    const plan = { ...planWith([course('AEM 2241', 'business-minor.core/fin', 3, 'S')], ['business-minor']), templateId: 'aem-cals-2025' }
    expect(evaluatePlan(plan, aem, OCTOBER_2026).warnings['AEM 2241@business-minor.core/fin']).toEqual(['S/U in letter-grade row'])
  })

  it('drops unknown minors and moves their courses to additional space', () => {
    const plan = planWith([course('AEM 2241', 'business-minor-engineers.core/fin'), course('AEM 2210', 'gone.core/acct')], [
      'business-minor-engineers', 'gone', 'cs-engineering-fa24',
    ])
    const fixed = normalizePlan(plan, cs, [cs, business, engineers])
    expect(fixed.minors).toEqual(['business-minor-engineers'])
    expect(fixed.courses.map((c) => c.placement)).toEqual(['business-minor-engineers.core/fin', 'additional'])
  })
})
