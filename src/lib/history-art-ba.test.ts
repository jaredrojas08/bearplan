import { describe, expect, it } from 'vitest'
import historyArtJson from '../templates/history-art-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const historyArt = historyArtJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: historyArt.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = []) => placeFailure(empty, historyArt, { code, credits: 4, distributions }, placement)

describe('History of Art (BA)', () => {
  it('validates and preserves the Economics college requirements', () => {
    expect(templateErrors(historyArt)).toEqual([])
    expect(historyArt.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(historyArtJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(historyArt.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(historyArt.totalCredits).toEqual(economicsJson.totalCredits)
    expect(historyArt.totalCreditsNote).toEqual(economicsJson.totalCreditsNote)
    expect(historyArt.filters).toEqual(economicsJson.filters)
    expect(historyArt.failingGrades).toEqual(economicsJson.failingGrades)
  })

  it('applies the catalog course rules', () => {
    expect(fits('ARTH 1100', 'entry/gateway')).toBeNull()
    expect(fits('VISST 2000', 'core/visual')).toBeNull()
    expect(fits('ARTH 4101', 'electives/e4')).not.toBeNull()
    expect(fits('ARTH 4998', 'electives/e7')).not.toBeNull()
    expect(fits('ARTH 4999', 'electives/e7', ['FWS'])).not.toBeNull()
  })
})
