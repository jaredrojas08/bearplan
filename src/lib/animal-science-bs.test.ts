import { describe, expect, it } from 'vitest'
import bsJson from '../templates/animal-science-bs.json'
import preJson from '../templates/animal-science-bs-cals-pre2025.json'
import info from '../templates/information-science-bs.json'
import infoPre from '../templates/information-science-bs-cals-pre2025.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const bs = bsJson as Template
const pre = preJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: bs.id, entryTerm: 'FA25', gradTerm: 'SP29', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, concentration: string) => placeFailure(empty, withConcentrations(bs, [concentration]), { code, credits: 4 }, placement)

describe('Animal Science (BS)', () => {
  it.each([bs, pre])('$id validates with every concentration', (t) => {
    expect(templateErrors(t)).toEqual([])
    expect(t.requiresConcentration).toBe(true)
    expect(t.concentrations).toHaveLength(5)
  })

  it('copies the college rules and university section exactly', () => {
    for (const [t, source] of [[bs, info], [pre, infoPre]] as const) {
      expect(t.checks.slice(2)).toEqual(source.checks)
      expect(t.sections.find((s) => s.id === 'pe')).toEqual(info.sections.find((s) => s.id === 'pe'))
      expect(t.totalCreditsNote).toBe(info.totalCreditsNote)
      expect(t.failingGrades).toEqual(['F'])
    }
    expect(pre.sections).toEqual(bs.sections)
    expect(pre.concentrations).toEqual(bs.concentrations)
  })

  it('accepts only the listed management choices', () => {
    expect(fits('ANSC 2650', 'core/management', 'pre-veterinary-medicine')).toBeNull()
    expect(fits('ANSC 3510', 'core/management', 'pre-veterinary-medicine')).not.toBeNull()
  })

  it('keeps the concentration nutrition and physiology lists distinct', () => {
    expect(fits('ANSC 3550', 'vet-advanced', 'pre-veterinary-medicine')).toBeNull()
    expect(fits('ANSC 2120', 'vet-advanced', 'pre-veterinary-medicine')).not.toBeNull()
    const t = withConcentrations(bs, ['pre-veterinary-medicine'])
    const plan: Plan = { ...empty, courses: [{ uid: 'n', code: 'ANSC 3550', title: '', credits: 11, term: 'FA25', placement: 'vet-advanced' }] }
    expect(evaluatePlan(plan, t, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'vet-advanced')?.complete).toBe(false)
  })

  it('allows the dairy data-science alternative and requires its prerequisite', () => {
    expect(fits('ANSC 4040', 'dairy-core/reproduction-data', 'dairy-management')).toBeNull()
    expect(fits('ANSC 2500', 'dairy-core/prerequisite', 'dairy-management')).toBeNull()
    expect(fits('ANSC 2650', 'dairy-core/prerequisite', 'dairy-management')).not.toBeNull()
  })

  it('accepts research from other departments but caps its contribution', () => {
    const t = withConcentrations(bs, ['integrative-physiology-nutrition'])
    expect(placeFailure(empty, t, { code: 'BIOG 4990', credits: 3 }, 'integrative-laboratory')).toBeNull()
    expect(placeFailure(empty, t, { code: 'BIOG 4990', credits: 4 }, 'integrative-laboratory')).not.toBeNull()
    expect(fits('BIOG 1500', 'integrative-laboratory', 'integrative-physiology-nutrition')).toBeNull()
    expect(fits('CHEM 2070', 'integrative-laboratory', 'integrative-physiology-nutrition')).not.toBeNull()
  })

  it('keeps general chemistry lecture and lab alternatives paired', () => {
    expect(fits('CHEM 1561', 'ecology-chemistry/CHEM-1561', 'animal-ecology-conservation')).toBeNull()
    expect(fits('CHEM 2071', 'ecology-chemistry/CHEM-1561', 'animal-ecology-conservation')).not.toBeNull()
  })

  it('counts every semester of research toward the 36 ANSC credits', () => {
    const course = (uid: string, code: string, credits: number) => ({ uid, code, title: '', credits, term: 'FA26', placement: 'additional' })
    const plan: Plan = { ...empty, courses: [course('a', 'ANSC 3000', 34), course('b', 'ANSC 4990', 1), course('c', 'ANSC 4990', 1)] }
    expect(evaluatePlan(plan, bs, new Date(2026, 9, 1)).checks.find((c) => c.check.id === 'animal-credits')?.met).toBe(true)
  })

  it('keeps lab courses out of the Integrative economics row', () => {
    expect(fits('ECON 1110', 'integrative-economics/course', 'integrative-physiology-nutrition')).toBeNull()
    expect(fits('ANSC 2410', 'integrative-economics/course', 'integrative-physiology-nutrition')).not.toBeNull()
  })
})
