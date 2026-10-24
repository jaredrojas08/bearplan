import { describe, expect, it } from 'vitest'
import stsJson from '../templates/science-technology-studies-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const sts = stsJson as Template
const resolved = sts
const empty: Plan = { version: 1, name: 'T', templateId: sts.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, credits = 3, distributions: string[] = []) => placeFailure(empty, resolved, { code, credits, distributions }, placement)

describe('Science, Technology and Society (BA)', () => {
  it('validates and copies the Arts and Sciences requirements exactly', () => {
    expect(templateErrors(sts)).toEqual([])
    expect(sts.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(stsJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(sts.sections.find((s) => s.id === 'pe')).toEqual(economicsJson.sections.find((s) => s.id === 'pe'))
    expect(sts.totalCredits).toEqual(economicsJson.totalCredits)
    expect(sts.totalCreditsNote).toEqual(economicsJson.totalCreditsNote)
    expect(sts.filters).toEqual(economicsJson.filters)
    expect(sts.failingGrades).toEqual(economicsJson.failingGrades)
  })

  it('requires the listed core course', () => {
    expect(fits('STS 2011', 'core/c1')).toBeNull()
    expect(fits('STS 1101', 'core/c1')).not.toBeNull()
  })

  it('accepts table-listed theme courses, including the untitled entry, but excludes independent study', () => {
    expect(fits('STS 2643', 'theme/t1')).toBeNull()
    expect(fits('STS 4911', 'theme/t1')).toBeNull()
    expect(fits('STS 3991', 'theme/t1')).not.toBeNull()
    expect(fits('STS 2011', 'theme/t1')).not.toBeNull()
  })

  it('enforces the major course credit minimum and excludes writing seminars', () => {
    expect(fits('STS 1101', 'theme/t1', 2)).toBe('Needs 3+ credits')
    expect(fits('STS 1101', 'theme/t1', 3, ['FWS'])).toBe("FWS courses can't count here")
    expect(fits('CS 1110', 'science/s1')).toBeNull()
    expect(fits('STS 3991', 'science/s1')).not.toBeNull()
  })

  it('requires a 4000-level theme course within the eight theme slots', () => {
    const theme = resolved.sections.find((s) => s.id === 'theme')!
    expect(theme.slots).toHaveLength(8)
    expect(resolved.sections.find((s) => s.id === 'science')!.slots).toHaveLength(3)
    const plan: Plan = { ...empty, courses: [{ uid: '1', code: 'STS 3561', title: '', credits: 3, term: 'FA22', placement: 'theme/t1' }] }
    const progress = (p: Plan) => evaluatePlan(p, resolved, new Date(2026, 9, 1)).sections.find((s) => s.section.id === 'theme')!
    expect(progress(plan).chips.find((c) => c.label === '4000-level or above')?.ok).toBe(false)
    plan.courses[0].code = 'STS 4911'
    expect(progress(plan).chips.find((c) => c.label === '4000-level or above')?.ok).toBe(true)
  })
})
