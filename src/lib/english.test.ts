import { describe, expect, it } from 'vitest'
import englishJson from '../templates/english-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, matchFailure, placeFailure } from './requirements'
import { templateErrors } from './validate'

const english = englishJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: english.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string) => placeFailure(empty, english, { code, credits: 3 }, 'major-courses')

describe('English', () => {
  it('validates and keeps the Arts and Sciences requirements', () => {
    expect(templateErrors(english)).toEqual([])
    expect(english.checks.slice(0, economicsJson.checks.length)).toEqual(economicsJson.checks)
    expect(english.sections.find(s => s.id === 'pe')).toEqual(economicsJson.sections.find(s => s.id === 'pe'))
    for (const key of ['filters', 'totalCredits', 'totalCreditsNote'] as const) {
      expect(english[key]).toEqual(economicsJson[key])
    }
    // English needs a C, so C- is failing here, unlike the Arts & Sciences default.
    expect(english.failingGrades).toEqual(['C-', ...economicsJson.failingGrades])
  })

  it('accepts listed cross-lists and refuses excluded writing courses', () => {
    expect(fits('MEDVL 3140')).toBeNull()
    expect(fits('ENGL 2800')).not.toBeNull()
    expect(fits('ENGL 2880')).not.toBeNull()
  })

  it('uses the category tables rather than inferring categories from course numbers', () => {
    const pre = english.checks.find(c => c.id === 'engl-pre')!
    expect(matchFailure({ code: 'ENGL 2010', credits: 3 }, pre.match![0])).toBeNull()
    expect(matchFailure({ code: 'ENGL 2020', credits: 3 }, pre.match![0])).not.toBeNull()
  })
})

describe('writing seminars', () => {
  it('keeps FWS courses out of the major', () => {
    expect(placeFailure(empty, english, { code: 'ENGL 1105', credits: 3, distributions: ['FWS'] }, 'major-courses')).toBe("FWS courses can't count here")
  })
})

describe('PE and the swim test', () => {
  it('stays open until the swim test is checked', () => {
    const pe = (n: number) => ({ uid: `pe${n}`, code: `PE 11${n}0`, title: '', credits: 1, term: 'FA24', placement: `pe/pe${n}` })
    const section = (swimTest: boolean) =>
      evaluatePlan({ ...empty, swimTest, courses: [pe(1), pe(2)] }, english, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'pe')!
    expect(section(false).complete).toBe(false)
    expect(section(true).complete).toBe(true)
  })
})

describe('category checks', () => {
  it("don't count an FWS course, even one already placed", () => {
    const pre = english.checks.find((c) => c.id === 'engl-pre')!
    expect(matchFailure({ code: 'ENGL 2010', credits: 3, distributions: ['FWS'] }, pre.match![0])).toBe("FWS courses can't count here")
  })
})
