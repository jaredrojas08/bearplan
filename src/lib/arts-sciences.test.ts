import { describe, expect, it } from 'vitest'
import csBa from '../templates/computer-science-ba.json'
import economics from '../templates/economics-ba.json'
import government from '../templates/government-ba.json'
import psychology from '../templates/psychology-ba.json'
import type { Plan, PlanCourse, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const OCT = new Date(2026, 9, 1)
const course = (code: string, placement: string, distributions: string[] = [], credits = 4): PlanCourse => ({
  uid: `${code}@${placement}`, code, title: '', credits, term: 'FA25', placement, distributions,
})
const planOf = (template: unknown, courses: PlanCourse[]): Plan => ({
  version: 1, name: 'T', templateId: (template as Template).id, entryTerm: 'FA24', gradTerm: 'SP28', swimTest: false, spclArea: '', courses,
})
const summarize = (template: unknown, courses: PlanCourse[]) => evaluatePlan(planOf(template, courses), template as Template, OCT)
const left = (template: unknown, courses: PlanCourse[], id: string) => summarize(template, courses).whatsLeft.find((l) => l.sectionId === id)

describe('Arts & Sciences checklists', () => {
  it.each([csBa, economics, government, psychology])('$id validates', (t) => {
    expect(templateErrors(t)).toEqual([])
  })

  it('Economics: 3 electives at 4000-level, at most one numbered 2400-2999', () => {
    const e = (code: string, slot: number) => course(code, `electives/e${slot}`)
    expect(left(economics, [e('ECON 4020', 1), e('ECON 3810', 2)], 'electives')?.needs).toEqual(['4000-level 1 / 3'])
    const plan = planOf(economics, [e('ECON 2450', 1)])
    expect(placeFailure(plan, economics as Template, { code: 'ECON 2500', credits: 4 }, 'electives/e2')).toBe('Only one ECON course numbered 2400-2999 counts')
    expect(placeFailure(plan, economics as Template, { code: 'ECON 4999', credits: 4 }, 'electives/e2')).toBe("ECON 4999 can't count here")
  })

  it('Government: subfields, a seminar and one more intro course', () => {
    const more = (code: string) => course(code, 'more-govt')
    const empty = planOf(government, [])
    expect(placeFailure(empty, government as Template, { code: 'ASIAN 3334', credits: 4 }, 'more-govt')).toMatch(/GOVT-numbered/)
    const s = left(government, [more('GOVT 1313'), more('GOVT 3161'), more('GOVT 4011')], 'more-govt')
    // AM (3161), CP (1313), and the seminar 4011 also in AM.
    expect(s?.needs).toEqual(['Subfields 2 / 3'])
    expect(left(government, [more('GOVT 1313'), more('GOVT 3161'), more('GOVT 3857'), more('GOVT 4011')], 'more-govt')?.needs).toEqual([])
    const twoIntro = planOf(government, [more('GOVT 1313')])
    expect(placeFailure(twoIntro, government as Template, { code: 'GOVT 1817', credits: 4 }, 'more-govt')).toBe('Only one more 1000-level course counts')
  })

  it('Psychology: breadth in 3 areas and depth at 3000 and 4000', () => {
    const p = (code: string) => course(code, 'psych')
    // Perception, Development and Neuroscience cover breadth; 3220 covers the 3000 level.
    const result = left(psychology, [p('PSYCH 2050'), p('PSYCH 2090'), p('PSYCH 3220')], 'psych')
    expect(result?.needs).toEqual(['4000-level 0 / 1'])
    expect(result?.creditsToGo).toBe(28)
  })

  it('A&S checks: FWS, language and distributions', () => {
    const s = summarize(economics, [
      course('WRIT 1370', 'additional', ['WRT-AG', 'FWS'], 3),
      course('SPAN 2090', 'additional', ['FL-AG', 'FLOPI-AS'], 4),
      course('ECON 1110', 'intro/i1', ['SBA-AG', 'SSC-AS'], 3),
    ])
    const text = (id: string) => s.checks.find((c) => c.check.id === id)
    expect(text('fws')?.met).toBe(false)
    expect(text('language')?.met).toBe(true)
    // A major course counts toward a distribution.
    expect(text('dist-ssc')?.text).toBe('satisfied by ECON 1110')
    expect(text('dist-courses')?.text).toMatch(/^1 \/ 8 so far/)
  })
})

describe('Psychology research credit', () => {
  it('allows S/U and repeats for PSYCH 4700 and 4710 only', () => {
    const warnings = summarize(psychology, [
      { ...course('PSYCH 4700', 'psych', [], 3), grade: 'S' },
      { ...course('PSYCH 4700', 'psych', [], 3), uid: 'again', grade: 'S' },
      { ...course('PSYCH 3220', 'psych', [], 3), grade: 'S' },
    ]).warnings
    expect(warnings['PSYCH 4700@psych']).toBeUndefined()
    expect(warnings['again']).toBeUndefined()
    expect(warnings['PSYCH 3220@psych']).toEqual(['S/U in letter-grade row'])
  })
})
