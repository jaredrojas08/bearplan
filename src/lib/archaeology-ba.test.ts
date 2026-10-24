import { describe, expect, it } from 'vitest'
import archaeologyJson from '../templates/archaeology-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const archaeology = archaeologyJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: archaeology.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string) => placeFailure(empty, archaeology, { code, credits: 4 }, 'major')

describe('Archaeology BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(archaeology)).toEqual([])
    expect(archaeology.checks.slice(0, economics.checks.length)).toEqual(economics.checks)
    expect(Reflect.get(archaeologyJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(archaeology.filters).toEqual(economics.filters)
    expect(archaeology.totalCredits).toBe(economics.totalCredits)
    expect(archaeology.totalCreditsNote).toBe(economics.totalCreditsNote)
    expect(archaeology.sections.find(s => s.id === 'pe')).toEqual(economics.sections.find(s => s.id === 'pe'))
    expect(archaeology.failingGrades).toEqual(['C-', ...economics.failingGrades!])
  })

  it('accepts listed cross-listings and independent research but excludes thesis write-up and FWS', () => {
    expect(fits('AMST 2751')).toBeNull()
    expect(fits('LA 2620')).toBeNull()
    expect(fits('ARKEO 4981')).toBeNull()
    expect(fits('ARKEO 4982')).not.toBeNull()
    expect(placeFailure(empty, archaeology, { code: 'ARKEO 1200', credits: 3, distributions: ['FWS'] }, 'major')).not.toBeNull()
  })

  it('enforces the combined independent-study cap', () => {
    const plan: Plan = { ...empty, courses: [{ uid: 'research', code: 'ARKEO 3000', title: 'Independent study', credits: 3, term: 'FA26', placement: 'major' }] }
    expect(placeFailure(plan, archaeology, { code: 'ARKEO 4981', credits: 2 }, 'major')).toBe('At most 4 major credits may come from independent study')
    expect(placeFailure(plan, archaeology, { code: 'ARKEO 4981', credits: 1 }, 'major')).toBeNull()
  })

  it('counts survey, methods, regional breadth and upper-level credits within the 32 credits', () => {
    const codes = ['ARKEO 1200', 'ARKEO 2620', 'ARKEO 3090', 'ARKEO 3255', 'ARKEO 2800', 'ARKEO 3230', 'ARKEO 3232', 'ARKEO 3235']
    const plan: Plan = { ...empty, courses: codes.map((code, i) => ({ uid: String(i), code, title: code, credits: 4, term: 'FA26', placement: 'major' })) }
    const result = evaluatePlan(plan, archaeology, new Date(2027, 5, 1))
    expect(result.sections.find(s => s.section.id === 'major')?.complete).toBe(true)
    expect(result.checks.find(c => c.check.id === 'major-upper')?.met).toBe(true)
    const oneRegion: Plan = { ...plan, courses: plan.courses.filter(c => !['ARKEO 3255', 'ARKEO 2800'].includes(c.code)) }
    expect(evaluatePlan(oneRegion, archaeology, new Date(2027, 5, 1)).sections.find(s => s.section.id === 'major')?.chips.find(c => c.label === 'Regional concentrations')?.ok).toBe(false)
  })

  it('lets independent study repeat under the 4-credit cap', () => {
    const fall: Plan = { ...empty, courses: [{ uid: 'fall', code: 'ARKEO 3000', title: '', credits: 2, term: 'FA26', placement: 'major' }] }
    expect(placeFailure(fall, archaeology, { code: 'ARKEO 3000', credits: 2 }, 'major')).toBeNull()
  })
})
