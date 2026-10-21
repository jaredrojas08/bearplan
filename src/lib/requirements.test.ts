import { describe, expect, it } from 'vitest'
import examplePlan from '../seed/example-plan.json'
import csTemplate from '../templates/cs-engineering-fa24.json'
import type { Plan, PlanCourse, Section, Template } from '../types'
import { assignGroups, evaluatePlan, matchFailure, placeFailure, withConcentrations } from './requirements'

const template = csTemplate as Template
const plan = examplePlan as Plan
const OCTOBER_2026 = new Date(2026, 9, 18)

const course = (code: string, credits = 3, distributions?: string[]) => ({ code, credits, distributions })
const withCourses = (...extra: Partial<PlanCourse>[]): Plan => ({
  ...plan,
  courses: [
    ...plan.courses,
    ...extra.map((c, i) => ({ uid: `x${i}`, title: '', credits: 3, term: 'SP27', placement: 'additional', code: '', ...c })),
  ],
})

describe('seed plan', () => {
  const summary = evaluatePlan(plan, template, OCTOBER_2026)

  it("computes what's left", () => {
    expect(summary.whatsLeft).toEqual([
      { sectionId: 'libstudies', label: 'Liberal Studies', open: 4, needs: ['Credits 6 / 18', '2000+ 1 / 2', 'Groups 2 / 3', 'Race & Equity 0 / 3 cr'] },
      { sectionId: 'physics', label: 'Physics', open: 1, needs: [] },
      { sectionId: 'pe', label: 'PE', open: 1, needs: [] },
      { sectionId: 'core', label: 'CS Core', open: 1, needs: [] },
      { sectionId: 'cs-electives', label: 'CS Electives', open: 2, needs: [] },
      { sectionId: 'cs-project', label: 'CS Project', open: 1, needs: [] },
      { sectionId: 'tech-electives', label: 'Technical Elective', open: 1, needs: [] },
      { sectionId: 'ext-spec', label: 'External Spec.', open: 3, needs: [] },
      { sectionId: 'advisor-approved', label: 'Advisor-Approved', open: 1, creditsToGo: 2, needs: [] },
    ])
  })

  it('counts progress units by status', () => {
    expect(summary.counts).toEqual({ done: 21, prog: 3, plan: 0, empty: 15 })
  })

  it('totals credits without PE', () => {
    expect(summary.credits).toEqual({ done: 71, prog: 17, plan: 0, total: 88, required: 123 })
  })

  it('meets both plan-wide checks', () => {
    expect(summary.checks.map((c) => [c.check.id, c.met, c.text])).toEqual([
      ['probability', true, 'satisfied by BTRY 3080'],
      ['ecr', true, 'satisfied by ENGRC 3152 (also counts where it sits)'],
    ])
  })

  it('assigns Liberal Studies groups', () => {
    const ls = summary.sections.find((s) => s.section.id === 'libstudies')!
    expect(ls.groupOf).toEqual({ 'seed-03': 'G4', 'seed-04': 'G1' })
  })

  it('shows upper limits as limits, not as progress', () => {
    const ls = summary.sections.find((s) => s.section.id === 'libstudies')!
    expect(ls.chips.find((c) => c.label === 'CE')).toEqual({ label: 'CE', text: 'max 2, 0 used', ok: true, limit: true })
  })

  it('has no warnings, since the S/U grade sits in a bucket without a letter-grade rule', () => {
    expect(summary.warnings).toEqual({})
  })

  it('lists credits per term', () => {
    expect(summary.terms.map((t) => [t.term, t.status, t.credits])).toEqual([
      ['FA24', 'done', 17], ['SP25', 'done', 15], ['FA25', 'done', 19], ['SP26', 'done', 20],
      ['FA26', 'prog', 17], ['SP27', 'plan', 0], ['FA27', 'plan', 0], ['SP28', 'plan', 0],
    ])
  })
})

