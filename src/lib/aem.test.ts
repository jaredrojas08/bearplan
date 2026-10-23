import { describe, expect, it } from 'vitest'
import aemJson from '../templates/aem-cals-2025.json'
import aemPre2025Json from '../templates/aem-cals-pre2025.json'
import type { Plan, PlanCourse, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'

const aem = aemJson as Template
const aemPre2025 = aemPre2025Json as Template
const OCTOBER_2026 = new Date(2026, 9, 18)

const course = (code: string, placement: string, distributions: string[] = [], credits = 3): PlanCourse => ({
  uid: `${code}-${placement}`, code, title: '', credits, term: 'FA25', placement, distributions,
})
const planWith = (courses: PlanCourse[], concentrations: string[] = []): Plan => ({
  version: 1, name: 'Test', templateId: aem.id, entryTerm: 'FA25', gradTerm: 'SP29', swimTest: false, spclArea: '', courses, concentrations,
})
const checkOf = (summary: ReturnType<typeof evaluatePlan>, id: string) => summary.checks.find((c) => c.check.id === id)!

describe('AEM template', () => {
  it('counts a major course toward a CALS distribution too', () => {
    const plan = planWith([course('AEM 2100', 'quant/q2', ['DLS-AG', 'OPHLS-AG', 'MQL-AG'], 4)])
    const summary = evaluatePlan(plan, aem, OCTOBER_2026)
    expect(summary.sections.find((s) => s.section.id === 'quant')!.filled).toBe(1)
    expect(checkOf(summary, 'dls')).toMatchObject({ met: true, text: 'satisfied by AEM 2100' })
    expect(checkOf(summary, 'dl2').met).toBe(false)
  })

  it('accepts any FWS as writing credit', () => {
    const plan = planWith([course('ANTHR 1101', 'additional', ['FWS']), course('WRIT 1370', 'additional', ['WRT-AG', 'FWS'])])
    expect(checkOf(evaluatePlan(plan, aem, OCTOBER_2026), 'writing').text).toBe(
      '6 / 9 cr so far (ANTHR 1101, WRIT 1370), needs 9 credits of writing (FWS or WRT-AG), at least 6 written; one ORL-AG course may count.',
    )
  })

  it('needs two Applied Economics categories', () => {
    const one = evaluatePlan(planWith([course('AEM 2500', 'applied-econ'), course('AEM 4500', 'applied-econ')]), aem, OCTOBER_2026)
    expect(one.whatsLeft.find((l) => l.sectionId === 'applied-econ')?.needs).toEqual(['Categories 1 / 2'])
    const two = evaluatePlan(planWith([course('AEM 2500', 'applied-econ'), course('AEM 4100', 'applied-econ')]), aem, OCTOBER_2026)
    expect(two.whatsLeft.find((l) => l.sectionId === 'applied-econ')).toBeUndefined()
  })

  it('adds Business Analytics rows only when picked', () => {
    const base = planWith([])
    expect(evaluatePlan(base, aem, OCTOBER_2026).whatsLeft.map((l) => l.sectionId)).not.toContain('ba-req')
    const picked = planWith([], ['business-analytics'])
    const template = withConcentrations(aem, picked.concentrations)
    expect(evaluatePlan(picked, template, OCTOBER_2026).whatsLeft.filter((l) => l.sectionId.startsWith('ba-'))).toEqual([
      { sectionId: 'ba-req', label: 'Business Analytics', open: 3, needs: [] },
      { sectionId: 'ba-elec', label: 'Analytics electives', open: 1, creditsToGo: 6, needs: [] },
    ])
    expect(placeFailure(picked, template, { code: 'AEM 2840', credits: 3 }, 'ba-req/ba2')).toBeNull()
    expect(placeFailure(picked, template, { code: 'AEM 4570', credits: 3 }, 'ba-elec')).toBe('Not on the Analytics electives list')
  })

  it('caps AEM 3520 and 3360 at one course in Finance electives', () => {
    const plan = planWith([course('AEM 3520', 'fin-elec')], ['finance'])
    const template = withConcentrations(aem, plan.concentrations)
    expect(placeFailure(plan, template, { code: 'AEM 3360', credits: 3 }, 'fin-elec')).toBe('Only one of AEM 3520 and AEM 3360 counts here')
  })

  it('uses the older CALS rules in the pre-2025 template', () => {
    const plan = { ...planWith([course('BIOEE 1610', 'additional', ['BIO-AG', 'OPHLS-AG'], 4)]), templateId: aemPre2025.id }
    const summary = evaluatePlan(plan, aemPre2025, OCTOBER_2026)
    expect(checkOf(summary, 'bio').text).toMatch(/^4 \/ 6 cr so far \(BIOEE 1610\)/)
    expect(checkOf(summary, 'pls').text).toMatch(/^4 \/ 18 cr so far \(BIOEE 1610\)/)
  })
})

describe('pre-2025 CALS credits', () => {
  it('counts AIIS courses, the roster subject for American Indian and Indigenous Studies', () => {
    const plan = { ...planWith([course('AIIS 1100', 'additional')]), templateId: aemPre2025.id }
    expect(evaluatePlan(plan, aemPre2025, OCTOBER_2026).checks.find((c) => c.check.id === 'cals-credits')?.text).toMatch(/^3 \/ 55 cr so far \(AIIS 1100\)/)
  })
})
