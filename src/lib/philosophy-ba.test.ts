import { describe, expect, it } from 'vitest'
import philosophyJson from '../templates/philosophy-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const philosophy = philosophyJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: philosophy.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, philosophy, { code, credits: 3, distributions }, placement)

describe('Philosophy BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(philosophy)).toEqual([])
    expect(philosophy.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(philosophyJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(philosophy.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(philosophy.totalCredits).toBe(economicsJson.totalCredits)
    expect(philosophy.totalCreditsNote).toBe(economicsJson.totalCreditsNote)
    expect(philosophy.filters).toEqual(economicsJson.filters)
    expect(philosophy.failingGrades).toEqual(['C-', ...economicsJson.failingGrades])
  })

  it('accepts the history courses and recommended logic course in their core rows', () => {
    expect(fits('PHIL 2200', 'core/ancient')).toBeNull()
    expect(fits('PHIL 2220', 'core/modern')).toBeNull()
    expect(fits('PHIL 2310', 'core/upper1')).toBeNull()
  })

  it('refuses excluded core courses', () => {
    expect(fits('PHIL 4900', 'core/any1')).toBe('No x9xx courses')
    expect(fits('PHIL 1110', 'core/any1', ['FWS'])).toBe("FWS courses can't count here")
  })

  it('keeps the course and credit minimums explicit', () => {
    expect(philosophy.sections.find((s) => s.id === 'core')?.slots).toHaveLength(8)
    expect(philosophy.sections.find((s) => s.id === 'core')?.constraints).toEqual([
      { type: 'minCredits', label: 'Core credits', credits: 24 },
      { type: 'minCount', label: '2000+ courses', count: 6, match: { minLevel: 2000 } },
      { type: 'minCount', label: '3000+ courses', count: 3, match: { minLevel: 3000 } },
    ])
    expect(philosophy.sections.find((s) => s.id === 'electives')?.slots).toHaveLength(2)
    expect(philosophy.sections.find((s) => s.id === 'electives')?.constraints).toEqual([
      { type: 'minCredits', label: 'Elective credits', credits: 6 },
    ])
  })
})
