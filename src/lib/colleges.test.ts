import { describe, expect, it } from 'vitest'
import { shortCollege } from './colleges'

describe('shortCollege', () => {
  it.each([
    ['College of Arts and Sciences', 'A&S'],
    ['Arts and Sciences', 'A&S'],
    ['Engineering', 'ENG'],
    ['College of Agriculture and Life Sciences, College of Human Ecology', 'CALS, HumEc'],
    ['College of Architecture, Art and Planning', 'AAP'],
    ['Bowers College of Computing and Information Science, Duffield College of Engineering', 'CIS, ENG'],
    ['Dyson (CALS 2025+ distributions)', 'Dyson (CALS 2025+)'],
    ['CALS (pre-2025 distributions)', 'CALS (pre-2025)'],
    ['Cornell University', 'Cornell'],
    ['Some New School', 'Some New School'],
  ])('%s becomes %s', (full, short) => expect(shortCollege(full)).toBe(short))
})
