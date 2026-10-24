import { describe, expect, it } from 'vitest'
import classicsJson from '../templates/classics-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const classics = classicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: classics.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }

describe('Classics BA', () => {
  it('validates every track and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(classics)).toEqual([])
    expect(classics.requiresConcentration).toBe(true)
    expect(classics.concentrations?.map((c) => c.id)).toEqual(['classics', 'greek', 'latin', 'classical-civilization'])
    expect(classics.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(classicsJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(classics.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(classics.totalCredits).toBe(economicsJson.totalCredits)
    expect(classics.totalCreditsNote).toBe(economicsJson.totalCreditsNote)
    expect(classics.filters).toEqual(economicsJson.filters)
    expect(classics.failingGrades).toEqual(economicsJson.failingGrades)
  })

  it.each([
    ['greek', 'GREEK 2101', 'greek-track/entry', [], null],
    ['greek', 'GREEK 2101', 'greek-track/language1', [], 'Needs GREEK 2102+'],
    ['latin', 'LATIN 1205', 'latin-track/entry', [], null],
    ['latin', 'LATIN 2201', 'latin-track/entry', [], null],
    ['classics', 'CLASS 2604', 'classics-track/class1', ['FWS'], "FWS courses can't count here"],
  ] as const)('applies %s course rules for %s in %s', (track, code, placement, distributions, failure) => {
    const template = withConcentrations(classics, [track])
    expect(placeFailure(empty, template, { code, credits: 3, distributions: [...distributions] }, placement)).toBe(failure)
  })

  it('requires 27 credits and three qualifying advanced language courses', () => {
    const template = withConcentrations(classics, ['greek'])
    const section = template.sections.find((s) => s.id === 'greek-track')!
    const codes = ['GREEK 2101', 'GREEK 3101', 'GREEK 3102', 'GREEK 3103', 'GREEK 2102', 'GREEK 2103', 'CLASS 2604', 'CLASS 2605', 'CLASS 2606']
    const plan: Plan = {
      ...empty,
      courses: codes.map((code, i) => ({ uid: String(i), code, title: code, credits: 3, term: 'SP25', placement: `${section.id}/${section.slots![i]!.id}` })),
    }
    const result = () => evaluatePlan(plan, template, new Date(2026, 9, 1)).sections.find((s) => s.section.id === section.id)!
    expect(result().complete).toBe(true)
    plan.courses[1]!.credits = 2
    expect(result().chips.map((chip) => chip.ok)).toEqual([false, false])
    expect(result().complete).toBe(false)
  })
})
