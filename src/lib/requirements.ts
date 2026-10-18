import {
  ADDITIONAL,
  type Check,
  type Constraint,
  type DistributionGroup,
  type Match,
  type Plan,
  type PlanCourse,
  type Section,
  type Slot,
  type Status,
  type Template,
  type Term,
} from '../types'
import { termRange, termStatus } from './terms'

/** The fields rule checks need. Search results and placed courses both fit. */
export interface CourseFacts {
  code: string
  credits: number
  distributions?: string[]
}

export function normalizeCode(code: string): string {
  return code.trim().toUpperCase().split(/\s+/).join(' ')
}

export function parseCode(code: string): { subject: string; number: number } {
  const [subject = '', num = ''] = normalizeCode(code).split(' ')
  // Non-numeric numbers (like "PE TBD") give NaN, which fails every level check.
  return { subject, number: /^\d+$/.test(num) ? Number(num) : NaN }
}

function patternMatches(number: number, pattern: string): boolean {
  const digits = String(number)
  if (Number.isNaN(number) || digits.length !== pattern.length) return false
  return [...pattern].every((ch, i) => ch.toLowerCase() === 'x' || ch === digits[i])
}

/** "CA" matches "CA-AG"; a category with a dash like "SCD-HA" matches only itself. */
export function categoryMatches(distribution: string, category: string): boolean {
  return distribution === category || distribution.split('-')[0] === category
}

function hasCategory(course: CourseFacts, categories: string[]): boolean {
  return (course.distributions ?? []).some((d) => categories.some((c) => categoryMatches(d, c)))
}

function listCodes(codes: string[]): string {
  return codes.length <= 3 ? codes.join(' / ') : `${codes.slice(0, 3).join(' / ')} …`
}

/** Returns why the course fails the match, or null when it passes. */
export function matchFailure(course: CourseFacts, match: Match, sectionTitle = 'this requirement'): string | null {
  const code = normalizeCode(course.code)
  const { subject, number } = parseCode(code)
  const levelText = (level: number) =>
    match.subjects?.length === 1 ? `Needs ${match.subjects[0]} ${level}+` : `Needs ${level}+`

  const failure = ((): string | null => {
    if (match.codes && !match.codes.includes(code)) return `Only ${listCodes(match.codes)}`
    if (match.subjects && !match.subjects.includes(subject)) {
      return match.minLevel ? levelText(match.minLevel) : `Needs a ${match.subjects.join(' / ')} course`
    }
    if (match.excludeSubjects?.includes(subject)) return `No ${subject} courses`
    if (match.excludeCodes?.includes(code)) return `${code} can't count here`
    if (match.numberPattern && !match.numberPattern.some((p) => patternMatches(number, p))) {
      return `Needs a ${match.numberPattern.join(' / ')} course`
    }
    const banned = match.excludeNumberPattern?.find((p) => patternMatches(number, p))
    if (banned) return `No ${banned} courses`
    if (match.minLevel !== undefined && !(number >= match.minLevel)) return levelText(match.minLevel)
    if (match.maxLevel !== undefined && !(number <= match.maxLevel)) return `Needs a course below ${match.maxLevel + 1}`
    if (match.minCredits !== undefined && course.credits < match.minCredits) return `Needs ${match.minCredits}+ credits`
    if (match.distributions && !hasCategory(course, match.distributions)) {
      const own = course.distributions ?? []
      if (own.length === 0) return `No ${sectionTitle} category`
      return `${own.join(', ')} ${own.length === 1 ? 'is not a' : 'are not'} ${sectionTitle} ${own.length === 1 ? 'category' : 'categories'}`
    }
    return null
  })()

  return failure && match.reason ? match.reason : failure
}

/** A course meets a rule if it passes ANY match. Reports the first match's failure. */
export function ruleFailure(course: CourseFacts, rule: Match[] | undefined, sectionTitle?: string): string | null {
  if (!rule || rule.length === 0) return null
  const failures = rule.map((m) => matchFailure(course, m, sectionTitle))
  return failures.includes(null) ? null : failures[0]
}

// ---------- placements ----------

export function placementOf(section: Section, slot?: Slot): string {
  return slot ? `${section.id}/${slot.id}` : section.id
}

export interface Target {
  placement: string
  section: Section | null
  slot?: Slot
}

