import { describe, expect, it } from 'vitest'
import currentJson from '../templates/global-development-bs.json'
import previousJson from '../templates/global-development-bs-cals-pre2025.json'
import infoJson from '../templates/information-science-bs.json'
import infoPreviousJson from '../templates/information-science-bs-cals-pre2025.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const current = currentJson as Template
const previous = previousJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: current.id, entryTerm: 'FA25', gradTerm: 'SP29', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, concentration?: string) => placeFailure(empty, withConcentrations(current, concentration ? [concentration] : []), { code, credits: 3 }, placement)

describe('Global Development (BS)', () => {
  it('validates both cohorts and copies their college requirements exactly', () => {
    for (const [template, source] of [[current, infoJson], [previous, infoPreviousJson]] as const) {
      expect(templateErrors(template)).toEqual([])
      expect(template.checks).toEqual(source.checks)
      expect(template.sections.find(s => s.id === 'pe')).toEqual(infoJson.sections.find(s => s.id === 'pe'))
      expect(template.totalCreditsNote).toBe(infoJson.totalCreditsNote)
      expect(template.failingGrades).toEqual(['C-', ...infoJson.failingGrades])
    }
    expect(previous.sections).toEqual(current.sections)
    expect(previous.concentrations).toEqual(current.concentrations)
    expect(current.requiresConcentration).toBe(true)
    expect(current.matriculatedFrom).toBe('FA25')
    expect(previous.matriculatedFrom).toBe('FA22')
    expect(previous.matriculatedBefore).toBe('FA25')
  })

  it('accepts listed and pattern-based methods but refuses unrelated courses', () => {
    expect(fits('GDEV 3140', 'core/methods')).toBeNull()
    expect(fits('GDEV 3550', 'core/methods')).toBeNull()
    expect(fits('GDEV 3502', 'core/methods')).not.toBeNull()
  })

  it('uses the engaged learning courses rather than an arbitrary internship course', () => {
    expect(fits('GDEV 2105', 'engaged/pre')).toBeNull()
    expect(fits('GDEV 4960', 'engaged/pre')).not.toBeNull()
  })

  it('includes cross-listed social electives and refuses courses outside the list', () => {
    expect(fits('EDUC 4223', 'social-electives', 'social-economic-development')).toBeNull()
    expect(fits('GDEV 2100', 'social-electives', 'social-economic-development')).toBeNull()
    expect(fits('AEM 4485', 'social-electives', 'social-economic-development')).not.toBeNull()
  })

  it('includes both required biophysical choices and their elective reuse options', () => {
    expect(fits('EAS 1101', 'environment-required/biophysical', 'environment-development')).toBeNull()
    expect(fits('EAS 1101', 'environment-electives', 'environment-development')).toBeNull()
    expect(fits('PLSCI 4730', 'environment-electives', 'environment-development')).not.toBeNull()
  })

  it('enforces agriculture elective categories, GDEV credits and upper-level counts', () => {
    const template = withConcentrations(current, ['agriculture-food-systems'])
    const plan: Plan = { ...empty, courses: ['ANSC 2000', 'PLSCI 3210', 'GDEV 3170', 'GDEV 4450', 'PLSCI 4230'].map((code, i) => ({ uid: String(i), code, title: code, credits: 3, term: 'FA26', placement: 'ag-electives' })) }
    const result = evaluatePlan(plan, template, new Date(2026, 9, 1)).sections.find(s => s.section.id === 'ag-electives')!
    expect(result.complete).toBe(true)
    plan.courses[3] = { ...plan.courses[3]!, code: 'PLSCI 3550' }
    const missing = evaluatePlan(plan, template, new Date(2026, 9, 1)).sections.find(s => s.section.id === 'ag-electives')!
    expect(missing.complete).toBe(false)
    expect(missing.chips.filter(c => !c.ok).map(c => c.label)).toEqual(expect.arrayContaining(['GDEV electives', 'GDEV credits', 'Social, Economic and Health']))
  })
})
