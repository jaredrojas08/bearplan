import { describe, expect, it } from 'vitest'
import { currentTerm, latestFall, nextTerm, shiftTerm, termRange, termStatus, upcomingTerm } from './terms'

describe('terms', () => {
  it('lists every term from entry to graduation', () => {
    expect(termRange('FA24', 'SP28')).toEqual(['FA24', 'SP25', 'FA25', 'SP26', 'FA26', 'SP27', 'FA27', 'SP28'])
    expect(nextTerm('FA99')).toBe('SP00')
    expect(shiftTerm('FA24', 7)).toBe('SP28')
    expect(shiftTerm('FA24', -2)).toBe('FA23')
  })

  it('finds the most recent fall that has started', () => {
    expect(latestFall(new Date(2026, 9, 18))).toBe('FA26')
    expect(latestFall(new Date(2026, 2, 1))).toBe('FA25')
    expect(latestFall(new Date(2026, 6, 31))).toBe('FA25')
    expect(latestFall(new Date(2026, 7, 1))).toBe('FA26')
    expect(latestFall(new Date(2100, 0, 15))).toBe('FA99')
  })

  it('derives the current term from the date', () => {
    expect(currentTerm(new Date(2026, 9, 18))).toBe('FA26')
    expect(currentTerm(new Date(2027, 0, 25))).toBe('SP27')
    expect(currentTerm(new Date(2027, 6, 1))).toBeNull()
  })

  it('picks the current or next plan term for new courses', () => {
    const terms = termRange('SP24', 'FA28')
    expect(upcomingTerm(terms, new Date(2026, 9, 18))).toBe('FA26')
    expect(upcomingTerm(terms, new Date(2026, 5, 15))).toBe('FA26')
    expect(upcomingTerm(terms, new Date(2020, 0, 1))).toBe('SP24')
    expect(upcomingTerm(terms, new Date(2030, 0, 1))).toBe('FA28')
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
