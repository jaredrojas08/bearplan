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
  /** Alternative this row belongs to, like "Option 1". The section needs any one alternative complete. */
  option?: string
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
  /** Courses in a letterGrade section that may still be taken S/U, like research credit. */
  suAllowedCodes?: string[]
  swimTest?: boolean
  spcl?: boolean
  /** Credits here don't count toward the degree total (PE). */
  excludeFromCredits?: boolean
  /** Set by the app on sections that come from a minor: that minor's id. */
  minor?: string
}

export interface Check {
  id: string
  title: string
  /** A course counts if its code is listed or it passes any match. */
  codes?: string[]
  match?: Match[]
  /** Courses needed (default 1). With credits set, a credit total instead. */
  count?: number
  credits?: number
  /** Checks in the same group can't share a course. Earlier checks claim first. */
  group?: string
  /** Set by the app on a minor's checks: only that minor's courses count. */
  minor?: string
  /** "{code}" becomes the courses used. */
  metText: string
  missText: string
}

/** Extra sections a student opts into, like a Dyson concentration. */
export interface Concentration {
  id: string
  name: string
  sections: Section[]
}

export interface Template {
  id: string
  /** Minors attach to a plan alongside its major checklist. */
  kind?: 'major' | 'minor'
  /** Generated from the catalog by script and not yet checked by a person. */
  draft?: boolean
  /** The official page the requirements come from. */
  source?: string
  name: string
  college: string
  matriculatedFrom: Term
  /** Set when a newer checklist replaces this one for later entry terms. */
  matriculatedBefore?: Term
  totalCredits?: number
  totalCreditsNote?: string
  /** Shown under the checklist, like grade rules. */
  footnote?: string
  filters: { id: string; label: string; icon?: SectionIcon }[]
  /** Courses that may legitimately appear more than once (repeatable research). */
  repeatableCodes?: string[]
  /** Grades that break a letterGrade section. */
  failingGrades?: string[]
  sections: Section[]
  concentrations?: Concentration[]
  /** How many concentrations a plan may pick. Defaults to 1. */
  maxConcentrations?: number
  /** Minors only: credits that must not also count toward the major. */
  minUniqueCredits?: number
  /** Set by the app on a resolved template: the minors added to it. */
  addedMinors?: Pick<Template, 'id' | 'name' | 'minUniqueCredits' | 'draft' | 'source'>[]
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
  /** Ids of the template's concentrations this plan follows. */
  concentrations?: string[]
  /** Ids of minor templates this plan adds. */
  minors?: string[]
}

/** One entry of public/catalog/index.json: a drafted checklist that loads when picked. */
export interface CatalogEntry {
  id: string
  kind: 'major' | 'minor'
  name: string
  college: string
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
