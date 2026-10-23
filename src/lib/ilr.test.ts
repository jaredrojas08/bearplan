import { describe, expect, it } from 'vitest'
import ilrJson from '../templates/industrial-labor-relations-bs.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const ilr = ilrJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: ilr.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, ilr, { code, credits: 3, distributions }, placement)

describe('ILR', () => {
  it('validates and keeps the university requirements', () => {
    expect(templateErrors(ilr)).toEqual([])
    expect(ilr.sections.find((s) => s.id === 'pe')).toMatchObject({ swimTest: true, excludeFromCredits: true })
  })

  it('accepts the stated core alternatives and refuses unrelated courses', () => {
    expect(fits('EDUC 2610', 'core/dei')).toBeNull()
    expect(fits('ILRGL 2350', 'core/international')).toBeNull()
    expect(fits('ECON 1120', 'core/c8')).not.toBeNull()
  })

  it('requires the statistics distribution rather than any quantitative course', () => {
    expect(fits('ECON 1110', 'statistics')).not.toBeNull()
  })

  it('keeps out-of-college language electives out of the in-college minimum', () => {
    expect(fits('TRAN 9999', 'in-college', ['OCL-IL'])).not.toBeNull()
  })

  it('allows a roster-approved core section to satisfy sophomore writing too', () => {
    const plan: Plan = {
      ...empty,
      courses: [{ uid: 'law', code: 'ILRGL 2010', title: 'Labor and Employment Law', credits: 3, term: 'SP24', grade: 'B', distributions: ['SOW-IL'], placement: 'core/c5' }],
    }
    const result = evaluatePlan(plan, ilr, new Date(2026, 9, 1))
    expect(result.checks.find((c) => c.check.id === 'sow')?.met).toBe(true)
  })
})

describe('ILR elective distribution checks', () => {
  it('count only courses placed in the in-college electives', () => {
    const course = (placement: string) => ({ uid: placement, code: 'ILRLE 4400', title: '', credits: 3, term: 'FA25', placement, distributions: ['QP-IL', 'ICE-IL'] })
    const check = (placement: string) =>
      evaluatePlan({ ...empty, courses: [course(placement)] }, ilr, new Date(2026, 9, 1)).checks.find((c) => c.check.id === 'qp')!.met
    expect(check('in-college')).toBe(true)
    expect(check('advanced-balance')).toBe(false)
  })
})

describe('check section ids', () => {
  it('must name a section in the template', () => {
    const typo = { ...ilr, checks: ilr.checks.map((c) => (c.id === 'qp' ? { ...c, section: 'in-colege' } : c)) }
    expect(templateErrors(typo)).toEqual([expect.stringMatching(/section must be the id of a section/)])
  })
})
