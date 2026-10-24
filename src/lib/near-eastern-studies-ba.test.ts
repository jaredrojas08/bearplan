import { describe, expect, it } from 'vitest'
import nesJson from '../templates/near-eastern-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const nes = nesJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: nes.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, nes, { code, credits: 4, distributions }, placement)

describe('Near Eastern Studies (BA)', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(nes)).toEqual([])
    expect(templateErrors(economics)).toEqual([])
    expect(nes.checks).toEqual(economics.checks)
    expect(Reflect.get(nesJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(nes.sections.find((s) => s.id === 'pe')).toEqual(economics.sections.find((s) => s.id === 'pe'))
    expect(nes.totalCredits).toBe(economics.totalCredits)
    expect(nes.totalCreditsNote).toBe(economics.totalCreditsNote)
    expect(nes.filters).toEqual(economics.filters)
    expect(nes.failingGrades).toEqual(['C-', 'C', 'C+', ...economics.failingGrades!])
  })

  it('accepts the core and modern-language endpoints while excluding FWS and honors', () => {
    expect(fits('NES 4560', 'major')).toBeNull()
    for (const code of ['ARAB 2202', 'HEBRW 2100', 'PERSN 2322', 'TURK 2332']) {
      expect(fits(code, 'language-major/l1')).toBeNull()
    }
    expect(fits('NES 4560', 'language-major/l1')).not.toBeNull()
    expect(fits('NES 4998', 'major')).not.toBeNull()
    expect(fits('NES 4560', 'major', ['FWS'])).not.toBeNull()
  })

  it('requires 30 credits and the core', () => {
    const major = nes.sections.find((s) => s.id === 'major')!
    expect(major.minCredits).toBe(30)
    expect(evaluatePlan(empty, nes, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'major')?.complete).toBe(false)
    expect(major.constraints).toContainEqual({ type: 'minCount', label: 'NES 4560: Theory and Method', count: 1, match: { codes: ['NES 4560'] } })
  })
})
