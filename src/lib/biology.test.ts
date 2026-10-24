import { describe, expect, it } from 'vitest'
import ba from '../templates/biological-sciences-ba.json'
import bsPre2025 from '../templates/biological-sciences-bs-cals-pre2025.json'
import bs from '../templates/biological-sciences-bs.json'
import type { Plan, PlanCourse, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const T = bs as Template
const OCT = new Date(2026, 9, 1)
const course = (code: string, placement: string, credits = 3): PlanCourse => ({ uid: `${code}@${placement}`, code, title: '', credits, term: 'FA25', placement })
const planOf = (courses: PlanCourse[], concentrations: string[] = []): Plan => ({
  version: 1, name: 'T', templateId: T.id, entryTerm: 'FA25', gradTerm: 'SP29', swimTest: false, spclArea: '', courses, concentrations,
})
const section = (courses: PlanCourse[], id: string, concentrations: string[] = []) => {
  const t = withConcentrations(T, concentrations)
  return evaluatePlan(planOf(courses, concentrations), t, OCT).sections.find((s) => s.section.id === id)!
}

describe('Biological Sciences', () => {
  it.each([ba, bs, bsPre2025])('$id validates', (t) => expect(templateErrors(t)).toEqual([]))

  it('lists all fourteen concentrations, with Plant Biology as two options', () => {
    expect(T.concentrations).toHaveLength(15)
  })

  it('needs intro biology from two areas', () => {
    const one = section([course('BIOG 1440', 'intro/i1'), course('BIOG 1445', 'intro/i2')], 'intro')
    expect(one.chips[0]).toMatchObject({ label: 'Areas', ok: false })
    expect(section([course('BIOMG 1350', 'intro/i1'), course('BIOG 1440', 'intro/i2')], 'intro').complete).toBe(true)
  })

  it('accepts either general chemistry option', () => {
    expect(section([course('CHEM 2150', 'genchem/g5', 4)], 'genchem').complete).toBe(true)
    expect(section([course('CHEM 2070', 'genchem/g1')], 'genchem')).toMatchObject({ filled: 1, total: 4, complete: false })
  })

  it('sums group credits in Immunology and Biodiversity', () => {
    const ih = (code: string, credits: number) => course(code, 'ih-more', credits)
    const s = section([ih('ANSC 3700', 3), ih('BIOEE 4000', 3), ih('BIOMI 4310', 2)], 'ih-more', ['immunology'])
    expect(s.chips.map((c) => [c.label, c.ok])).toEqual([['Group A', true], ['Group B', true]])
    const short = section([ih('ANSC 3700', 3), ih('BIOEE 4000', 3)], 'ih-more', ['immunology'])
    expect(short.chips[0]).toMatchObject({ text: '3 / 5 cr', ok: false })
  })

  it('applies concentration lists', () => {
    const t = withConcentrations(T, ['molecular-cell-biology'])
    expect(placeFailure(planOf([], ['molecular-cell-biology']), t, { code: 'BIOMG 4870', credits: 3 }, 'mc-more')).toBeNull()
    expect(placeFailure(planOf([], ['molecular-cell-biology']), t, { code: 'BIOMG 3350', credits: 4 }, 'mc-more')).not.toBeNull()
  })

  it('lets research run over several semesters', () => {
    const t = withConcentrations(T, ['general-biology'])
    const fall = planOf([course('BIOG 4990', 'gb', 2)], ['general-biology'])
    expect(placeFailure(fall, t, { code: 'BIOG 4990', credits: 2 }, 'gb')).toBeNull()
  })
})
