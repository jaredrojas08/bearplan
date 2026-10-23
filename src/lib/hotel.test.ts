import { describe, expect, it } from 'vitest'
import hotelJson from '../templates/hotel-management-bs.json'
import type { Plan, Template } from '../types'
import { placeFailure } from './requirements'
import { templateErrors } from './validate'

const hotel = hotelJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: hotel.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, placement: string, distributions: string[] = [], credits = 3) => placeFailure(empty, hotel, { code, credits, distributions }, placement)

describe('Hotel Administration', () => {
  it('validates the checked template', () => {
    expect(templateErrors(hotel)).toEqual([])
  })

  it('applies the core and elective rules', () => {
    expect(fits('HADM 1361', 'food-and-beverage-management/s1', [], 4)).toBeNull()
    expect(fits('HADM 4300', 'hadm-electives')).toBeNull()
    expect(fits('HADM 4410', 'hadm-electives')).not.toBeNull()
    expect(fits('HADM 4300', 'non-jcb', ['ALC-AS'])).not.toBeNull()
    expect(fits('PE 1100', 'free-electives', [], 1)).not.toBeNull()
  })
})
