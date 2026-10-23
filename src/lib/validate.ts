import { ADDITIONAL, type Plan, type PlanCourse, type Template } from '../types'
import { findTarget, normalizeCode, withConcentrations, withMinors } from './requirements'
import { isTerm, termIndex } from './terms'

// Imported JSON comes from users, so check the shape before the app trusts it.

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const isString = (v: unknown): v is string => typeof v === 'string' && v.length > 0
const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string')

const MATCH_ARRAYS = ['codes', 'subjects', 'excludeSubjects', 'excludeCodes', 'numberPattern', 'excludeNumberPattern', 'distributions']
const MATCH_NUMBERS = ['minLevel', 'maxLevel', 'minCredits']

function matchErrors(match: unknown, where: string): string[] {
  if (!isObject(match)) return [`${where}: a match must be an object`]
  const errors: string[] = []
  for (const key of MATCH_ARRAYS) {
    if (key in match && !isStringArray(match[key])) errors.push(`${where}.${key} must be a list of strings`)
  }
  for (const key of MATCH_NUMBERS) {
    if (key in match && typeof match[key] !== 'number') errors.push(`${where}.${key} must be a number`)
  }
  return errors
}

const COUNT_KEYS = {
  minCredits: 'credits',
  minCount: 'count',
  maxCount: 'count',
  maxCredits: 'credits',
  minGroups: 'count',
  groupMinCredits: 'credits',
  groupCredits: 'credits',
  groupMaxCount: 'count',
}

function constraintErrors(constraint: unknown, where: string): string[] {
  if (!isObject(constraint)) return [`${where} must be an object`]
  const type = constraint.type as keyof typeof COUNT_KEYS
  if (!(type in COUNT_KEYS)) return [`${where}.type "${String(constraint.type)}" is not supported`]
  const errors: string[] = []
  if (!isString(constraint.label)) errors.push(`${where}.label is missing`)
  const key = COUNT_KEYS[type]
  const value = constraint[key]
  // Negative thresholds pass with no courses, and fractional counts can never be met exactly.
  const valid = typeof value === 'number' && Number.isFinite(value) && value >= 0 && (key === 'credits' || Number.isInteger(value))
  if (!valid) errors.push(`${where}.${key} must be ${key === 'count' ? 'a whole number' : 'a number'} of at least 0`)
  if (type === 'minCount' || type === 'maxCount' || type === 'maxCredits') errors.push(...matchErrors(constraint.match, `${where}.match`))
  if ((type === 'maxCount' || type === 'maxCredits') && !isString(constraint.reason)) errors.push(`${where}.reason is missing`)
  if ((type === 'groupMinCredits' || type === 'groupCredits' || type === 'groupMaxCount') && !isString(constraint.group)) errors.push(`${where}.group is missing`)
  return errors
}

function ruleErrors(rule: unknown, where: string): string[] {
  if (rule === undefined) return []
  if (!Array.isArray(rule)) return [`${where}.rule must be a list of matches`]
  return rule.flatMap((m, i) => matchErrors(m, `${where}.rule[${i}]`))
}

function sectionErrors(section: unknown, where: string, ids: Set<string>): string[] {
  if (!isObject(section)) return [`${where} must be an object`]
  const errors: string[] = []
  if (!isString(section.id) || section.id.includes('/') || section.id === ADDITIONAL) {
    errors.push(`${where}.id must be a name without "/"`)
  } else if (ids.has(section.id)) {
    errors.push(`${where}.id "${section.id}" is used twice`)
  } else ids.add(section.id)
  if (!isString(section.title)) errors.push(`${where}.title is missing`)
  if (section.column !== 'left' && section.column !== 'right') errors.push(`${where}.column must be "left" or "right"`)
  if (section.type === 'slots') {
    if (!Array.isArray(section.slots)) return [...errors, `${where}.slots must be a list`]
    const slotIds = new Set<string>()
    section.slots.forEach((slot: unknown, j: number) => {
      if (!isObject(slot) || !isString(slot.id) || slot.id.includes('/')) {
        return errors.push(`${where}.slots[${j}] needs an id without "/"`)
      }
      if (slotIds.has(slot.id)) errors.push(`${where}.slots[${j}].id "${slot.id}" is used twice`)
      if ('option' in slot && !isString(slot.option)) errors.push(`${where}.slots[${j}].option must be text`)
      slotIds.add(slot.id)
      errors.push(...ruleErrors(slot.rule, `${where}.slots[${j}]`))
    })
  } else if (section.type === 'creditBucket') {
    if (typeof section.minCredits !== 'number') errors.push(`${where}.minCredits must be a number`)
    errors.push(...ruleErrors(section.rule, where))
  } else {
    errors.push(`${where}.type must be "slots" or "creditBucket"`)
  }
  if ('constraints' in section) {
    if (!Array.isArray(section.constraints)) errors.push(`${where}.constraints must be a list`)
    else section.constraints.forEach((c: unknown, j: number) => errors.push(...constraintErrors(c, `${where}.constraints[${j}]`)))
  }
  if ('suAllowedCodes' in section && !isStringArray(section.suAllowedCodes)) errors.push(`${where}.suAllowedCodes must be a list of course codes`)
  if ('groups' in section) {
    if (!Array.isArray(section.groups)) errors.push(`${where}.groups must be a list`)
    else section.groups.forEach((g: unknown, j: number) => {
      if (!isObject(g) || !isString(g.id) || !isString(g.name)) errors.push(`${where}.groups[${j}] needs an id and a name`)
    })
  }
  return errors
}

