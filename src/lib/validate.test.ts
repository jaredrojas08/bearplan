import { describe, expect, it } from 'vitest'
import examplePlan from '../seed/example-plan.json'
import csTemplate from '../templates/cs-engineering-fa24.json'
import type { Plan, Template } from '../types'
import { normalizePlan, planErrors, templateErrors } from './validate'

describe('validation', () => {
  it('accepts the bundled template and example plan', () => {
    expect(templateErrors(csTemplate)).toEqual([])
    expect(planErrors(examplePlan)).toEqual([])
  })

  it('rejects malformed templates', () => {
    expect(templateErrors('nope')).toEqual(['The file is not a JSON object'])
    expect(
      templateErrors({ ...csTemplate, matriculatedFrom: 'Fall', sections: [{ id: 'a/b', title: 'X', column: 'mid', type: 'slots', slots: [{ id: 's', rule: [{ minLevel: '3000' }] }] }] }),
    ).toEqual([
      '"matriculatedFrom" must look like FA24',
      'sections[0].id must be a name without "/"',
      'sections[0].column must be "left" or "right"',
      'sections[0].slots[0].rule[0].minLevel must be a number',
    ])
    const section = {
      id: 'x', title: 'X', column: 'left', type: 'slots',
      slots: [{ id: 's' }, { id: 's' }],
      constraints: [{ type: 'minCount', label: 'Two', count: 2 }, { type: 'mystery' }],
    }
    expect(templateErrors({ ...csTemplate, sections: [section], checks: [{ id: 'c', codes: [] }] })).toEqual([
      'sections[0].slots[1].id "s" is used twice',
      'sections[0].constraints[0].match: a match must be an object',
      'sections[0].constraints[1].type "mystery" is not supported',
      'checks[0] needs metText and missText',
    ])
  })

  it('rejects malformed plans', () => {
    expect(planErrors({ ...examplePlan, entryTerm: 'SP28', gradTerm: 'FA24' })).toEqual(['Graduation term is before the entry term'])
    expect(planErrors({ ...examplePlan, courses: [{ uid: 'a', code: 'CS 1110', title: '', credits: 99, term: 'FA24', placement: 'intro/intro' }] })).toEqual([
      'courses[0].credits must be 0 to 30',
    ])
    const course = { uid: 'a', code: 'CS 1110', title: '', credits: 4, term: 'FA24', placement: 'intro/intro' }
    expect(planErrors({ ...examplePlan, courses: [{ ...course, grade: 4 }, course] })).toEqual([
      'courses[0].grade must be text',
      'courses[1].uid "a" is used twice',
    ])
  })

  it('moves unknown or doubled placements to additional space', () => {
    const plan = examplePlan as Plan
    const messy: Plan = {
      ...plan,
      courses: [
        ...plan.courses,
        { uid: 'a', code: 'MATH 1910', title: '', credits: 4, term: 'FA24', placement: 'calculus/m1' },
        { uid: 'b', code: 'X 1', title: '', credits: 1, term: 'FA24', placement: 'gone/slot' },
        { uid: 'c', code: 'X 2', title: '', credits: 1, term: 'FA24', placement: 'core/c1/extra' },
      ],
    }
    const fixed = normalizePlan(messy, csTemplate as Template)
    expect(fixed.courses.slice(-3).map((c) => c.placement)).toEqual(['additional', 'additional', 'additional'])
  })
})
