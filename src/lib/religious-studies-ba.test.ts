import { describe, expect, it } from 'vitest'
import religiousStudiesJson from '../templates/religious-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const template = religiousStudiesJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: template.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, slot: string) => placeFailure(empty, template, { code, credits: 4 }, `major/${slot}`)

function completed(option: string, credits = 3): Plan {
  const slots = template.sections[0]!.slots!.filter(s => !s.option || s.option === option)
  const codes = ['RELST 3049', 'RELST 2250', 'RELST 2299', 'RELST 4995', 'RELST 2627', 'RELST 2644', 'RELST 4996', 'RELST 4020', 'RELST 4021', 'RELST 4023']
  return {
    ...empty,
    courses: slots.map((slot, i) => ({ uid: String(i), code: codes[i]!, title: '', credits, term: 'FA26', grade: 'B-', placement: `major/${slot.id}` })),
  }
}

describe('Religious Studies (BA)', () => {
  it('validates and copies the Arts and Sciences requirements exactly', () => {
    expect(templateErrors(template)).toEqual([])
    expect(template.checks).toEqual(economics.checks)
    expect(Reflect.get(template, 'checkGroups')).toEqual(Reflect.get(economics, 'checkGroups'))
    expect(template.sections.find(s => s.id === 'pe')).toEqual(economics.sections.find(s => s.id === 'pe'))
    expect(template.totalCredits).toEqual(economics.totalCredits)
    expect(template.totalCreditsNote).toEqual(economics.totalCreditsNote)
    expect(template.filters).toEqual(economics.filters)
    expect(template.failingGrades).toEqual(['C-', 'C', 'C+', ...economics.failingGrades!])
  })

  it('accepts the honors courses in the advanced breadth and depth rows', () => {
    expect(fits('RELST 4995', 'a-breadth1')).toBeNull()
    expect(fits('RELST 4996', 'a-depth1')).toBeNull()
    expect(fits('RELST 4995', 'b-depth1')).toBeNull()
    expect(fits('RELST 4996', 'b-depth2')).toBeNull()
  })

  it('refuses lower-level courses in advanced rows', () => {
    expect(fits('RELST 2250', 'a-breadth1')).not.toBeNull()
    expect(fits('RELST 2250', 'a-depth1')).not.toBeNull()
    expect(fits('RELST 2250', 'b-depth2')).not.toBeNull()
  })

  it('requires a complete alternative and at least 30 major credits', () => {
    for (const option of ['4000+ in breadth and depth', 'Two 4000+ in depth']) {
      const plan = completed(option)
      const result = evaluatePlan(plan, template, new Date(2026, 9, 23)).sections[0]!
      expect(result.total).toBe(10)
      expect(result.complete).toBe(true)
      expect(evaluatePlan(completed(option, 2), template, new Date(2026, 9, 23)).sections[0]!.complete).toBe(false)
      plan.courses.pop()
      expect(evaluatePlan(plan, template, new Date(2026, 9, 23)).sections[0]!.complete).toBe(false)
    }
  })

  it('prevents a course from satisfying two major rows and warns below B-', () => {
    const plan = completed('4000+ in breadth and depth')
    expect(placeFailure(plan, template, { code: 'RELST 3049', credits: 3 }, 'major/b-breadth1')).not.toBeNull()
    const course = plan.courses[0]!
    course.grade = 'C+'
    expect(evaluatePlan(plan, template, new Date(2026, 9, 23)).warnings[course.uid]?.length).toBeGreaterThan(0)
    course.grade = 'B-'
    expect(evaluatePlan(plan, template, new Date(2026, 9, 23)).warnings[course.uid] ?? []).toEqual([])
  })
})
