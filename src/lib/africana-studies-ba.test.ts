import { describe, expect, it } from 'vitest'
import africanaJson from '../templates/africana-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { matchFailure, placeFailure } from './requirements'
import { templateErrors } from './validate'

const africana = africanaJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: africana.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, distributions: string[] = []) => placeFailure(empty, africana, { code, credits: 4, distributions }, 'major')

describe('Africana Studies (BA)', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(africana)).toEqual([])
    for (const key of ['checks', 'checkGroups', 'totalCredits', 'totalCreditsNote', 'filters'] as const) {
      expect(Reflect.get(africana, key)).toEqual(Reflect.get(economicsJson, key))
    }
    expect(africana.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(africana.failingGrades).toEqual(['C-', ...economicsJson.failingGrades])
    expect(africana.draft).not.toBe(true)
  })

  it('accepts ASRC courses and refuses other subjects and FWS', () => {
    expect(fits('ASRC 1500')).toBeNull()
    expect(fits('ASRC 1833', ['FWS'])).not.toBeNull()
    expect(fits('ECON 1110')).not.toBeNull()
  })

  it('reserves the core count for ASRC 1500', () => {
    const core = africana.sections[0].constraints!.find((c) => c.type === 'minCount' && c.match.codes)
    if (!core || core.type !== 'minCount') throw new Error('Missing core requirement')
    expect(matchFailure({ code: 'ASRC 1500', credits: 4 }, core.match)).toBeNull()
    expect(matchFailure({ code: 'ASRC 1595', credits: 3 }, core.match)).not.toBeNull()
  })

  it('requires 36 credits and the catalog course counts without using Hours ranges', () => {
    expect(africana.sections[0].minCredits).toBe(36)
    expect(africana.sections[0].constraints).toEqual([
      { type: 'minCount', label: 'ASRC courses', count: 10, match: { subjects: ['ASRC'] } },
      { type: 'minCount', label: 'Core: ASRC 1500', count: 1, match: { codes: ['ASRC 1500'] } },
      { type: 'minCount', label: 'Breadth, focus and seminars: 2000+', count: 9, match: { minLevel: 2000 } },
      { type: 'minCount', label: '3000-level focus courses', count: 4, match: { minLevel: 3000, maxLevel: 3999 } },
      { type: 'minCount', label: '4000+ seminar courses', count: 2, match: { minLevel: 4000 } },
    ])
  })
})
