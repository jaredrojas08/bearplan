import { describe, expect, it } from 'vitest'
import musicJson from '../templates/music-ba.json'
import economicsJson from '../templates/economics-ba.json'
import type { Plan, Template } from '../types'
import { evaluatePlan, placeFailure } from './requirements'
import { templateErrors } from './validate'

const music = musicJson as Template
const empty: Plan = { version: 1, name: 'T', templateId: music.id, entryTerm: 'FA22', gradTerm: 'SP26', swimTest: false, spclArea: '', courses: [] }
const fits = (code: string, slot: string, distributions: string[] = []) => placeFailure(empty, music, { code, credits: 3, distributions }, `music-major/${slot}`)

describe('Music (BA)', () => {
  it('validates and copies the Arts and Sciences requirements', () => {
    expect(templateErrors(music)).toEqual([])
    expect(music.checks).toEqual(economicsJson.checks)
    expect(Reflect.get(musicJson, 'checkGroups')).toEqual(Reflect.get(economicsJson, 'checkGroups'))
    expect(music.sections.find(section => section.id === 'pe')).toEqual(economicsJson.sections.find(section => section.id === 'pe'))
    expect(music.totalCredits).toBe(economicsJson.totalCredits)
    expect(music.totalCreditsNote).toBe(economicsJson.totalCreditsNote)
    expect(music.filters).toEqual(economicsJson.filters)
    expect(music.failingGrades).toEqual(economicsJson.failingGrades)
  })

  it('accepts the required core course', () => {
    expect(fits('MUSIC 1101', 'core1')).toBeNull()
  })

  it('accepts a listed cross-listed Materials and Techniques elective', () => {
    expect(fits('CS 1610', 'elective1')).toBeNull()
    expect(fits('CS 1610', 'elective3')).not.toBeNull()
  })

  it('excludes declaration-only courses and writing seminars', () => {
    expect(fits('MUSIC 1199', 'elective1')).not.toBeNull()
    expect(fits('MUSIC 1100', 'elective2')).not.toBeNull()
    expect(fits('MUSIC 1701', 'elective2', ['FWS'])).not.toBeNull()
  })

  it('keeps the upper-level area requirements', () => {
    expect(fits('MUSIC 3322', 'elective6')).toBeNull()
    expect(fits('MUSIC 3111', 'elective6')).not.toBeNull()
    expect(fits('MUSIC 3111', 'elective7')).toBeNull()
    expect(fits('MUSIC 3514', 'elective7')).not.toBeNull()
  })

  it('requires collaborative performance and 32 major credits', () => {
    expect(fits('MUSIC 3602', 'performance1')).toBeNull()
    expect(fits('MUSIC 3514', 'performance1')).not.toBeNull()
    expect(fits('MUSIC 3514', 'performance2')).toBeNull()
    const chorus: Plan = { ...empty, courses: [{ uid: 'fall', code: 'MUSIC 3602', title: '', credits: 1, term: 'FA26', placement: 'music-major/performance1' }] }
    expect(placeFailure(chorus, music, { code: 'MUSIC 3602', credits: 1 }, 'music-major/performance2')).toBeNull()
    const result = evaluatePlan(empty, music, new Date(2026, 9, 1))
    expect(result.whatsLeft.some(item => JSON.stringify(item).includes('32'))).toBe(true)
  })
})
