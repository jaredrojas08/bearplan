import { describe, expect, it } from 'vitest'
import { currentTerm, nextTerm, termRange, termStatus } from './terms'

describe('terms', () => {
  it('lists every term from entry to graduation', () => {
    expect(termRange('FA24', 'SP28')).toEqual(['FA24', 'SP25', 'FA25', 'SP26', 'FA26', 'SP27', 'FA27', 'SP28'])
    expect(nextTerm('FA99')).toBe('SP00')
  })

  it('derives the current term from the date', () => {
    expect(currentTerm(new Date(2026, 9, 18))).toBe('FA26')
    expect(currentTerm(new Date(2027, 0, 25))).toBe('SP27')
    expect(currentTerm(new Date(2027, 6, 1))).toBeNull()
  })

  it('maps terms to status relative to today', () => {
    const october = new Date(2026, 9, 18)
    expect(termStatus('SP26', october)).toBe('done')
    expect(termStatus('FA26', october)).toBe('prog')
    expect(termStatus('SP27', october)).toBe('plan')

    const summer = new Date(2026, 6, 1)
    expect(termStatus('SP26', summer)).toBe('done')
    expect(termStatus('FA26', summer)).toBe('plan')
  })
})
