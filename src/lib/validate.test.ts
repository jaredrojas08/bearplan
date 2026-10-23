import { describe, expect, it } from 'vitest'
import examplePlan from '../seed/example-plan.json'
import aemTemplate from '../templates/aem-cals-2025.json'
import aemPre2025Template from '../templates/aem-cals-pre2025.json'
import csTemplate from '../templates/cs-engineering-fa24.json'
import type { Plan, Template } from '../types'
import { normalizePlan, planErrors, templateErrors } from './validate'

describe('validation', () => {
  it('accepts the bundled template and example plan', () => {
    expect(templateErrors(csTemplate)).toEqual([])
    expect(templateErrors(aemTemplate)).toEqual([])
    expect(templateErrors(aemPre2025Template)).toEqual([])
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
      constraints: [
        { type: 'minCount', label: 'Two', count: 2 },
        { type: 'mystery' },
        { type: 'minCredits', label: 'Neg', credits: -3 },
        { type: 'minGroups', label: 'Half', count: 1.5 },
        { type: 'minCredits', label: 'Huge', credits: Infinity },
      ],
    }
    expect(templateErrors({ ...csTemplate, sections: [section], checks: [{ id: 'c', title: 'C', codes: [] }] })).toEqual([
      'sections[0].slots[1].id "s" is used twice',
      'sections[0].constraints[0].match: a match must be an object',
      'sections[0].constraints[1].type "mystery" is not supported',
      'sections[0].constraints[2].credits must be a number of at least 0',
      'sections[0].constraints[3].count must be a whole number of at least 0',
      'sections[0].constraints[4].credits must be a number of at least 0',
      'checks[0] needs a codes list or a match list',
      'checks[0] needs metText and missText',
    ])
  })

  it('validates counted checks and concentrations', () => {
    const check = { id: 'c', title: 'C', metText: 'ok', missText: 'no' }
    const section = { id: 'conc', title: 'Conc', column: 'right', filter: 'x', type: 'slots', slots: [{ id: 's' }] }
    expect(
      templateErrors({
        ...csTemplate,
        checks: [{ ...check, match: [{ minLevel: 'high' }], count: 0, credits: -1 }, { ...check, codes: ['A 1'], group: 3 }],
        concentrations: [
          { id: 'a', name: 'A', sections: [section] },
          { id: 'a', name: 'B', sections: [{ ...section, id: 'core' }] },
          { id: 'c', name: 'C', sections: [] },
        ],
        maxConcentrations: 0,
        matriculatedBefore: 'soon',
      }),
    ).toEqual([
      '"matriculatedBefore" must look like FA25',
      'concentrations[1].id "a" is used twice',
      'concentrations[1].sections[0].id "core" is used twice',
      'concentrations[2].sections must be a non-empty list',
      '"maxConcentrations" must be a whole number of at least 1',
      'checks[0].match[0].minLevel must be a number',
      'checks[0].count must be a whole number of at least 1',
      'checks[0].credits must be a number above 0',
      'checks[1].group must be text',
    ])
    expect(planErrors({ ...examplePlan, concentrations: 'finance' })).toEqual(['"concentrations" must be a list of ids'])
  })

  it('keeps only offered concentrations, up to the limit, and their placements', () => {
    const slots = (id: string) => [{ id, title: id, column: 'right', filter: 'x', type: 'slots', slots: [{ id: 's' }] }]
    const template = {
      ...(csTemplate as Template),
      concentrations: [
        { id: 'a', name: 'A', sections: slots('a-req') },
        { id: 'b', name: 'B', sections: slots('b-req') },
      ],
    } as Template
    const plan: Plan = {
      ...(examplePlan as Plan),
      concentrations: ['gone', 'a', 'a', 'b'],
      courses: [
        { uid: 'x', code: 'AEM 1', title: '', credits: 3, term: 'FA24', placement: 'a-req/s' },
        { uid: 'y', code: 'AEM 2', title: '', credits: 3, term: 'FA24', placement: 'b-req/s' },
      ],
    }
    const fixed = normalizePlan(plan, template)
    expect(fixed.concentrations).toEqual(['a'])
    expect(fixed.courses.map((c) => c.placement)).toEqual(['a-req/s', 'additional'])
    // A repeated id doesn't use up a slot.
    expect(normalizePlan(plan, { ...template, maxConcentrations: 2 }).courses.map((c) => c.placement)).toEqual(['a-req/s', 'b-req/s'])
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
    expect(planErrors({ ...examplePlan, repeatable: 'CS 4998' })).toEqual(['"repeatable" must be a list of course codes'])
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
    const fixed = normalizePlan({ ...messy, repeatable: [' music  3610 '] }, csTemplate as Template)
    expect(fixed.repeatable).toEqual(['MUSIC 3610'])
    expect(fixed.courses.slice(-3).map((c) => c.placement)).toEqual(['additional', 'additional', 'additional'])
  })
})

describe('required concentrations', () => {
  it('need concentrations to pick from', () => {
    const message = '"requiresConcentration" needs a non-empty "concentrations" list'
    expect(templateErrors({ ...csTemplate, requiresConcentration: true })).toEqual([message])
    expect(templateErrors({ ...csTemplate, requiresConcentration: true, concentrations: [] })).toEqual([message])
  })
})
