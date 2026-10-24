import { describe, expect, it } from 'vitest'
import cognitiveScienceJson from '../templates/cognitive-science-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const cognitiveScience = cognitiveScienceJson as Template
const economics = economicsJson as Template
const template = cognitiveScience
const empty: Plan = { version: 1, name: 'T', templateId: template.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, template, { code, credits: 3, distributions }, placement)

describe('Cognitive Science BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(cognitiveScience)).toEqual([])
    expect(cognitiveScience.checks.slice(0, economics.checks.length)).toEqual(economics.checks)
    expect(Reflect.get(cognitiveScience, 'checkGroups')).toEqual(Reflect.get(economics, 'checkGroups'))
    expect(cognitiveScience.sections.find((s) => s.id === 'pe')).toEqual(economics.sections.find((s) => s.id === 'pe'))
    expect(cognitiveScience.totalCredits).toEqual(economics.totalCredits)
    expect(cognitiveScience.totalCreditsNote).toEqual(economics.totalCreditsNote)
    expect(cognitiveScience.filters).toEqual(economics.filters)
    expect(cognitiveScience.failingGrades).toEqual(economics.failingGrades)
  })

  it('accepts the listed introductory choices and refuses an unrelated statistics course', () => {
    expect(fits('COGST 2350', 'core/intro')).toBeNull()
    expect(fits('STSCI 2150', 'core/statistics')).toBeNull()
    expect(fits('CS 1380', 'core/structured')).toBeNull()
    expect(fits('MATH 1710', 'core/statistics')).not.toBeNull()
  })

  it('needs breadth courses from three different concentrations', () => {
    expect(fits('COGST 4270', 'breadth/b1')).toBeNull()
    expect(fits('COGST 4820', 'breadth/b1')).not.toBeNull()
    const course = (uid: string, code: string, slot: string) => ({ uid, code, title: '', credits: 3, term: 'FA26', placement: `breadth/${slot}` })
    const twoAreas: Plan = { ...empty, courses: [course('a', 'COGST 2150', 'b1'), course('b', 'COGST 3330', 'b2'), course('c', 'COGST 2090', 'b3')] }
    const breadth = (plan: Plan) => evaluatePlan(plan, template, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'breadth')
    expect(breadth(twoAreas)?.complete).toBe(false)
    const threeAreas: Plan = { ...twoAreas, courses: [...twoAreas.courses.slice(0, 2), course('c', 'COGST 4270', 'b3')] }
    expect(breadth(threeAreas)?.complete).toBe(false)
    const spread: Plan = { ...twoAreas, courses: [course('a', 'COGST 2150', 'b1'), course('b', 'COGST 2090', 'b2'), course('c', 'COGST 1212', 'b3')] }
    expect(breadth(spread)?.complete).toBe(true)
  })

  it('accepts listed outside-department electives only', () => {
    expect(fits('CS 3780', 'depth')).toBeNull()
    expect(fits('CS 2110', 'area/a1')).toBeNull()
    expect(fits('CS 4820', 'depth')).not.toBeNull()
  })

  it('requires depth credits at the stated levels and caps repeatable independent study', () => {
    const plan: Plan = { ...empty, courses: [{ uid: 'one', code: 'COGST 2350', title: '', credits: 9, term: 'FA26', placement: 'depth' }] }
    const result = evaluatePlan(plan, template, new Date(2026, 9, 1))
    expect(result.checks.find((c) => c.check.id === 'depth-credits')?.met).toBe(false)
    const research: Plan = { ...empty, courses: [{ uid: 'research', code: 'COGST 4700', title: '', credits: 12, term: 'FA26', placement: 'depth' }] }
    expect(placeFailure(research, template, { code: 'COGST 4710', credits: 1 }, 'depth')).toBe('At most 12 independent study credits count toward the major')
    const oneSemester: Plan = { ...empty, courses: [{ uid: 'fall', code: 'COGST 4700', title: '', credits: 3, term: 'FA26', placement: 'depth' }] }
    expect(placeFailure(oneSemester, template, { code: 'COGST 4700', credits: 3 }, 'depth')).toBeNull()
  })
})
