// Term codes look like "FA24" or "SP25".
export type Term = string

export type Status = 'done' | 'prog' | 'plan'

/** Every listed field must hold for a course to satisfy the match. */
export interface Match {
  codes?: string[]
  subjects?: string[]
  excludeSubjects?: string[]
  excludeCodes?: string[]
  minLevel?: number
  maxLevel?: number
  minCredits?: number
  /** Catalog number patterns where "x" is any digit, e.g. "4xx1". */
  numberPattern?: string[]
  excludeNumberPattern?: string[]
  /** Distribution categories, e.g. "CA" matches "CA-AG"; "SCD-HA" matches only itself. */
  distributions?: string[]
  /** Replaces the generated message when this match fails. */
  reason?: string
}

export interface Slot {
  id: string
  label: string
  /** A course satisfies the slot if it meets ANY match. No rule means anything fits. */
  rule?: Match[]
}

export interface DistributionGroup {
  id: string
  name: string
  categories?: string[]
  codes?: string[]
}

export type Constraint =
  | { type: 'minCredits'; label: string; credits: number }
  | { type: 'minCount'; label: string; count: number; match: Match }
  | { type: 'maxCount'; label: string; count: number; match: Match; reason: string }
  | { type: 'minGroups'; label: string; count: number }
  | { type: 'groupMinCredits'; label: string; group: string; credits: number }
  | { type: 'groupMaxCount'; label: string; group: string; count: number }

export type SectionIcon = 'pen' | 'book' | 'flask' | 'sigma' | 'code' | 'star' | 'run' | 'plus'

export interface Section {
  id: string
  title: string
  column: 'left' | 'right'
  /** Id of a template filter (e.g. "college"), used by the filter pills. */
  filter: string
  icon?: SectionIcon
  note?: string
  /** Short name for the "What's left" list. Defaults to the title. */
  leftLabel?: string
  type: 'slots' | 'creditBucket'
  slots?: Slot[]
  /** creditBucket: credits needed and the rule every course must meet. */
  minCredits?: number
  rule?: Match[]
  constraints?: Constraint[]
  /** Liberal Studies style groups; courses are assigned to them automatically. */
  groups?: DistributionGroup[]
  letterGrade?: boolean
  swimTest?: boolean
  spcl?: boolean
  /** Credits here don't count toward the degree total (PE). */
  excludeFromCredits?: boolean
}

export interface Check {
  id: string
  title: string
  codes: string[]
  metText: string
  missText: string
}

export interface Template {
  id: string
  name: string
  college: string
  matriculatedFrom: Term
  totalCredits?: number
  totalCreditsNote?: string
  filters: { id: string; label: string; icon?: SectionIcon }[]
  /** Courses that may legitimately appear more than once (repeatable research). */
  repeatableCodes?: string[]
  /** Grades that break a letterGrade section. */
  failingGrades?: string[]
  sections: Section[]
  checks: Check[]
}

export const ADDITIONAL = 'additional'

export interface PlanCourse {
  uid: string
  code: string
  title: string
  credits: number
  term: Term
  grade?: string
  note?: string
  distributions?: string[]
  /** "sectionId/slotId" for slots, "sectionId" for credit buckets, or "additional". */
  placement: string
}

export interface Plan {
  version: 1
  name: string
  templateId: string
  entryTerm: Term
  gradTerm: Term
  swimTest: boolean
  spclArea: string
  courses: PlanCourse[]
  /** Codes the student marked as allowed more than once, on top of the template's list. */
  repeatable?: string[]
}

/** One entry of public/courses.json. */
export interface CatalogCourse {
  code: string
  title: string
  creditsMin: number
  creditsMax: number
  distributions: string[]
  rosters: Term[]
}
