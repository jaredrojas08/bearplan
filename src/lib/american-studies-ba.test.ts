import { describe, expect, it } from 'vitest'
import americanStudiesJson from '../templates/american-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const americanStudies = americanStudiesJson as Template
const economics = economicsJson as Template
const resolved = americanStudies
const empty: Plan = { version: 1, name: 'T', templateId: americanStudies.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 4, distributions: string[] = []) => placeFailure(empty, resolved, { code, credits, distributions }, placement)

describe('American Studies (BA)', () => {
  it('validates and copies the Arts and Sciences college requirements', () => {
    expect(templateErrors(americanStudies)).toEqual([])
    expect(americanStudies.draft).not.toBe(true)
    expect(americanStudies.checks).toEqual(economics.checks)
    expect(Reflect.get(americanStudies, 'checkGroups')).toEqual(Reflect.get(economics, 'checkGroups'))
    expect(americanStudies.sections.find((s) => s.id === 'pe')).toEqual(economics.sections.find((s) => s.id === 'pe'))
    expect(americanStudies.totalCredits).toEqual(economics.totalCredits)
    expect(americanStudies.totalCreditsNote).toEqual(economics.totalCreditsNote)
    expect(americanStudies.filters).toEqual(economics.filters)
    expect(americanStudies.failingGrades).toEqual(['C-', ...economics.failingGrades!])
  })

  it('applies the major course and seminar rules', () => {
    expect(fits('AMST 4000', 'major-coursework/seminar')).toBeNull()
    expect(fits('AMST 4998', 'major-coursework/seminar')).not.toBeNull()
    expect(fits('AMST 4998', 'major-coursework/m1')).toBeNull()
    expect(fits('AMST 4993', 'major-coursework/m1', 2)).toBe('Needs 3+ credits')
    expect(fits('AMST 4993', 'major-coursework/m1', 4, ['FWS'])).not.toBeNull()
    expect(fits('AMST 4994', 'major-coursework/m1')).toBeNull()
  })

  it('requires 42 credits across twelve major courses', () => {
    const coursework = resolved.sections.find((s) => s.id === 'major-coursework')!
    expect(coursework.slots).toHaveLength(12)
    expect(coursework.constraints).toContainEqual({ type: 'minCredits', label: 'Major credits', credits: 42 })
    const summary = evaluatePlan(empty, resolved, new Date(2026, 9, 1))
    expect(summary.sections.find((s) => s.section.id === coursework.id)?.complete).toBe(false)
  })
})
