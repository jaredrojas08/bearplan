import { describe, expect, it } from 'vitest'
import jewishStudiesJson from '../templates/jewish-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const jewishStudies = jewishStudiesJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: jewishStudies.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, jewishStudies, { code, credits: 3, distributions }, placement)

describe('Jewish Studies (BA)', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(jewishStudies)).toEqual([])
    expect(templateErrors(economics)).toEqual([])
    expect(jewishStudies.checks).toEqual(economics.checks)
    expect(Reflect.get(jewishStudiesJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(jewishStudies.sections.find((s) => s.id === 'pe')).toEqual(economics.sections.find((s) => s.id === 'pe'))
    expect(jewishStudies.totalCredits).toBe(economics.totalCredits)
    expect(jewishStudies.totalCreditsNote).toBe(economics.totalCreditsNote)
    expect(jewishStudies.filters).toEqual(economics.filters)
    expect(jewishStudies.failingGrades).toEqual(['C-', ...economics.failingGrades!])
  })

  it('applies the catalog course rules', () => {
    expect(fits('JWST 2644', 'core/intro')).toBeNull()
    expect(fits('HEBRW 3104', 'electives/e1')).toBeNull()
    expect(fits('JWST 2580', 'electives/e1', ['FWS'])).not.toBeNull()
    expect(fits('ANTHR 2400', 'related/r1')).toBeNull()
    expect(fits('JWST 4540', 'related/r1')).not.toBeNull()
    expect(fits('GOVT 3001', 'related/r1')).toBeNull()
    expect(fits('JWST 4998', 'core/honors1')).toBeNull()
    expect(fits('JWST 4998', 'core/research')).not.toBeNull()
  })

  it('requires seven electives with at least four at 3000 or above', () => {
    const codes = ['JWST 2580', 'JWST 2724', 'JWST 2958', 'JWST 2790', 'JWST 3535', 'JWST 3717', 'JWST 3550']
    const plan: Plan = { ...empty, courses: codes.map((code, i) => ({ uid: String(i), code, title: code, credits: 3, term: 'FA25', grade: 'A', placement: `electives/e${i + 1}` })) }
    const electives = (p: Plan) => evaluatePlan(p, jewishStudies, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'electives')!
    expect(electives(plan).complete).toBe(false)
    plan.courses[0]!.code = 'HEBRW 3104'
    expect(electives(plan).complete).toBe(true)
    plan.courses.pop()
    expect(electives(plan).complete).toBe(false)
  })
})
