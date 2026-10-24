import { describe, expect, it } from 'vitest'
import frenchJson from '../templates/french-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const french = frenchJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: french.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 3, distributions: string[] = []) =>
  placeFailure(empty, french, { code, credits, distributions }, placement)

describe('French (BA)', () => {
  it('validates and keeps the Arts and Sciences college requirements', () => {
    expect(templateErrors(french)).toEqual([])
    for (const key of ['checks', 'checkGroups', 'totalCredits', 'totalCreditsNote', 'filters'] as const) {
      expect(Reflect.get(frenchJson, key)).toEqual(Reflect.get(economicsJson, key))
    }
    expect(french.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(french.failingGrades).toEqual(['C+', 'C', 'C-', ...economicsJson.failingGrades])
    expect(french.sections[0]?.slots).toHaveLength(8)
    expect(french.sections[0]?.constraints).toContainEqual({
      type: 'minCount', label: '4000-level course', count: 1, match: { minLevel: 4000, maxLevel: 4999 },
    })
  })

  it('accepts the required introduction', () => {
    expect(fits('FREN 2310', 'major/intro')).toBeNull()
  })

  it('accepts FREN 2095 as an elective but not as the required introduction', () => {
    expect(fits('FREN 2095', 'major/e1')).toBeNull()
    expect(fits('FREN 2095', 'major/intro')).not.toBeNull()
  })

  it('rejects courses below the major level or below three credits', () => {
    expect(fits('FREN 2090', 'major/e1')).not.toBeNull()
    expect(fits('FREN 2095', 'major/e1', 2)).not.toBeNull()
  })

  it('keeps honors work outside the eight major courses', () => {
    expect(fits('FREN 4290', 'major/e1')).not.toBeNull()
    expect(fits('FREN 4300', 'major/e1')).not.toBeNull()
  })

  it('rejects first-year writing seminars in the major', () => {
    expect(fits('FREN 2310', 'major/intro', 3, ['FWS'])).not.toBeNull()
    expect(fits('FREN 2095', 'major/e1', 3, ['FWS'])).not.toBeNull()
  })

  it('counts at most two courses from outside French', () => {
    expect(fits('HIST 3640', 'major/e1')).toBeNull()
    expect(fits('HIST 3640', 'major/intro')).not.toBeNull()
    const two: Plan = {
      ...empty,
      courses: [
        { uid: 'a', code: 'HIST 3640', title: '', credits: 3, term: 'FA26', placement: 'major/e1' },
        { uid: 'b', code: 'COML 3460', title: '', credits: 3, term: 'FA26', placement: 'major/e2' },
      ],
    }
    expect(placeFailure(two, french, { code: 'ARTH 3500', credits: 3 }, 'major/e3')).toBe('At most two Cornell courses from outside Romance Studies count')
  })
})