export function findTarget(template: Template, placement: string): Target | null {
  if (placement === ADDITIONAL) return { placement, section: null }
  const [sectionId, slotId] = placement.split('/')
  const section = template.sections.find((s) => s.id === sectionId)
  if (!section) return null
  if (section.type === 'creditBucket') return slotId ? null : { placement, section }
  const slot = section.slots?.find((s) => s.id === slotId)
  return slot ? { placement, section, slot } : null
}

function sectionCourses(plan: Plan, section: Section, exceptUid?: string): PlanCourse[] {
  return plan.courses.filter(
    (c) => c.uid !== exceptUid && (c.placement === section.id || c.placement.startsWith(`${section.id}/`)),
  )
}

function placementTitle(template: Template, placement: string): string {
  return findTarget(template, placement)?.section?.title ?? 'Additional space'
}

/**
 * Why a course can't go into a placement, or null if it fits. `movingUid` is
 * the course being moved, so its current spot doesn't block it.
 */
export function placeFailure(
  plan: Plan,
  template: Template,
  course: CourseFacts,
  placement: string,
  movingUid?: string,
): string | null {
  const target = findTarget(template, placement)
  if (!target) return 'Unknown requirement'

  if (target.slot && plan.courses.some((c) => c.uid !== movingUid && c.placement === placement)) {
    return 'Already filled'
  }

  const code = normalizeCode(course.code)
  if (!template.repeatableCodes?.includes(code)) {
    const twin = plan.courses.find((c) => c.uid !== movingUid && normalizeCode(c.code) === code)
    if (twin) return `Already counted in ${placementTitle(template, twin.placement)}`
  }

  const section = target.section
  if (!section) return null

  const rule = target.slot ? target.slot.rule : section.rule
  const failure = ruleFailure(course, rule, section.title)
  if (failure) return failure

  for (const constraint of section.constraints ?? []) {
    if (constraint.type !== 'maxCount' || matchFailure(course, constraint.match) !== null) continue
    const already = sectionCourses(plan, section, movingUid).filter((c) => matchFailure(c, constraint.match) === null)
    if (already.length + 1 > constraint.count) return constraint.reason
  }
  return null
}

// ---------- evaluation ----------

export interface Chip {
  label: string
  text: string
  ok: boolean
}

export interface SlotRow {
  slot: Slot
  course: PlanCourse | null
}

export interface SectionResult {
  section: Section
  /** Fixed rows for slot sections. */
  rows: SlotRow[]
  /** Placed courses for credit buckets. */
  courses: PlanCourse[]
  filled: number
  total: number
  credits: number
  creditsToGo: number
  open: number
  complete: boolean
  chips: Chip[]
  /** Liberal Studies group each course was assigned to. */
  groupOf: Record<string, string | null>
  /** Status of each progress unit in the section (one per slot, one per bucket). */
  units: (Status | 'empty')[]
}

export interface LeftItem {
  sectionId: string
  label: string
  open: number
  creditsToGo?: number
  needs: string[]
}

export interface CheckResult {
  check: Check
  met: boolean
  text: string
}

export interface TermSummary {
  term: Term
  status: Status
  credits: number
  courses: PlanCourse[]
}

export interface PlanSummary {
  sections: SectionResult[]
  counts: Record<Status | 'empty', number>
  totalUnits: number
  credits: Record<Status, number> & { total: number; required: number | null }
  whatsLeft: LeftItem[]
  checks: CheckResult[]
  warnings: Record<string, string[]>
  terms: TermSummary[]
  openByFilter: Record<string, number>
}

function sumCredits(courses: PlanCourse[]): number {
  return courses.reduce((total, c) => total + c.credits, 0)
}

/**
 * Picks a group for each course so the section's constraints are met when
 * possible, then so the most distinct groups are covered. A course counts
 * toward one group only. Brute force is fine for six slots.
 */
export function assignGroups(
  courses: PlanCourse[],
  groups: DistributionGroup[],
  constraints: Constraint[] = [],
): Record<string, string | null> {
  const options = courses.map((course) => {
    const fits = groups.filter(
      (g) => g.codes?.includes(normalizeCode(course.code)) || (g.categories && hasCategory(course, g.categories)),
    )
    return fits.length ? fits.map((g) => g.id) : [null]
  })

  let best: (string | null)[] = options.map((o) => o[0])
  let bestScore = -1
  const pick: (string | null)[] = []
  const visit = (i: number) => {
    if (i === courses.length) {
      const score = scoreAssignment(courses, pick, constraints)
      if (score > bestScore) {
        bestScore = score
        best = [...pick]
      }
      return
    }
    for (const option of options[i]) {
      pick[i] = option
      visit(i + 1)
    }
  }
  visit(0)
  return Object.fromEntries(courses.map((c, i) => [c.uid, best[i]]))
}