function checkErrors(check: unknown, where: string, sectionIds: Set<string>): string[] {
  if (!isObject(check) || !isString(check.id) || !isString(check.title)) return [`${where} needs an id and a title`]
  const errors: string[] = []
  const hasCodes = isStringArray(check.codes) && check.codes.length > 0
  const hasMatch = Array.isArray(check.match) && check.match.length > 0
  // An empty match list passes every course, so a check needs real criteria.
  if (!hasCodes && !hasMatch) errors.push(`${where} needs a codes list or a match list`)
  if ('codes' in check && !isStringArray(check.codes)) errors.push(`${where}.codes must be a list of strings`)
  if ('match' in check) {
    if (!Array.isArray(check.match)) errors.push(`${where}.match must be a list of matches`)
    else check.match.forEach((m, i) => errors.push(...matchErrors(m, `${where}.match[${i}]`)))
  }
  if ('count' in check && !(Number.isInteger(check.count) && (check.count as number) >= 1)) errors.push(`${where}.count must be a whole number of at least 1`)
  if ('credits' in check && !(typeof check.credits === 'number' && check.credits > 0)) errors.push(`${where}.credits must be a number above 0`)
  if ('group' in check && !isString(check.group)) errors.push(`${where}.group must be text`)
  // A mistyped section would leave the check unmet forever, so it must name a real one.
  if ('section' in check && !(isString(check.section) && sectionIds.has(check.section))) {
    errors.push(`${where}.section must be the id of a section in this template`)
  }
  if (!isString(check.metText) || !isString(check.missText)) errors.push(`${where} needs metText and missText`)
  return errors
}

