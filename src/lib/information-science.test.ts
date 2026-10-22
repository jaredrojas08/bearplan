import { describe, expect, it } from 'vitest'
import ba from '../templates/information-science-ba.json'
import bsPre2025 from '../templates/information-science-bs-cals-pre2025.json'
import bs from '../templates/information-science-bs.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure, withConcentrations } from './requirements'
import { templateErrors } from './validate'

const plan = (t: Template, concentrations: string[] = []): Plan => ({
  version: 1, name: 'T', templateId: t.id, entryTerm: 'FA25', gradTerm: 'SP29', swimTest: false, spclArea: '', courses: [], concentrations,
})

describe('Information Science', () => {
  it.each([ba, bs, bsPre2025])('$id validates', (t) => expect(templateErrors(t)).toEqual([]))

  it('has a four-course list for every concentration option', () => {
    for (const c of (bs as Template).concentrations!) expect(c.sections.flatMap((s) => s.slots ?? [])).toHaveLength(4)
  })

  it('applies the elective rules', () => {
    const t = bs as Template
    const fits = (code: string) => placeFailure(plan(t), t, { code, credits: 3 }, 'electives/e1')
    expect(fits('INFO 4320')).toBeNull()
    expect(fits('CS 3110')).toBeNull()
    expect(fits('INFO 4998')).toBe("INFO 4998 can't count here")
    expect(fits('ECON 3030')).toBe('Needs INFO 3000+')
  })

  it('checks concentration lists and the right college rules', () => {
    const t = withConcentrations(bs as Template, ['ux'])
    expect(placeFailure(plan(t, ['ux']), t, { code: 'INFO 3450', credits: 3 }, 'ux/a1')).toBeNull()
    expect(placeFailure(plan(t, ['ux']), t, { code: 'INFO 2950', credits: 3 }, 'ux/a1')).toBe('Not on list A for this concentration')
    const checks = (x: unknown) => evaluatePlan(plan(x as Template), x as Template, new Date(2026, 9, 1)).checks.map((c) => c.check.id)
    expect(checks(ba)).toContain('language')
    expect(checks(bs)).toContain('e3')
    expect(checks(bsPre2025)).toContain('pls')
    const credits = (bs as Template).checks.find((c) => c.id === 'cals-credits')!
    expect(credits.match![0].subjects).not.toContain('AEM')
  })
})
