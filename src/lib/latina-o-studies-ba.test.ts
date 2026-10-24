import { describe, expect, it } from 'vitest'
import latinaJson from '../templates/latina-o-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const latina = latinaJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: latina.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string) => placeFailure(empty, latina, { code, credits: 3 }, placement)

describe('Latina/o Studies (BA)', () => {
  it('validates and preserves the Economics college requirements', () => {
    expect(templateErrors(latina)).toEqual([])
    expect(latina.college).toBe('Arts and Sciences')
    for (const key of ['checks', 'checkGroups', 'totalCredits', 'totalCreditsNote', 'filters', 'failingGrades'] as const) {
      expect(Reflect.get(latina, key)).toEqual(Reflect.get(economics, key))
    }
    expect(latina.sections.find((s) => s.id === 'pe')).toEqual(economics.sections.find((s) => s.id === 'pe'))
    expect(latina.sections.filter((s) => s.filter === 'major').reduce((count, s) => count + s.slots!.length, 0)).toBe(12)
  })

  it('requires LSP 2100 in the core', () => {
    expect(fits('LSP 2100', 'core/s1')).toBeNull()
    expect(fits('LSP 1802', 'core/s1')).not.toBeNull()
  })

  it('accepts all four listed introductory choices, including the untitled entry', () => {
    for (const code of ['LSP 1802', 'LSP 2031', 'LSP 2400', 'LSP 2720']) {
      expect(fits(code, 'intro/s1')).toBeNull()
      expect(fits(code, 'intro/s2')).toBeNull()
    }
    expect(fits('LSP 2100', 'intro/s1')).not.toBeNull()
  })

  it('keeps introductory courses out of the 3000-level rows', () => {
    expect(fits('LSP 2400', 'courses-3000/s1')).not.toBeNull()
  })

  it('keeps introductory courses out of the 4000-level seminars', () => {
    expect(fits('LSP 2720', 'seminars/s1')).not.toBeNull()
  })

  it('caps outside electives at two', () => {
    const plan: Plan = { ...empty, courses: ['LSP 1802', 'LSP 2031'].map((code, i) => ({ uid: String(i), code, title: '', credits: 3, term: 'FA22', placement: `electives/s${i + 1}` })) }
    expect(placeFailure(plan, latina, { code: 'LSP 2400', credits: 3 }, 'electives/s3')).toBeNull()
    const outside: Plan = { ...plan, courses: plan.courses.map((c, i) => ({ ...c, code: ['ECON 1110', 'ECON 1120'][i] })) }
    expect(placeFailure(outside, latina, { code: 'LSP 2720', credits: 3 }, 'electives/s3')).toBeNull()
    expect(placeFailure(outside, latina, { code: 'ECON 3030', credits: 3 }, 'electives/s3')).toBe('At most two electives not cross-listed with LSP, in consultation with the Director of Undergraduate Studies.')
  })

  it('keeps PE and writing seminars out of the area electives', () => {
    expect(placeFailure(empty, latina, { code: 'PE 1100', credits: 1 }, 'electives/s1')).not.toBeNull()
    expect(placeFailure(empty, latina, { code: 'ENGL 1105', credits: 3, distributions: ['FWS'] }, 'electives/s1')).not.toBeNull()
  })
})