export function templateErrors(data: unknown): string[] {
  if (!isObject(data)) return ['The file is not a JSON object']
  const errors: string[] = []
  for (const key of ['id', 'name', 'college']) if (!isString(data[key])) errors.push(`Missing "${key}"`)
  if (!isString(data.matriculatedFrom) || !isTerm(data.matriculatedFrom)) errors.push('"matriculatedFrom" must look like FA24')
  if ('matriculatedBefore' in data && !(isString(data.matriculatedBefore) && isTerm(data.matriculatedBefore))) {
    errors.push('"matriculatedBefore" must look like FA25')
  }
  if ('totalCredits' in data && typeof data.totalCredits !== 'number') errors.push('"totalCredits" must be a number')
  if ('footnote' in data && typeof data.footnote !== 'string') errors.push('"footnote" must be text')
  if ('kind' in data && data.kind !== 'major' && data.kind !== 'minor') errors.push('"kind" must be "major" or "minor"')
  if ('draft' in data && typeof data.draft !== 'boolean') errors.push('"draft" must be true or false')
  // The source becomes a link, so only web addresses are allowed.
  if ('source' in data && !(typeof data.source === 'string' && /^https:\/\/[^\s"<>]+$/.test(data.source))) errors.push('"source" must be an https:// link')
  if ('minUniqueCredits' in data && !(typeof data.minUniqueCredits === 'number' && data.minUniqueCredits >= 0)) {
    errors.push('"minUniqueCredits" must be a number of at least 0')
  }
  // Minors attach to a major's plan, so options that only make sense for the plan's own checklist are refused.
  if (data.kind === 'minor') {
    for (const key of ['concentrations', 'totalCredits']) if (key in data) errors.push(`A minor can't set "${key}"`)
  }
  if (!Array.isArray(data.filters)) errors.push('"filters" must be a list')
  if (!Array.isArray(data.checks)) errors.push('"checks" must be a list')
  if (!Array.isArray(data.sections) || data.sections.length === 0) return [...errors, '"sections" must be a non-empty list']

  // Section ids stay unique across concentrations too, since a plan can combine them.
  const ids = new Set<string>()
  data.sections.forEach((section: unknown, i: number) => errors.push(...sectionErrors(section, `sections[${i}]`, ids)))

  const concentrationIds = new Set<string>()
  if ('concentrations' in data) {
    if (!Array.isArray(data.concentrations)) errors.push('"concentrations" must be a list')
    else data.concentrations.forEach((c: unknown, i: number) => {
      const where = `concentrations[${i}]`
      if (!isObject(c) || !isString(c.id) || !isString(c.name)) return errors.push(`${where} needs an id and a name`)
      if (concentrationIds.has(c.id)) errors.push(`${where}.id "${c.id}" is used twice`)
      concentrationIds.add(c.id)
      if (!Array.isArray(c.sections) || c.sections.length === 0) return errors.push(`${where}.sections must be a non-empty list`)
      c.sections.forEach((section: unknown, j: number) => errors.push(...sectionErrors(section, `${where}.sections[${j}]`, ids)))
    })
  }
  if ('requiresConcentration' in data && typeof data.requiresConcentration !== 'boolean') errors.push('"requiresConcentration" must be true or false')
  // Requiring a pick with nothing to pick would leave the plan unsaveable.
  if (data.requiresConcentration === true && !(Array.isArray(data.concentrations) && data.concentrations.length > 0)) {
    errors.push('"requiresConcentration" needs a non-empty "concentrations" list')
  }
  if ('maxConcentrations' in data && !(Number.isInteger(data.maxConcentrations) && (data.maxConcentrations as number) >= 1)) {
    errors.push('"maxConcentrations" must be a whole number of at least 1')
  }

  ;(Array.isArray(data.checks) ? data.checks : []).forEach((check: unknown, i: number) => errors.push(...checkErrors(check, `checks[${i}]`, ids)))
  return errors
}

function courseErrors(course: unknown, i: number): string[] {
  const where = `courses[${i}]`
  if (!isObject(course)) return [`${where} must be an object`]
  const errors: string[] = []
  for (const key of ['uid', 'code', 'placement']) if (!isString(course[key])) errors.push(`${where}.${key} is missing`)
  if (typeof course.title !== 'string') errors.push(`${where}.title must be text`)
  if (typeof course.credits !== 'number' || course.credits < 0 || course.credits > 30) errors.push(`${where}.credits must be 0 to 30`)
  if (!isString(course.term) || !isTerm(course.term)) errors.push(`${where}.term must look like FA24`)
  if ('distributions' in course && !isStringArray(course.distributions)) errors.push(`${where}.distributions must be a list`)
  if ('grade' in course && course.grade !== undefined && typeof course.grade !== 'string') errors.push(`${where}.grade must be text`)
  return errors
}

export function planErrors(data: unknown): string[] {
  if (!isObject(data)) return ['The file is not a JSON object']
  const errors: string[] = []
  if (data.version !== 1) errors.push('Unsupported plan version')
  if (typeof data.name !== 'string') errors.push('Missing "name"')
  if (!isString(data.templateId)) errors.push('Missing "templateId"')
  for (const key of ['entryTerm', 'gradTerm']) {
    if (!isString(data[key]) || !isTerm(data[key])) errors.push(`"${key}" must look like FA24`)
  }
  if (errors.length === 0 && termIndex(data.entryTerm as string) > termIndex(data.gradTerm as string)) {
    errors.push('Graduation term is before the entry term')
  }
  if ('repeatable' in data && !isStringArray(data.repeatable)) errors.push('"repeatable" must be a list of course codes')
  if ('concentrations' in data && !isStringArray(data.concentrations)) errors.push('"concentrations" must be a list of ids')
  if ('minors' in data && !isStringArray(data.minors)) errors.push('"minors" must be a list of ids')
  if (!Array.isArray(data.courses)) return [...errors, '"courses" must be a list']
  data.courses.forEach((c: unknown, i: number) => errors.push(...courseErrors(c, i)))
  const uids = new Set<unknown>()
  data.courses.forEach((c: unknown, i: number) => {
    if (!isObject(c)) return
    if (uids.has(c.uid)) errors.push(`courses[${i}].uid "${String(c.uid)}" is used twice`)
    uids.add(c.uid)
  })
  return errors
}

/**
 * Moves courses whose placement the template doesn't know, or whose slot is
 * already taken, into additional space so nothing is silently dropped.
 */
export function normalizePlan(plan: Plan, template: Template, available: Template[] = []): Plan {
  // Concentrations the template doesn't offer, or past its limit, are dropped.
  const offered = new Set(template.concentrations?.map((c) => c.id))
  const concentrations = [...new Set(plan.concentrations?.filter((id) => offered.has(id)))].slice(0, template.maxConcentrations ?? 1)
  // Minors that aren't loaded are dropped, and their courses move to additional space.
  const minors = [...new Set(plan.minors)].flatMap((id) => available.filter((t) => t.kind === 'minor' && t.id === id))
  const resolved = withMinors(withConcentrations(template, concentrations), minors)

  const taken = new Set<string>()
  const courses = plan.courses.map((course): PlanCourse => {
    const target = findTarget(resolved, course.placement)
    if (!target) return { ...course, placement: ADDITIONAL }
    if (target.slot) {
      if (taken.has(course.placement)) return { ...course, placement: ADDITIONAL }
      taken.add(course.placement)
    }
    return course
  })
  // Hand-edited files may write "cs  4998"; matching compares normalized codes.
  const repeatable = plan.repeatable?.map(normalizeCode)
  return {
    ...plan,
    swimTest: !!plan.swimTest,
    spclArea: plan.spclArea ?? '',
    courses,
    ...(repeatable ? { repeatable } : {}),
    ...(plan.concentrations ? { concentrations } : {}),
    ...(plan.minors ? { minors: minors.map((m) => m.id) } : {}),
  }
}
