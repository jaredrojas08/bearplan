import { describe, expect, it } from 'vitest'
import comparativeLiteratureJson from '../templates/comparative-literature-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const template = comparativeLiteratureJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: template.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const literary = withConcentrations(template, ['comparative-literary-studies'])
const media = withConcentrations(template, ['literary-visual-media-studies'])
const fits = (resolved: Template, code: string, placement: string, distributions: string[] = []) =>
  placeFailure(empty, resolved, { code, credits: 3, distributions }, placement)

describe('Comparative Literature', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(template)).toEqual([])
    expect(template.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(template, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(template.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(template.totalCredits).toEqual(economicsJson.totalCredits)
    expect(template.totalCreditsNote).toEqual(economicsJson.totalCreditsNote)
    expect(template.filters).toEqual(economicsJson.filters)
    expect(template.failingGrades).toEqual(['C-', ...economicsJson.failingGrades])
  })

  it('requires a track with ten courses, thirty credits, and five COML courses', () => {
    expect(template.requiresConcentration).toBe(true)
    expect(template.concentrations).toHaveLength(2)
    for (const concentration of template.concentrations!) {
      const resolved = withConcentrations(template, [concentration.id])
      expect(resolved.sections).toContainEqual(concentration.sections[0])
      const section = concentration.sections[0]!
      expect(section.slots).toHaveLength(10)
      expect(section.constraints).toEqual([
        { type: 'minCredits', label: 'Major credits', credits: 30 },
        { type: 'minCount', label: 'Courses in Comparative Literature', count: 5, match: { subjects: ['COML'] } },
      ])
    }
  })

  it('applies course and level restrictions in both tracks', () => {
    expect(fits(literary, 'COML 3001', 'literary-studies/methods')).toBeNull()
    expect(fits(literary, 'COML 4930', 'literary-studies/methods')).not.toBeNull()
    expect(fits(literary, 'COML 3001', 'literary-studies/coml1', ['FWS'])).not.toBeNull()
    expect(fits(media, 'COML 3001', 'media-studies/literature1')).toBeNull()
    expect(fits(media, 'COML 1000', 'media-studies/media1')).not.toBeNull()
  })
})
