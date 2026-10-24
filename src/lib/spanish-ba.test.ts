import { describe, expect, it } from 'vitest'
import spanishJson from '../templates/spanish-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const spanish = spanishJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: spanish.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, spanish, { code, credits: 3, distributions }, placement)

describe('Spanish BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(spanish)).toEqual([])
    expect(spanish.checks).toEqual(economics.checks)
    expect(Reflect.get(spanish, 'checkGroups')).toEqual(Reflect.get(economics, 'checkGroups'))
    expect(spanish.sections.find(s => s.id === 'pe')).toEqual(economics.sections.find(s => s.id === 'pe'))
    expect(spanish.totalCredits).toBe(economics.totalCredits)
    expect(spanish.totalCreditsNote).toBe(economics.totalCreditsNote)
    expect(spanish.filters).toEqual(economics.filters)
    expect(spanish.failingGrades).toEqual(['C+', 'C', 'C-', ...economics.failingGrades!])
  })

  it('accepts both alternatives for each modern survey', () => {
    for (const code of ['SPAN 2140', 'SPAN 2235']) expect(fits(code, 'core/c1')).toBeNull()
    for (const code of ['SPAN 2150', 'SPAN 2205']) expect(fits(code, 'core/c2')).toBeNull()
  })

  it('requires the early modern survey and writing workshop without substitutions', () => {
    expect(fits('SPAN 2170', 'core/c3')).toBeNull()
    expect(fits('SPAN 2180', 'core/c4')).toBeNull()
    expect(fits('SPAN 2130', 'core/c3')).not.toBeNull()
  })

  it('keeps language preparation outside the eight major courses', () => {
    expect(fits('SPAN 2095', 'electives/e2')).not.toBeNull()
    expect(fits('SPAN 2070', 'electives/e2')).not.toBeNull()
    expect(fits('SPAN 2097', 'electives/e2')).toBeNull()
  })

  it('keeps FWS and optional honors outside major rows', () => {
    expect(fits('SPAN 2130', 'electives/e2', ['FWS'])).not.toBeNull()
    expect(fits('SPAN 2170', 'core/c3', ['FWS'])).not.toBeNull()
    expect(fits('SPAN 4290', 'electives/e2')).not.toBeNull()
    expect(fits('SPAN 4300', 'electives/e2')).not.toBeNull()
  })
})
