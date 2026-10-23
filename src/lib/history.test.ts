import { describe, expect, it } from 'vitest'
import historyJson from '../templates/history-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const history = historyJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: history.id, entryTerm: 'FA22', gradTerm: 'SP27', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 4) => placeFailure(empty, history, { code, credits }, placement)
const advancedSeminar = (code: string, placement = 'history') => {
  const plan: Plan = { ...empty, courses: [{ uid: '1', code, title: code, credits: 4, term: 'FA26', placement }] }
  return evaluatePlan(plan, history, new Date(2026, 9, 1)).checks.find((c) => c.check.id === 'history-advanced-seminar')!.met
}

describe('History', () => {
  it('validates and keeps the Arts and Sciences requirements', () => {
    expect(templateErrors(history)).toEqual([])
    expect(history.checks.slice(0, economicsJson.checks.length)).toEqual(economicsJson.checks)
    expect(history.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    for (const key of ['totalCredits', 'totalCreditsNote', 'filters'] as const) {
      expect(history[key]).toEqual(economicsJson[key])
    }
    // History needs a C, so C- is failing here, unlike the Arts & Sciences default.
    expect(history.failingGrades).toEqual(['C-', ...economicsJson.failingGrades])
  })

  it('accepts a listed cross-list and refuses an unrelated course', () => {
    expect(fits('ASIAN 2251', 'history')).toBeNull()
    expect(fits('ECON 1110', 'history')).not.toBeNull()
  })

  it('refuses history courses below the required credit value', () => {
    expect(fits('HIST 1510', 'history', 2)).not.toBeNull()
  })

  it('counts HIST 4000 as an advanced seminar', () => {
    expect(advancedSeminar('HIST 4000')).toBe(true)
  })

  it('does not count thesis seminars or courses outside the major as the advanced seminar', () => {
    expect(advancedSeminar('HIST 4001')).toBe(false)
    expect(advancedSeminar('HIST 4002')).toBe(false)
    expect(advancedSeminar('HIST 4000', 'additional')).toBe(false)
  })
})

describe('writing seminars', () => {
  it('keeps FWS courses out of the major', () => {
    expect(placeFailure(empty, history, { code: 'HIST 1200', credits: 3, distributions: ['FWS'] }, 'history')).toBe("FWS courses can't count here")
  })
})