function scoreAssignment(courses: PlanCourse[], pick: (string | null)[], constraints: Constraint[]): number {
  const groupOf = Object.fromEntries(courses.map((c, i) => [c.uid, pick[i]]))
  const met = constraints.filter((k) => groupChip(k, courses, groupOf)?.ok).length
  const distinct = new Set(pick.filter(Boolean)).size
  return met * 100 + distinct
}

function groupChip(
  constraint: Constraint,
  courses: PlanCourse[],
  groupOf: Record<string, string | null>,
): Chip | null {
  const inGroup = (id: string) => courses.filter((c) => groupOf[c.uid] === id)
  switch (constraint.type) {
    case 'minGroups': {
      const n = new Set(Object.values(groupOf).filter(Boolean)).size
      return { label: constraint.label, text: `${Math.min(n, constraint.count)} / ${constraint.count}`, ok: n >= constraint.count }
    }
    case 'groupMinCredits': {
      // Needs one course of at least N credits in the group, not a credit sum.
      const top = Math.max(0, ...inGroup(constraint.group).map((c) => c.credits))
      return {
        label: constraint.label,
        text: `${Math.min(top, constraint.credits)} / ${constraint.credits} cr`,
        ok: top >= constraint.credits,
      }
    }
    case 'groupMaxCount': {
      const n = inGroup(constraint.group).length
      return { label: constraint.label, text: `${n} / max ${constraint.count}`, ok: n <= constraint.count }
    }
    default:
      return null
  }
}

function constraintChip(
  constraint: Constraint,
  courses: PlanCourse[],
  groupOf: Record<string, string | null>,
): Chip {
  switch (constraint.type) {
    case 'minCredits': {
      const n = sumCredits(courses)
      return { label: constraint.label, text: `${n} / ${constraint.credits}`, ok: n >= constraint.credits }
    }
    case 'minCount': {
      const n = courses.filter((c) => matchFailure(c, constraint.match) === null).length
      return { label: constraint.label, text: `${Math.min(n, constraint.count)} / ${constraint.count}`, ok: n >= constraint.count }
    }
    case 'maxCount': {
      const n = courses.filter((c) => matchFailure(c, constraint.match) === null).length
      return { label: constraint.label, text: `${n} / max ${constraint.count}`, ok: n <= constraint.count }
    }
    default:
      return groupChip(constraint, courses, groupOf)!
  }
}

function bucketStatus(courses: PlanCourse[], minCredits: number, today: Date): Status | 'empty' {
  const upTo = (statuses: Status[]) =>
    sumCredits(courses.filter((c) => statuses.includes(termStatus(c.term, today))))
  if (upTo(['done']) >= minCredits) return 'done'
  if (upTo(['done', 'prog']) >= minCredits) return 'prog'
  if (upTo(['done', 'prog', 'plan']) >= minCredits) return 'plan'
  return 'empty'
}

function evaluateSection(plan: Plan, section: Section, today: Date): SectionResult {
  const placed = sectionCourses(plan, section)
  const groupOf = section.groups ? assignGroups(placed, section.groups, section.constraints) : {}
  const chips = (section.constraints ?? []).map((k) => constraintChip(k, placed, groupOf))
  const constraintsOk = chips.every((c) => c.ok)
  const credits = sumCredits(placed)

  if (section.type === 'creditBucket') {
    const min = section.minCredits ?? 0
    const status = bucketStatus(placed, min, today)
    const creditsToGo = Math.max(0, min - credits)
    return {
      section, rows: [], courses: placed, filled: credits, total: min, credits, creditsToGo,
      open: status === 'empty' ? 1 : 0,
      complete: creditsToGo === 0 && constraintsOk,
      chips, groupOf, units: [status],
    }
  }

  const rows = (section.slots ?? []).map((slot) => ({
    slot,
    course: placed.find((c) => c.placement === placementOf(section, slot)) ?? null,
  }))
  const filled = rows.filter((r) => r.course).length
  return {
    section, rows, courses: placed, filled, total: rows.length, credits, creditsToGo: 0,
    open: rows.length - filled,
    complete: filled === rows.length && constraintsOk,
    chips, groupOf,
    units: rows.map((r) => (r.course ? termStatus(r.course.term, today) : 'empty')),
  }
}

