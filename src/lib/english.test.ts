import { describe, expect, it } from 'vitest'
import englishJson from '../templates/english-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { matchFailure, placeFailure } from './requirements'
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
    expect(matchFailure({ code: 'ENGL 2010', credits: 3 }, { codes: pre.codes })).toBeNull()
    expect(matchFailure({ code: 'ENGL 2020', credits: 3 }, { codes: pre.codes })).not.toBeNull()
  })
})

describe('writing seminars', () => {
  it('keeps FWS courses out of the major', () => {
    expect(placeFailure(empty, english, { code: 'ENGL 1105', credits: 3, distributions: ['FWS'] }, 'major-courses')).toBe("FWS courses can't count here")
  })
})
