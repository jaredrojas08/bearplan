import { describe, expect, it } from 'vitest'
import pmaJson from '../templates/performing-media-arts-ba.json'
import economics from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const pma = pmaJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: pma.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 4, distributions: string[] = []) =>
  placeFailure(empty, withConcentrations(pma, ['au']), { code, credits, distributions }, placement)

describe('Performing and Media Arts BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(pma)).toEqual([])
    for (const key of ['checks', 'checkGroups', 'filters', 'totalCredits', 'totalCreditsNote'] as const) {
      expect(Reflect.get(pma, key)).toEqual(Reflect.get(economics, key))
    }
    expect(pma.sections.find(s => s.id === 'pe')).toEqual(economics.sections.find(s => s.id === 'pe'))
    expect(pma.requiresConcentration).toBe(true)
    expect(pma.concentrations).toHaveLength(4)
    for (const concentration of pma.concentrations ?? []) {
      expect(templateErrors({ ...withConcentrations(pma, [concentration.id]), concentrations: [], requiresConcentration: false })).toEqual([])
    }
    expect(pma.failingGrades).toEqual(['C+', 'C', 'C-', ...economics.failingGrades])
  })

  it('accepts the global dance alternative', () => {
    expect(fits('PMA 3226', 'core/global')).toBeNull()
  })

  it('requires the sequence progression and the other rubrics', () => {
    expect(fits('PMA 3570', 'au-rubrics/sequence-3000')).toBeNull()
    expect(fits('PMA 4585', 'au-rubrics/sequence-4000')).toBeNull()
    expect(fits('PMA 3570', 'au-rubrics/sequence-4000')).not.toBeNull()
    expect(fits('MUSIC 3431', 'au-rubrics/de')).toBeNull()
    expect(fits('PMA 3570', 'au-rubrics/de')).not.toBeNull()
  })

  it('accepts production labs only in the laboratory row', () => {
    expect(fits('PMA 1410', 'lab/lab', 2)).toBeNull()
    expect(fits('PMA 1410', 'elective/e1', 2)).not.toBeNull()
    expect(fits('PMA 1610', 'au-rubrics/sequence-third', 2)).not.toBeNull()
  })

  it('requires three credits for cross-listed electives', () => {
    expect(fits('ANTHR 3110', 'elective/e1', 3)).toBeNull()
    expect(fits('ANTHR 3110', 'elective/e1', 2)).not.toBeNull()
  })

  it('refuses writing seminars in the major', () => {
    expect(fits('PMA 2100', 'core/intro', 3, ['FWS'])).not.toBeNull()
    expect(fits('PMA 1168', 'elective/e1', 3, ['FWS'])).not.toBeNull()
  })
})
