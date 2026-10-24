import { describe, expect, it } from 'vitest'
import sociologyJson from '../templates/sociology-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const sociology = sociologyJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: sociology.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, sociology, { code, credits: 3, distributions }, placement)

describe('Sociology (BA)', () => {
  it('validates and copies the Arts and Sciences college requirements', () => {
    expect(templateErrors(sociology)).toEqual([])
    expect(sociology.checks).toEqual(economics.checks)
    expect(Reflect.get(sociology, 'checkGroups')).toEqual(Reflect.get(economics, 'checkGroups'))
    expect(sociology.sections.find((s) => s.id === 'pe')).toEqual(economics.sections.find((s) => s.id === 'pe'))
    expect(sociology.totalCredits).toEqual(economics.totalCredits)
    expect(sociology.totalCreditsNote).toEqual(economics.totalCreditsNote)
    expect(sociology.filters).toEqual(economics.filters)
    expect(sociology.failingGrades).toEqual(economics.failingGrades)
  })

  it('accepts both theory choices and only SOC 3010 for statistics', () => {
    expect(['SOC 3750', 'SOC 3190'].map((code) => fits(code, 'major/theory'))).toEqual([null, null])
    expect(fits('SOC 3010', 'major/statistics')).toBeNull()
  })

  it('requires upper-level sociology electives and excludes FWS', () => {
    expect(fits('SOC 1101', 'major/e1')).not.toBeNull()
    expect(fits('ECON 3010', 'major/e4')).not.toBeNull()
    expect(fits('SOC 1101', 'major/e4', ['FWS'])).not.toBeNull()
  })

  it('counts the 30-credit minimum only within the ten major rows', () => {
    const major = sociology.sections[0]
    const electives = ['SOC 3030', 'SOC 3060', 'SOC 3130', 'SOC 3180', 'SOC 3220', 'SOC 3230', 'SOC 3240']
    const courses = major.slots!.map((slot, i) => ({
      uid: slot.id, code: slot.rule![0].codes?.[0] ?? electives[i - 3],
      title: '', credits: 2, term: 'FA26', grade: 'C-', placement: `major/${slot.id}`,
    }))
    const plan: Plan = { ...empty, courses: [...courses, { uid: 'extra', code: 'SOC 4960', title: '', credits: 10, term: 'FA26', placement: 'additional' }] }
    const result = evaluatePlan(plan, sociology, new Date(2026, 9, 1))
    expect(result.sections[0].complete).toBe(false)
    expect(result.sections[0].chips[0].ok).toBe(false)
    expect(result.warnings).toEqual({})
    const complete = evaluatePlan({ ...plan, courses: courses.map((c) => ({ ...c, credits: 3 })) }, sociology, new Date(2026, 9, 1))
    expect(complete.sections[0].complete).toBe(true)
  })
})