describe('refused moves', () => {
  const astro = plan.courses.find((c) => c.code === 'ASTRO 1101')!

  it('keeps ASTRO 1101 out of Liberal Studies', () => {
    expect(placeFailure(plan, template, astro, 'libstudies/ls3', astro.uid)).toBe(
      'OPHLS-AG, PHS-AS, SCT-IL are not Liberal Studies categories',
    )
  })

  it('allows a move into a slot whose rule matches', () => {
    expect(placeFailure(plan, template, course('CS 4410', 4), 'core/c5')).toBeNull()
    expect(placeFailure(plan, template, astro, 'major-approved', astro.uid)).toBeNull()
  })

  it('refuses a course already counted elsewhere', () => {
    expect(placeFailure(plan, template, course('CS 3700'), 'cs-electives/ce1')).toBe('Already counted in CS Core')
  })

  it('allows repeatable courses more than once, from the template or the plan', () => {
    const twice = withCourses({ code: 'MUSIC 3610', credits: 2 }, { code: 'CS 4998', credits: 2 })
    expect(placeFailure(twice, template, course('MUSIC 3610', 2), 'additional')).toBe('Already counted in Additional space')
    expect(placeFailure(twice, template, course('CS 4998', 2), 'additional')).toBeNull()

    const marked: Plan = { ...twice, repeatable: ['MUSIC 3610'], courses: [...twice.courses, { ...twice.courses.at(-2)!, uid: 'again' }] }
    expect(placeFailure(marked, template, course('MUSIC 3610', 2), 'additional')).toBeNull()
    const summary = evaluatePlan(marked, template, OCTOBER_2026)
    expect(summary.warnings.again).toBeUndefined()
    expect(summary.credits.plan).toBe(6)
  })

  it('lets the moving course leave its own slot for another', () => {
    const cs3700 = plan.courses.find((c) => c.code === 'CS 3700')!
    expect(placeFailure(plan, template, cs3700, 'cs-electives/ce1', cs3700.uid)).toBeNull()
  })

  it('refuses filled slots', () => {
    expect(placeFailure(plan, template, course('MATH 1910', 4), 'calculus/m1')).toBe('Already filled')
  })

  it('explains level, credit and exclusion failures', () => {
    expect(placeFailure(plan, template, course('CS 3420', 4), 'cs-electives/ce1')).toBe('Needs CS 4000+')
    expect(placeFailure(plan, template, course('CS 4744', 2), 'cs-electives/ce1')).toBe('Needs 3+ credits')
    expect(placeFailure(plan, template, course('CS 4090'), 'cs-electives/ce1')).toBe("CS 4090 can't count here")
    expect(placeFailure(plan, template, course('MATH 4710', 4), 'ext-spec/ex1')).toBeNull()
    expect(placeFailure(plan, template, course('CS 4780', 4), 'ext-spec/ex1')).toBe('No CS courses')
    expect(placeFailure(plan, template, course('PE 1100', 1), 'major-approved')).toBe('No PE courses')
    expect(placeFailure(plan, template, course('ENGRG 1050', 1), 'advisor-approved')).toBe('No 10xx courses')
  })

  it('accepts ROTC courses at 3000+ in buckets but not below', () => {
    expect(placeFailure(plan, template, course('AIRS 3010'), 'advisor-approved')).toBeNull()
    expect(placeFailure(plan, template, course('AIRS 2010'), 'advisor-approved')).toBe('No AIRS courses')
  })

  it('recognizes CS 4xx1 practicums as project courses', () => {
    expect(placeFailure(plan, template, course('CS 4321', 2), 'cs-project/pr1')).toBeNull()
    expect(placeFailure(plan, template, course('CS 4320'), 'cs-project/pr1')).toBe('Not a CS project course')
  })

  it('accepts one 2000-level technical elective', () => {
    expect(placeFailure(plan, template, course('MATH 2930', 4), 'tech-electives/te3')).toBeNull()
  })

  it('refuses a second 2000-level technical elective', () => {
    const swapped: Plan = {
      ...plan,
      courses: plan.courses.map((c) => (c.code === 'CS 3152' ? { ...c, code: 'MATH 2930' } : c)),
    }
    expect(placeFailure(swapped, template, course('CHEM 2150', 4), 'tech-electives/te3')).toBe(
      'Only one 2000-level course allowed',
    )
  })

  it('refuses a non-writing seminar in FWS', () => {
    expect(placeFailure(plan, template, course('PSYCH 2800', 3, ['SBA-AG']), 'libstudies/ls3')).toBeNull()
    const fwsFree: Plan = { ...plan, courses: plan.courses.filter((c) => c.placement !== 'fws/fws2') }
    expect(placeFailure(fwsFree, template, course('ENGL 2010', 3, ['LA-AG']), 'fws/fws2')).toBe('Not a writing seminar')
  })
})

describe('warnings for imported plans', () => {
  it('flags S/U and low grades in letter-grade rows', () => {
    const graded: Plan = {
      ...plan,
      courses: plan.courses.map((c) =>
        c.code === 'CS 2800' ? { ...c, grade: 'SX' } : c.code === 'CS 3110' ? { ...c, grade: 'D' } : c,
      ),
    }
    const { warnings } = evaluatePlan(graded, template, OCTOBER_2026)
    expect(warnings).toEqual({ 'seed-17': ['S/U in letter-grade row'], 'seed-18': ['Needs C- or better'] })
  })

  it('flags a course used twice and a rule broken outside the app', () => {
    const broken = withCourses({ code: 'CS 3152', placement: 'cs-project/pr1' }, { code: 'CS 3420', placement: 'cs-electives/ce1' })
    const { warnings } = evaluatePlan(broken, template, OCTOBER_2026)
    expect(warnings['seed-22']).toEqual(['Used twice'])
    expect(warnings.x0).toEqual(['Used twice'])
    expect(warnings.x1).toEqual(['Needs CS 4000+'])
  })
})

