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
    const excluded = match.excludeDistributions?.find((c) => hasCategory(course, [c]))
    if (excluded) return `${excluded} courses can't count here`
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

export function isRepeatable(plan: Plan, template: Template, code: string): boolean {
  return !!template.repeatableCodes?.includes(code) || !!plan.repeatable?.includes(code)
}

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
  const parts = placement.split('/')
  if (parts.length > 2) return null
  const [sectionId, slotId] = parts
  const section = template.sections.find((s) => s.id === sectionId)
  if (!section) return null
  if (section.type === 'creditBucket') return parts.length === 1 ? { placement, section } : null
  const slot = section.slots?.find((s) => s.id === slotId)
  return slot ? { placement, section, slot } : null
}

function sectionCourses(plan: Plan, section: Section, exceptUid?: string): PlanCourse[] {
  return plan.courses.filter(
    (c) => c.uid !== exceptUid && (c.placement === section.id || c.placement.startsWith(`${section.id}/`)),
  )
}

/**
 * A course may count once for the major and once for a minor. Each minor's
 * unique-credit check keeps that sharing within the minor's rules.
 */
function isMajorMinorPair(template: Template, a: string, b: string): boolean {
  const first = findTarget(template, a)?.section
  const second = findTarget(template, b)?.section
  return !!first && !!second && !!first.minor !== !!second.minor
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
  if (!isRepeatable(plan, template, code)) {
    const twins = plan.courses.filter((c) => c.uid !== movingUid && normalizeCode(c.code) === code)
    const shared = twins.length === 1 && isMajorMinorPair(template, placement, twins[0].placement)
    if (twins.length && !shared) return `Already counted in ${placementTitle(template, twins[0].placement)}`
  }

  const section = target.section
  if (!section) return null

  const rule = target.slot ? target.slot.rule : section.rule
  const failure = ruleFailure(course, rule, section.title)
  if (failure) return failure

  for (const constraint of section.constraints ?? []) {
    if ((constraint.type !== 'maxCount' && constraint.type !== 'maxCredits') || matchFailure(course, constraint.match) !== null) continue
    const already = sectionCourses(plan, section, movingUid).filter((c) => matchFailure(c, constraint.match) === null)
    if (constraint.type === 'maxCount' && already.length + 1 > constraint.count) return constraint.reason
    if (constraint.type === 'maxCredits' && sumCredits(already) + course.credits > constraint.credits) return constraint.reason
  }
  return null
}

// ---------- evaluation ----------

