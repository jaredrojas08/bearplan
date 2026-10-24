import { describe, expect, it } from 'vitest'
import italianJson from '../templates/italian-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const italian = italianJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: italian.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 4, distributions: string[] = []) =>
  placeFailure(empty, italian, { code, credits, distributions }, placement)

describe('Italian (BA)', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(italian)).toEqual([])
    expect(italian.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(italianJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(italian.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(italian.totalCredits).toBe(economicsJson.totalCredits)
    expect(italian.totalCreditsNote).toBe(economicsJson.totalCreditsNote)
    expect(italian.filters).toEqual(economicsJson.filters)
    expect(italian.failingGrades).toEqual(['C+', 'C', 'C-', ...economicsJson.failingGrades])
  })

  it('requires Italian IV and Languages-Literatures-Identities', () => {
    expect(fits('ITAL 2202', 'core/c1')).toBeNull()
    expect(fits('ITAL 2203', 'core/c2')).toBeNull()
    expect(fits('ITAL 2201', 'core/c1')).not.toBeNull()
  })

  it('accepts either introductory culture choice and the other as an elective', () => {
    expect(fits('ITAL 2900', 'core/c3')).toBeNull()
    expect(fits('ITAL 2204', 'core/c3')).toBeNull()
    expect(fits('ITAL 2204', 'electives/e1')).toBeNull()
  })

  it('refuses introductory courses and standalone half courses as full electives', () => {
    expect(fits('ITAL 1202', 'electives/e1')).not.toBeNull()
    expect(fits('ITAL 2204', 'electives/e1', 2)).not.toBeNull()
  })

  it('excludes writing seminars from the major', () => {
    expect(fits('ITAL 2900', 'core/c3', 4, ['FWS'])).not.toBeNull()
    expect(fits('ITAL 2204', 'electives/e1', 4, ['FWS'])).not.toBeNull()
  })
})