describe('Liberal Studies groups', () => {
  it('spreads multi-category courses to cover the most groups', () => {
    const courses = [
      { uid: 'a', code: 'HIST 2000', credits: 3, distributions: ['HA-AG', 'SCD-AS'] },
      { uid: 'b', code: 'HIST 2001', credits: 3, distributions: ['HA-AG'] },
    ] as PlanCourse[]
    const ls = template.sections.find((s) => s.id === 'libstudies')!
    expect(assignGroups(courses, ls.groups!, ls.constraints)).toEqual({ a: 'G7', b: 'G2' })
  })

  it('treats a dashed category as exact', () => {
    expect(matchFailure(course('X 2000', 3, ['SCD-AS']), { distributions: ['SCD-HA'] })).not.toBeNull()
    expect(matchFailure(course('X 2000', 3, ['SCD-AS']), { distributions: ['SCD-AS'] })).toBeNull()
  })
})

describe('plan-wide checks', () => {
  const check = { metText: 'met by {code}', missText: 'missing.' }
  const checkTemplate: Template = {
    ...template,
    checks: [
      { id: 'dls', title: 'DLS', match: [{ distributions: ['DLS'] }], group: 'cals', ...check },
      { id: 'dl2', title: 'DL', match: [{ distributions: ['DLS', 'DLG'] }], group: 'cals', ...check },
      { id: 'wrt', title: 'Writing', match: [{ distributions: ['WRT'] }], credits: 6, ...check },
      { id: 'ssh', title: 'SSH', match: [{ distributions: ['SBA'] }], count: 2, ...check },
    ],
  }
  // Only the given courses, so the seed plan can't meet a check by accident.
  const result = (...courses: Partial<PlanCourse>[]) => {
    const only = withCourses(...courses).courses.slice(plan.courses.length)
    return evaluatePlan({ ...plan, courses: only }, checkTemplate, OCTOBER_2026).checks.map((c) => [c.check.id, c.met, c.text])
  }

  it('lets a grouped course meet one check only', () => {
    expect(result({ code: 'AEM 2100', distributions: ['DLS-AG'] }).slice(0, 2)).toEqual([
      ['dls', true, 'met by AEM 2100'],
      ['dl2', false, 'missing.'],
    ])
    expect(result({ code: 'AEM 2100', distributions: ['DLS-AG'] }, { code: 'INFO 1200', distributions: ['DLG-AG'] })[1]).toEqual([
      'dl2', true, 'met by INFO 1200',
    ])
  })

  it('counts credits and courses, reporting partial progress', () => {
    const rows = result(
      { code: 'WRIT 1370', distributions: ['WRT-AG'] },
      { code: 'ECON 1110', distributions: ['SBA-AG'] },
    )
    expect(rows[2]).toEqual(['wrt', false, '3 / 6 cr so far (WRIT 1370), missing.'])
    expect(rows[3]).toEqual(['ssh', false, '1 / 2 so far (ECON 1110), missing.'])
  })

  it('counts a non-repeatable course once', () => {
    const rows = result({ code: 'WRIT 1370', distributions: ['WRT-AG'] }, { code: 'WRIT 1370', distributions: ['WRT-AG'] })
    expect(rows[2]).toEqual(['wrt', false, '3 / 6 cr so far (WRIT 1370), missing.'])
  })

  it('lets an ungrouped check reuse a course placed anywhere', () => {
    const rows = result({ code: 'ECON 1110', distributions: ['SBA-AG', 'DLS-AG'], placement: 'libstudies/ls1' })
    expect(rows[0][1]).toBe(true)
    expect(rows[3][2]).toBe('1 / 2 so far (ECON 1110), missing.')
  })
})

describe('concentrations', () => {
  const extra: Section = { id: 'fin', title: 'Finance', column: 'right', filter: 'electives', type: 'slots', slots: [{ id: 'f1', label: 'AEM 4570' }] }
  const withConc: Template = { ...template, concentrations: [{ id: 'finance', name: 'Finance', sections: [extra] }] }

  it('adds only the chosen concentration sections', () => {
    expect(withConcentrations(withConc, []).sections).toHaveLength(template.sections.length)
    expect(withConcentrations(withConc, ['finance']).sections.at(-1)?.id).toBe('fin')
    expect(evaluatePlan(plan, withConcentrations(withConc, ['finance']), OCTOBER_2026).whatsLeft.at(-1)).toEqual({
      sectionId: 'fin', label: 'Finance', open: 1, needs: [],
    })
  })
})
