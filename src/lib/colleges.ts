/** Cornell's usual short names for its colleges and schools, as shown in the checklist pickers. */
export const COLLEGE_ABBREVIATIONS: { short: string; full: string; names: string[] }[] = [
  { short: 'A&S', full: 'College of Arts and Sciences', names: ['College of Arts and Sciences', 'Arts and Sciences'] },
  { short: 'AAP', full: 'College of Architecture, Art, and Planning', names: ['College of Architecture, Art and Planning', 'College of Architecture, Art, and Planning'] },
  { short: 'Brooks', full: 'Brooks School of Public Policy', names: ['Brooks School of Public Policy'] },
  { short: 'CALS', full: 'College of Agriculture and Life Sciences', names: ['College of Agriculture and Life Sciences', 'CALS'] },
  { short: 'CIS', full: 'Bowers College of Computing and Information Science', names: ['Bowers College of Computing and Information Science'] },
  { short: 'Dyson', full: 'Dyson School of Applied Economics and Management (in CALS and JCB)', names: ['Dyson'] },
  { short: 'ENG', full: 'Duffield College of Engineering', names: ['Duffield College of Engineering', 'Engineering'] },
  { short: 'HumEc', full: 'College of Human Ecology', names: ['College of Human Ecology'] },
  { short: 'ILR', full: 'School of Industrial and Labor Relations', names: ['School of Industrial and Labor Relations'] },
  { short: 'JCB', full: 'SC Johnson College of Business', names: ['SC Johnson College of Business'] },
  { short: 'Cornell', full: 'Open across Cornell, not run by one college', names: ['Cornell University'] },
]

const SHORT_BY_NAME = new Map(COLLEGE_ABBREVIATIONS.flatMap((c) => c.names.map((n) => [n, c.short] as const)))

/**
 * "College of Agriculture and Life Sciences, College of Human Ecology" becomes "CALS, HumEc",
 * and "Dyson (CALS 2025+ distributions)" becomes "Dyson (CALS 2025+)". Unknown names and notes stay as they are.
 */
export function shortCollege(college: string): string {
  const [, main = college, extra] = college.match(/^([^(]*?)\s*(\(.*\))?$/) ?? []
  const parts = main.split(/,\s*(?=College|School|Duffield|Bowers|Brooks|SC Johnson|Cornell)/).map((p) => SHORT_BY_NAME.get(p.trim()) ?? p.trim())
  // Only the checked CALS and Dyson labels lose "distributions"; other notes stay as written.
  const calsLabel = parts.length === 1 && (parts[0] === 'CALS' || parts[0] === 'Dyson')
  const note = calsLabel ? extra?.replace(/^\(((?:CALS )?(?:pre-2025|2025\+)) distributions\)$/, '($1)') : extra
  return [parts.join(', '), note].filter(Boolean).join(' ')
}
