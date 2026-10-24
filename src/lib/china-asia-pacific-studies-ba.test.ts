import { describe, expect, it } from 'vitest'
import capsJson from '../templates/china-asia-pacific-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const caps = capsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: caps.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 4, distributions: string[] = []) =>
  placeFailure(empty, caps, { code, credits, distributions }, placement)

describe('China and Asia-Pacific Studies (BA)', () => {
  it('validates and preserves the Arts and Sciences requirements', () => {
    expect(templateErrors(caps)).toEqual([])
    expect(caps.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(caps, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(caps.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(caps.totalCredits).toEqual(economicsJson.totalCredits)
    expect(caps.totalCreditsNote).toEqual(economicsJson.totalCreditsNote)
    expect(caps.filters).toEqual(economicsJson.filters)
    expect(caps.failingGrades).toEqual(economicsJson.failingGrades)
  })

  it('accepts a listed gateway but refuses an unlisted gateway', () => {
    expect(fits('CAPS 3967', 'caps/gateway')).toBeNull()
    expect(fits('CAPS 4049', 'caps/gateway')).not.toBeNull()
  })

  it('accepts the transition alternative', () => {
    expect(fits('CAPS 4003', 'caps/transition')).toBeNull()
  })

  it('requires at least three credits for independent study as core', () => {
    expect(fits('CAPS 4999', 'caps/core-choice1', 2)).not.toBeNull()
    expect(fits('CAPS 4999', 'caps/core-choice1', 3)).toBeNull()
    expect(fits('CAPS 4999', 'caps/core-choice2', 3)).not.toBeNull()
  })

  it('accepts CAPS electives and excludes writing seminars and other subjects', () => {
    expect(fits('CAPS 2435', 'caps/elective1')).toBeNull()
    expect(fits('CAPS 2435', 'caps/elective1', 4, ['FWS'])).not.toBeNull()
    expect(fits('CHIN 3301', 'caps/elective1')).not.toBeNull()
  })

  it('keeps the CAPS credit minimum unmet even when all eight rows are filled', () => {
    const section = caps.sections.find((s) => s.id === 'caps')!
    const codes = ['CAPS 2132', 'CAPS 4001', 'CAPS 4002', 'CAPS 4030', 'CAPS 4049', 'CAPS 4127', 'CAPS 2435', 'CAPS 3967']
    const plan: Plan = { ...empty, courses: section.slots!.map((slot, i) => ({ uid: String(i), code: codes[i]!, title: '', credits: 3, term: 'FA22', placement: `caps/${slot.id}` })) }
    const result = evaluatePlan(plan, caps, new Date(2026, 9, 1)).sections[0]!
    expect(result.open).toBe(0)
    expect(result.complete).toBe(false)
    plan.courses.forEach((course) => { course.credits = 4 })
    expect(evaluatePlan(plan, caps, new Date(2026, 9, 1)).sections[0]!.complete).toBe(true)
  })
})
