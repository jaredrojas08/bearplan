import { ADDITIONAL, type Plan, type PlanCourse, type Template } from '../types'
import { findTarget } from './requirements'
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

const COUNT_KEYS = { minCredits: 'credits', minCount: 'count', maxCount: 'count', minGroups: 'count', groupMinCredits: 'credits', groupMaxCount: 'count' }

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
  if (type === 'minCount' || type === 'maxCount') errors.push(...matchErrors(constraint.match, `${where}.match`))
  if (type === 'maxCount' && !isString(constraint.reason)) errors.push(`${where}.reason is missing`)
  if ((type === 'groupMinCredits' || type === 'groupMaxCount') && !isString(constraint.group)) errors.push(`${where}.group is missing`)
  return errors
}

function ruleErrors(rule: unknown, where: string): string[] {
  if (rule === undefined) return []
  if (!Array.isArray(rule)) return [`${where}.rule must be a list of matches`]
  return rule.flatMap((m, i) => matchErrors(m, `${where}.rule[${i}]`))
}

export function templateErrors(data: unknown): string[] {
  if (!isObject(data)) return ['The file is not a JSON object']
  const errors: string[] = []
  for (const key of ['id', 'name', 'college']) if (!isString(data[key])) errors.push(`Missing "${key}"`)
  if (!isString(data.matriculatedFrom) || !isTerm(data.matriculatedFrom)) errors.push('"matriculatedFrom" must look like FA24')
  if ('totalCredits' in data && typeof data.totalCredits !== 'number') errors.push('"totalCredits" must be a number')
  if (!Array.isArray(data.filters)) errors.push('"filters" must be a list')
  if (!Array.isArray(data.checks)) errors.push('"checks" must be a list')
  if (!Array.isArray(data.sections) || data.sections.length === 0) return [...errors, '"sections" must be a non-empty list']

  const ids = new Set<string>()
  data.sections.forEach((section: unknown, i: number) => {
    const where = `sections[${i}]`
    if (!isObject(section)) return errors.push(`${where} must be an object`)
    if (!isString(section.id) || section.id.includes('/') || section.id === ADDITIONAL) {
      errors.push(`${where}.id must be a name without "/"`)
    } else if (ids.has(section.id)) {
      errors.push(`${where}.id "${section.id}" is used twice`)
    } else ids.add(section.id)
    if (!isString(section.title)) errors.push(`${where}.title is missing`)
    if (section.column !== 'left' && section.column !== 'right') errors.push(`${where}.column must be "left" or "right"`)
    if (section.type === 'slots') {
      if (!Array.isArray(section.slots)) return errors.push(`${where}.slots must be a list`)
      const slotIds = new Set<string>()
      section.slots.forEach((slot: unknown, j: number) => {
        if (!isObject(slot) || !isString(slot.id) || slot.id.includes('/')) {
          return errors.push(`${where}.slots[${j}] needs an id without "/"`)
        }
        if (slotIds.has(slot.id)) errors.push(`${where}.slots[${j}].id "${slot.id}" is used twice`)
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
    if ('groups' in section) {
      if (!Array.isArray(section.groups)) errors.push(`${where}.groups must be a list`)
      else section.groups.forEach((g: unknown, j: number) => {
        if (!isObject(g) || !isString(g.id) || !isString(g.name)) errors.push(`${where}.groups[${j}] needs an id and a name`)
      })
    }
  })

  ;(Array.isArray(data.checks) ? data.checks : []).forEach((check: unknown, i: number) => {
    if (!isObject(check) || !isString(check.id) || !isStringArray(check.codes)) errors.push(`checks[${i}] needs an id and a codes list`)
    else if (!isString(check.metText) || !isString(check.missText)) errors.push(`checks[${i}] needs metText and missText`)
  })
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
export function normalizePlan(plan: Plan, template: Template): Plan {
  const taken = new Set<string>()
  const courses = plan.courses.map((course): PlanCourse => {
    const target = findTarget(template, course.placement)
    if (!target) return { ...course, placement: ADDITIONAL }
    if (target.slot) {
      if (taken.has(course.placement)) return { ...course, placement: ADDITIONAL }
      taken.add(course.placement)
    }
    return course
  })
  return { ...plan, swimTest: !!plan.swimTest, spclArea: plan.spclArea ?? '', courses }
}