function isFailingGrade(template: Template, grade: string | undefined): boolean {
  return !!grade && (template.failingGrades ?? []).includes(grade.toUpperCase())
}

function courseWarnings(plan: Plan, template: Template): Record<string, string[]> {
  const warnings: Record<string, string[]> = {}
  const add = (uid: string, text: string) => (warnings[uid] ??= []).push(text)

  const byCode = new Map<string, PlanCourse[]>()
  for (const course of plan.courses) {
    const code = normalizeCode(course.code)
    byCode.set(code, [...(byCode.get(code) ?? []), course])
  }

  for (const course of plan.courses) {
    const code = normalizeCode(course.code)
    if ((byCode.get(code)?.length ?? 0) > 1 && !template.repeatableCodes?.includes(code)) add(course.uid, 'Used twice')

    const target = findTarget(template, course.placement)
    if (!target) {
      add(course.uid, 'Unknown requirement')
      continue
    }
    if (!target.section) continue
    const failure = ruleFailure(course, target.slot ? target.slot.rule : target.section.rule, target.section.title)
    if (failure) add(course.uid, failure)
    if (target.section.letterGrade && isFailingGrade(template, course.grade)) {
      add(course.uid, /^[SU]/i.test(course.grade!) ? 'S/U in letter-grade row' : 'Needs C- or better')
    }
  }
  return warnings
}

function evaluateCheck(plan: Plan, check: Check): CheckResult {
  const hit = plan.courses.find((c) => check.codes.includes(normalizeCode(c.code)))
  return { check, met: !!hit, text: hit ? check.metText.replace('{code}', hit.code) : check.missText }
}

export function evaluatePlan(plan: Plan, template: Template, today: Date): PlanSummary {
  const sections = template.sections.map((s) => evaluateSection(plan, s, today))

  const counts = { done: 0, prog: 0, plan: 0, empty: 0 }
  for (const unit of sections.flatMap((s) => s.units)) counts[unit] += 1

  // Credits count each course code once and skip sections like PE.
  const noCredit = new Set(template.sections.filter((s) => s.excludeFromCredits).map((s) => s.id))
  const credits = { done: 0, prog: 0, plan: 0 }
  const seen = new Set<string>()
  const creditCourses = plan.courses.filter((c) => !noCredit.has(c.placement.split('/')[0]))
  for (const course of creditCourses) {
    const code = normalizeCode(course.code)
    if (seen.has(code) && !template.repeatableCodes?.includes(code)) continue
    seen.add(code)
    credits[termStatus(course.term, today)] += course.credits
  }

  const whatsLeft: LeftItem[] = sections
    .filter((s) => !s.complete)
    .map((s) => ({
      sectionId: s.section.id,
      label: s.section.leftLabel ?? s.section.title,
      open: s.open,
      creditsToGo: s.section.type === 'creditBucket' ? s.creditsToGo : undefined,
      needs: s.chips.filter((c) => !c.ok).map((c) => `${c.label} ${c.text}`),
    }))

  const openByFilter: Record<string, number> = {}
  for (const s of sections) openByFilter[s.section.filter] = (openByFilter[s.section.filter] ?? 0) + s.open

  const terms = termRange(plan.entryTerm, plan.gradTerm).map((term) => {
    const courses = plan.courses.filter((c) => c.term === term)
    return {
      term,
      status: termStatus(term, today),
      credits: sumCredits(courses.filter((c) => !noCredit.has(c.placement.split('/')[0]))),
      courses,
    }
  })

  return {
    sections,
    counts,
    totalUnits: counts.done + counts.prog + counts.plan + counts.empty,
    credits: { ...credits, total: credits.done + credits.prog + credits.plan, required: template.totalCredits ?? null },
    whatsLeft,
    checks: template.checks.map((k) => evaluateCheck(plan, k)),
    warnings: courseWarnings(plan, template),
    terms,
    openByFilter,
  }
}
