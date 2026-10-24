import { describe, expect, it } from 'vitest'
import communicationJson from '../templates/communication-bs.json'
import pre2025Json from '../templates/communication-bs-cals-pre2025.json'
import informationJson from '../templates/information-science-bs.json'
import informationPre2025Json from '../templates/information-science-bs-cals-pre2025.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const communication = communicationJson as Template
const pre2025 = pre2025Json as Template
const empty: Plan = { version: 1, name: 'T', templateId: communication.id, entryTerm: 'FA25', gradTerm: 'SP29', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 3, plan = empty) => placeFailure(plan, communication, { code, credits }, placement)

describe('Communication (BS)', () => {
  it('validates both versions and preserves the college requirements', () => {
    for (const [template, source] of [[communication, informationJson], [pre2025, informationPre2025Json]] as const) {
      expect(templateErrors(template)).toEqual([])
      expect(template.checks).toEqual(source.checks)
      expect(template.sections.find((s) => s.id === 'pe')).toEqual(informationJson.sections.find((s) => s.id === 'pe'))
      expect(template.totalCreditsNote).toBe(informationJson.totalCreditsNote)
      // Communication counts any passing grade, so only F fails (S/U is still flagged in letter-grade rows).
      expect(template.failingGrades).toEqual(['F'])
    }
    expect(pre2025.sections).toEqual(communication.sections)
    expect(communication.matriculatedFrom).toBe('FA25')
    expect(pre2025.matriculatedFrom).toBe('FA22')
    expect(pre2025.matriculatedBefore).toBe('FA25')
  })

  it('accepts the listed statistics choices and refuses an unlisted course', () => {
    for (const code of ['AEM 2100', 'ILRST 2100', 'STSCI 2100']) {
      expect(fits(code, 'data-literacy/statistics')).toBeNull()
    }
    expect(fits('STSCI 2200', 'data-literacy/statistics')).not.toBeNull()
  })

  it('accepts only COMM 3000-3099 as practica', () => {
    expect(fits('COMM 3080', 'practica/p1')).toBeNull()
    expect(fits('COMM 3100', 'practica/p1')).not.toBeNull()
    expect(fits('COMM 2999', 'practica/p1')).not.toBeNull()
  })

  it('accepts upper-level COMM and the fourth core but excludes teaching and internships', () => {
    expect(fits('COMM 3100', 'upper-electives/e1')).toBeNull()
    expect(fits('COMM 2450', 'upper-electives/e1')).toBeNull()
    for (const code of ['COMM 4960', 'COMM 4980', 'COMM 2820']) {
      expect(fits(code, 'upper-electives/e1')).not.toBeNull()
    }
  })

  it('limits the fourth core substitution to one elective', () => {
    const plan: Plan = { ...empty, courses: [{ uid: 'c1', code: 'COMM 2200', title: '', credits: 3, term: 'FA26', placement: 'upper-electives/e1' }] }
    expect(fits('COMM 2450', 'upper-electives/e2', 3, plan)).toBe('Only the fourth core course may count as an upper-level elective')
  })

  it('caps combined study and research credits at three', () => {
    expect(fits('COMM 4970', 'upper-electives/e1')).toBeNull()
    const plan: Plan = { ...empty, courses: [{ uid: 'r1', code: 'COMM 4970', title: '', credits: 3, term: 'FA26', placement: 'upper-electives/e1' }] }
    expect(fits('COMM 4990', 'upper-electives/e2', 1, plan)).toBe('At most 3 combined credits of COMM 4970 and COMM 4990 count as upper-level electives')
  })

  it('lets individual study repeat up to the combined cap', () => {
    const fall: Plan = { ...empty, courses: [{ uid: 'fall', code: 'COMM 4970', title: '', credits: 1, term: 'FA26', placement: 'upper-electives/e1' }] }
    expect(fits('COMM 4970', 'upper-electives/e2', 2, fall)).toBeNull()
  })
})