export interface Chip {
  label: string
  text: string
  ok: boolean
  /** Upper limits: staying under them is the normal state, not progress. */
  limit?: boolean
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
    case 'groupCredits': {
      const total = sumCredits(inGroup(constraint.group))
      return {
        label: constraint.label,
        text: `${Math.min(total, constraint.credits)} / ${constraint.credits} cr`,
        ok: total >= constraint.credits,
      }
    }
    case 'groupMaxCount': {
      const n = inGroup(constraint.group).length
      return { label: constraint.label, text: `max ${constraint.count}, ${n} used`, ok: n <= constraint.count, limit: true }
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
      return { label: constraint.label, text: `max ${constraint.count}, ${n} used`, ok: n <= constraint.count, limit: true }
    }
    case 'maxCredits': {
      const n = sumCredits(courses.filter((c) => matchFailure(c, constraint.match) === null))
      return { label: constraint.label, text: `max ${constraint.credits} cr, ${n} used`, ok: n <= constraint.credits, limit: true }
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

/**
 * Rows that count toward progress: every row without an option, plus the
 * alternative the student is furthest into (most filled rows, then fewest
 * open, then the first listed), so a started option isn't swapped for a shorter one.
 */
function countedRows(rows: SlotRow[]): SlotRow[] {
  const options = [...new Set(rows.map((r) => r.slot.option).filter((o): o is string => !!o))]
  if (options.length === 0) return rows
  const count = (option: string, filled: boolean) => rows.filter((r) => r.slot.option === option && !!r.course === filled).length
  // A finished option wins outright; otherwise the most filled, then the fewest open.
  const rank = (o: string) => [count(o, false) === 0 ? 1 : 0, count(o, true), -count(o, false)]
  const better = (a: string, b: string) => {
    const [ra, rb] = [rank(a), rank(b)]
    const i = ra.findIndex((v, k) => v !== rb[k])
    return i >= 0 && rb[i] > ra[i] ? b : a
  }
  const best = options.reduce(better)
  return rows.filter((r) => !r.slot.option || r.slot.option === best)
}

function evaluateSection(plan: Plan, section: Section, today: Date): SectionResult {
  const placed = sectionCourses(plan, section)
  const rows = (section.slots ?? []).map((slot) => ({
    slot,
    course: placed.find((c) => c.placement === placementOf(section, slot)) ?? null,
  }))
  const counted = countedRows(rows)
  // Constraints judge only the alternative that counts, so two half-done options can't combine.
  const scored = rows.some((r) => r.slot.option) ? counted.flatMap((r) => (r.course ? [r.course] : [])) : placed
  const groupOf = section.groups ? assignGroups(scored, section.groups, section.constraints) : {}
  const chips = (section.constraints ?? []).map((k) => constraintChip(k, scored, groupOf))
  // A section with the swim test (PE) isn't done until the test is checked off.
  const constraintsOk = chips.every((c) => c.ok) && (!section.swimTest || plan.swimTest)
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

  const filled = counted.filter((r) => r.course).length
  return {
    section, rows, courses: placed, filled, total: counted.length, credits, creditsToGo: 0,
    open: counted.length - filled,
    complete: filled === counted.length && constraintsOk,
    chips, groupOf,
    units: counted.map((r) => (r.course ? termStatus(r.course.term, today) : 'empty')),
  }
}

// S/U always breaks a letter-grade row; other failing grades come from the template.
function isFailingGrade(template: Template, grade: string | undefined): boolean {
  return !!grade && (/^[SU]X?$/i.test(grade) || (template.failingGrades ?? []).includes(grade.toUpperCase()))
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
    const copies = byCode.get(code) ?? []
    const shared = copies.length === 2 && isMajorMinorPair(template, copies[0].placement, copies[1].placement)
    if (copies.length > 1 && !shared && !isRepeatable(plan, template, code)) add(course.uid, 'Used twice')

    const target = findTarget(template, course.placement)
    if (!target) {
      add(course.uid, 'Unknown requirement')
      continue
    }
    if (!target.section) continue
    const failure = ruleFailure(course, target.slot ? target.slot.rule : target.section.rule, target.section.title)
    if (failure) add(course.uid, failure)
    const suAllowed = target.section.suAllowedCodes?.includes(code) && /^S$/i.test(course.grade ?? '')
    if (target.section.letterGrade && isFailingGrade(template, course.grade) && !suAllowed) {
      add(course.uid, /^[SU]/i.test(course.grade!) ? 'S/U in letter-grade row' : 'Needs C- or better')
    }
  }
  return warnings
}

function checkFits(check: Check, course: PlanCourse): boolean {
  if (check.codes?.includes(normalizeCode(course.code))) return true
  return !!check.match?.length && ruleFailure(course, check.match) === null
}

/** Checks read the whole plan, so a course can meet one wherever it sits. */
function evaluateChecks(plan: Plan, template: Template): CheckResult[] {
  // Copies of a non-repeatable course share one key, so they count once, matching the degree credit total.
  const keyOf = (course: PlanCourse) => {
    const code = normalizeCode(course.code)
    return isRepeatable(plan, template, code) ? `uid:${course.uid}` : code
  }
  const claimed = new Map<string, Set<string>>()
  return template.checks.map((check) => {
    const taken = (check.group && claimed.get(check.group)) || new Set<string>()
    const used: PlanCourse[] = []
    const usedKeys = new Set<string>()
    const enough = () => (check.credits !== undefined ? sumCredits(used) >= check.credits : used.length >= (check.count ?? 1))
    const pool = plan.courses.filter((course) => {
      const section = findTarget(template, course.placement)?.section
      if (check.minor && section?.minor !== check.minor) return false
      return !check.section || section?.id === check.section
    })
    for (const course of pool) {
      if (enough()) break
      const key = keyOf(course)
      if (taken.has(key) || usedKeys.has(key) || !checkFits(check, course)) continue
      used.push(course)
      usedKeys.add(key)
    }
    if (check.group) claimed.set(check.group, new Set([...taken, ...usedKeys]))

    const met = enough()
    const codes = used.map((c) => c.code).join(', ')
    const progress = check.credits !== undefined ? `${sumCredits(used)} / ${check.credits} cr` : `${used.length} / ${check.count ?? 1}`
    const text = met ? check.metText.replace('{code}', codes) : used.length ? `${progress} so far (${codes}), ${check.missText}` : check.missText
    return { check, met, text }
  })
}

/** The template plus each minor's sections and checks, with ids prefixed so files can't collide. */
export function withMinors(template: Template, minors: Template[]): Template {
  if (minors.length === 0) return template
  const filterId = (minor: Template) => `minor:${minor.id}`
  return {
    ...template,
    filters: [...template.filters, ...minors.map((m) => ({ id: filterId(m), label: m.name, icon: 'book' as const }))],
    sections: [
      ...template.sections,
      ...minors.flatMap((m) =>
        m.sections.map((s) => ({
          ...s,
          id: `${m.id}.${s.id}`,
          // Section titles like "Core Courses" need the minor's name next to the major's sections.
          title: s.title.includes(m.name) ? s.title : `${m.name}: ${s.title}`,
          filter: filterId(m),
          leftLabel: `${m.name}: ${s.leftLabel ?? s.title}`,
          minor: m.id,
        })),
      ),
    ],
    checks: [
      ...template.checks,
      ...minors.flatMap((m) =>
        m.checks.map((c) => ({
          ...c,
          id: `${m.id}.${c.id}`,
          title: `${m.name}: ${c.title}`,
          minor: m.id,
          ...(c.group ? { group: `${m.id}.${c.group}` } : {}),
          // Section ids get the minor's prefix when merged, so the scope does too.
          ...(c.section ? { section: `${m.id}.${c.section}` } : {}),
        })),
      ),
    ],
    addedMinors: minors.map(({ id, name, minUniqueCredits, draft, source }) => ({ id, name, minUniqueCredits, draft, source })),
  }
}

/** Credits in each minor that don't also count toward the major. */
function minorUniqueChecks(plan: Plan, template: Template): CheckResult[] {
  const sectionOf = (c: PlanCourse) => findTarget(template, c.placement)?.section
  const majorCodes = new Set(plan.courses.filter((c) => sectionOf(c) && !sectionOf(c)!.minor).map((c) => normalizeCode(c.code)))
  return (template.addedMinors ?? [])
    .filter((m) => m.minUniqueCredits)
    .map((m) => {
      // Copies of a non-repeatable course count once, as in the degree credit total.
      const seen = new Set<string>()
      const unique = plan.courses.filter((c) => {
        const code = normalizeCode(c.code)
        if (sectionOf(c)?.minor !== m.id || majorCodes.has(code) || seen.has(code)) return false
        if (!isRepeatable(plan, template, code)) seen.add(code)
        return true
      })
      const credits = sumCredits(unique)
      const need = m.minUniqueCredits!
      const check: Check = { id: `${m.id}.unique`, title: `${m.name}: unique credits`, metText: '', missText: '' }
      const met = credits >= need
      return { check, met, text: `${Math.min(credits, need)} / ${need} cr not shared with your major${met ? '' : ' so far'}.` }
    })
}

/** The template plus the sections of the concentrations a plan picked. */
export function withConcentrations(template: Template, chosen: string[] = []): Template {
  const extra = (template.concentrations ?? []).filter((c) => chosen.includes(c.id)).flatMap((c) => c.sections)
  return extra.length ? { ...template, sections: [...template.sections, ...extra] } : template
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
    if (seen.has(code) && !isRepeatable(plan, template, code)) continue
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
    checks: [...evaluateChecks(plan, template), ...minorUniqueChecks(plan, template)],
    warnings: courseWarnings(plan, template),
    terms,
    openByFilter,
  }
}
