import { describe, expect, it } from 'vitest'
import anthropologyJson from '../templates/anthropology-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const anthropology = anthropologyJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: anthropology.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 3, distributions: string[] = []) =>
  placeFailure(empty, anthropology, { code, credits, distributions }, placement)

describe('Anthropology (BA)', () => {
  it('validates and keeps the Arts and Sciences college requirements', () => {
    expect(templateErrors(anthropology)).toEqual([])
    expect(anthropology.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(anthropologyJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(anthropology.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(anthropology.totalCredits).toEqual(economicsJson.totalCredits)
    expect(anthropology.totalCreditsNote).toEqual(economicsJson.totalCreditsNote)
    expect(anthropology.filters).toEqual(economicsJson.filters)
    expect(anthropology.failingGrades).toEqual(economicsJson.failingGrades)
    expect(anthropology.sections.filter((s) => s.filter === 'major').flatMap((s) => s.slots ?? [])).toHaveLength(10)
  })

  it('accepts the listed biological foundation at the required credit minimum', () => {
    expect(fits('ANTHR 3235', 'subfields/biological')).toBeNull()
  })

  it('refuses a biological course in the archaeological foundation', () => {
    expect(fits('ANTHR 3235', 'subfields/archaeological')).not.toBeNull()
  })

  it('allows ANTHR 4263 as a 4000-level course but refuses it as the seminar', () => {
    expect(fits('ANTHR 4263', 'advanced/a3')).toBeNull()
    expect(fits('ANTHR 4263', 'advanced/seminar')).toBe("ANTHR 4263 can't count here")
  })

  it('refuses First-Year Writing Seminars as major electives', () => {
    expect(fits('ANTHR 1101', 'electives/e1', 3, ['FWS'])).toBe("FWS courses can't count here")
  })
})
