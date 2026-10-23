import { describe, expect, it } from 'vitest'
import mathematicsJson from '../templates/mathematics-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const mathematics = mathematicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: mathematics.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, concentration = '') => placeFailure(empty, withConcentrations(mathematics, [concentration]), { code, credits: 4 }, placement)

describe('Mathematics BA', () => {
  it('validates and preserves the Arts and Sciences requirements', () => {
    expect(templateErrors(mathematics)).toEqual([])
    // The Arts & Sciences checks match Economics; the two MATH count checks come first.
    expect(mathematics.checks.slice(2)).toEqual(economicsJson.checks)
    expect(mathematics.checks.slice(0, 2).map((c) => [c.id, c.count])).toEqual([['math-4000', 2], ['math-3000', 5]])
    expect(mathematics.sections.find(s => s.id === 'pe')).toEqual(economicsJson.sections.find(s => s.id === 'pe'))
    for (const key of ['filters', 'failingGrades', 'totalCredits', 'totalCreditsNote'] as const) {
      expect(mathematics[key]).toEqual(economicsJson[key])
    }
    expect(mathematics.concentrations).toHaveLength(8)
  })

  it('accepts the data science linear algebra admission course but refuses advanced substitution', () => {
    expect(fits('MATH 2310', 'admission/linear')).toBeNull()
    expect(fits('MATH 4310', 'admission/linear')).not.toBeNull()
  })

  it('uses the distinct algebra and analysis tables', () => {
    expect(fits('MATH 4500', 'algebra/a1')).toBeNull()
    expect(fits('MATH 4250', 'analysis/a1')).toBeNull()
    expect(fits('CS 4210', 'analysis/a1')).not.toBeNull()
  })

  it('excludes disallowed upper-level MATH courses', () => {
    expect(fits('MATH 4410', 'mathematics-courses/m1', 'mathematics')).toBeNull()
    for (const code of ['MATH 4900', 'MATH 4980', 'MATH 4997', 'MATH 5210']) {
      expect(fits(code, 'mathematics-courses/m1', 'mathematics')).not.toBeNull()
    }
  })

  it('retains untitled CS table entries and the stricter second models list', () => {
    expect(fits('CS 3220', 'computer-science-courses/e1', 'computer-science')).toBeNull()
    expect(fits('CS 4810', 'computer-science-courses/e1', 'computer-science')).toBeNull()
    expect(fits('PHYS 1116', 'applied-mathematics-courses/model', 'applied-mathematics')).toBeNull()
    expect(fits('PHYS 1116', 'applied-mathematics-courses/f-model', 'applied-mathematics')).not.toBeNull()
  })

  it('requires the exact statistics probability course and limits machine learning electives', () => {
    expect(fits('MATH 4710', 'statistics-courses/probability', 'statistics')).toBeNull()
    expect(fits('ORIE 3500', 'statistics-courses/probability', 'statistics')).not.toBeNull()
    const plan: Plan = { ...empty, courses: [{ uid: '1', code: 'CS 3780', title: 'ML', credits: 4, term: 'FA26', placement: 'statistics-courses/e1' }] }
    expect(placeFailure(plan, withConcentrations(mathematics, ['statistics']), { code: 'ORIE 4740', credits: 4 }, 'statistics-courses/e2')).toBe('Only one data mining and machine learning course counts')
  })
})

describe('ECON alternative pairs', () => {
  it("can't count both courses of a pair in Applied Mathematics", () => {
    const t = withConcentrations(mathematics, ['applied-mathematics'])
    const section = t.sections.find((s) => s.id === 'applied-mathematics-courses')!
    const model = section.slots!.find((s) => s.rule?.[0].codes?.includes('ECON 3130'))!
    const plan: Plan = { ...empty, concentrations: ['applied-mathematics'], courses: [{ uid: 'a', code: 'ECON 3130', title: '', credits: 4, term: 'FA25', placement: `applied-mathematics-courses/${model.id}` }] }
    const other = section.slots!.find((s) => s.id !== model.id && s.rule?.[0].codes?.includes('ECON 6190'))!
    expect(placeFailure(plan, t, { code: 'ECON 6190', credits: 4 }, `applied-mathematics-courses/${other.id}`)).toBe('These courses are alternatives for one elective')
  })
})
