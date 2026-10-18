import { describe, expect, it } from 'vitest'
import type { CatalogCourse } from '../types'
import { buildIndex, searchCourses } from './search'

const course = (code: string, title: string): CatalogCourse => ({
  code, title, creditsMin: 3, creditsMax: 3, distributions: [], rosters: ['FA26'],
})

const index = buildIndex([
  course('CS 4410', 'Operating Systems'),
  course('CS 4414', 'Systems Programming'),
  course('CS 4820', 'Introduction to Analysis of Algorithms'),
  course('CS 1110', 'Introduction to Computing'),
  course('MATH 4410', 'Introduction to Combinatorics I'),
  course('ECE 4750', 'Computer Architecture'),
])

const codes = (query: string) => searchCourses(index, query).map((c) => c.code)

describe('course search', () => {
  it('matches codes with or without the space', () => {
    expect(codes('CS 4820')).toEqual(['CS 4820'])
    expect(codes('cs4820')).toEqual(['CS 4820'])
    expect(codes('CS 441')).toEqual(['CS 4410', 'CS 4414'])
  })

  it('matches bare catalog numbers across subjects', () => {
    expect(codes('4410')).toEqual(['CS 4410', 'MATH 4410'])
  })

  it('matches title words and requires every token', () => {
    expect(codes('systems')).toEqual(['CS 4410', 'CS 4414'])
    expect(codes('intro algorithms')).toEqual(['CS 4820'])
    expect(codes('cs intro')).toEqual(['CS 1110', 'CS 4820'])
  })

  it('tolerates abbreviations by matching letters in order', () => {
    expect(codes('algs')).toEqual(['CS 4820'])
  })

  it('returns nothing for an empty query', () => {
    expect(codes('  ')).toEqual([])
  })
})
