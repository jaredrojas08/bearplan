import { describe, expect, it } from 'vitest'
import statisticsJson from '../templates/statistics-data-science-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const statistics = statisticsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: statistics.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const standard = withConcentrations(statistics, ['standard'])
const track = withConcentrations(statistics, ['data-science'])
const fits = (code: string, placement: string, template = standard, credits = 4) => placeFailure(empty, template, { code, credits }, placement)

describe('Statistical Science', () => {
  it('validates and preserves the Arts and Sciences requirements', () => {
    expect(templateErrors(statistics)).toEqual([])
    expect(statistics.checks).toEqual(economicsJson.checks)
    expect(statistics.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
  })

  it('accepts the probability alternatives in the core table', () => {
    expect(fits('ORIE 3500', 'core/probability')).toBeNull()
  })

  it('accepts CS 3220 as the listed elective alternative', () => {
    expect(fits('CS 3220', 'standard-electives/e1')).toBeNull()
  })

  it('refuses research as a major elective', () => {
    expect(fits('STSCI 4990', 'standard-electives/e1')).not.toBeNull()
  })

  it('requires short courses to use the paired alternative', () => {
    expect(fits('STSCI 4610', 'standard-electives/e1', standard, 2)).not.toBeNull()
    expect(fits('STSCI 4610', 'standard-electives/pair1', standard, 2)).toBeNull()
  })

  it('replaces multivariable calculus and requires databases in the Data Science Track', () => {
    expect(fits('CS 2110', 'data-science-computing/computing', track)).toBeNull()
    expect(fits('MATH 2220', 'data-science-computing/computing', track)).not.toBeNull()
    expect(fits('CS 4320', 'data-science-electives/database', track)).toBeNull()
    expect(fits('CS 4320', 'standard-calculus/calculus')).not.toBeNull()
  })
})
