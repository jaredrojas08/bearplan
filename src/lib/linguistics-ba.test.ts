import { describe, expect, it } from 'vitest'
import linguisticsJson from '../templates/linguistics-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure, type CourseFacts } from './requirements'
import { templateErrors } from './validate'

const linguistics = linguisticsJson as Template
const economics = economicsJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: linguistics.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (course: CourseFacts, placement: string) => placeFailure(empty, linguistics, course, placement)

describe('Linguistics BA', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(linguistics)).toEqual([])
    expect(linguistics.checks).toEqual(economics.checks)
    expect(Reflect.get(linguistics, 'checkGroups')).toEqual(Reflect.get(economics, 'checkGroups'))
    expect(linguistics.sections.find(s => s.id === 'pe')).toEqual(economics.sections.find(s => s.id === 'pe'))
    expect(linguistics.totalCredits).toBe(economics.totalCredits)
    expect(linguistics.totalCreditsNote).toBe(economics.totalCreditsNote)
    expect(linguistics.filters).toEqual(economics.filters)
    expect(linguistics.failingGrades).toEqual(economics.failingGrades)
  })

  it('accepts the required foundation course', () => {
    expect(fits({ code: 'LING 3302', credits: 4 }, 'linguistics/f2')).toBeNull()
  })

  it('accepts an additional linguistics course', () => {
    expect(fits({ code: 'LING 2221', credits: 3 }, 'linguistics/e1')).toBeNull()
  })

  it('refuses First-Year Writing Seminars in the major', () => {
    expect(fits({ code: 'LING 1101', credits: 3, distributions: ['FWS'] }, 'linguistics/e1')).not.toBeNull()
    expect(fits({ code: 'LING 2221', credits: 3, distributions: ['FWS'] }, 'linguistics/e1')).not.toBeNull()
  })

  it('refuses additional courses below three credits', () => {
    expect(fits({ code: 'LING 2221', credits: 2 }, 'linguistics/e1')).not.toBeNull()
  })

  it('requires four credits for CU-UGR coursework', () => {
    expect(fits({ code: 'LING 2221', credits: 3, distributions: ['CU-UGR'] }, 'linguistics/e1')).not.toBeNull()
    expect(fits({ code: 'LING 2221', credits: 4, distributions: ['CU-UGR'] }, 'linguistics/e1')).toBeNull()
  })

  it('checks the 37-credit minimum even when all ten course rows are filled', () => {
    const codes = ['LING 1101', 'LING 3302', 'LING 3303', 'LING 3314', 'LING 2221', 'LING 2261', 'LING 2248', 'LING 3324', 'LING 4412', 'LING 4491']
    const slots = linguistics.sections[0]!.slots!
    const plan: Plan = {
      ...empty,
      courses: codes.map((code, i) => ({ uid: String(i), code, title: code, credits: i < 4 ? 4 : 3, term: 'FA25', placement: `linguistics/${slots[i]!.id}` })),
    }
    const section = evaluatePlan(plan, linguistics, new Date(2026, 9, 1)).sections.find(s => s.section.id === 'linguistics')!
    expect(section.filled).toBe(10)
    expect(section.credits).toBe(34)
    expect(section.complete).toBe(false)
    expect(section.chips.find(chip => chip.label === 'Linguistics credits')?.ok).toBe(false)
  })
})
