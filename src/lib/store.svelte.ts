import examplePlan from '../seed/example-plan.json'
import csTemplate from '../templates/cs-engineering-fa24.json'
import { ADDITIONAL, type CatalogCourse, type Plan, type PlanCourse, type Template, type Term } from '../types'
import { buildIndex, type SearchIndexEntry } from './search'
import { evaluatePlan, findTarget, normalizeCode, placeFailure, placementOf, type CourseFacts } from './requirements'
import { currentTerm, nowIndex, termIndex, termRange } from './terms'
import { normalizePlan, planErrors } from './validate'

export interface NewCourse extends CourseFacts {
  title: string
}

/** A course being moved (has a uid) or a new one being placed (no uid). */
export interface Moving {
  course: NewCourse
  uid?: string
}

const PLAN_KEY = 'bearplan:plan'
const THEME_KEY = 'bearplan:theme'

export const BUILT_IN_TEMPLATES: Template[] = [csTemplate as Template]

function readJson(key: string): unknown {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

class AppState {
  today = new Date()
  templates = $state<Template[]>([...BUILT_IN_TEMPLATES])
  plan = $state<Plan | null>(null)
  moving = $state<Moving | null>(null)
  dark = $state(false)
  saveError = $state<string | null>(null)
  catalog = $state.raw<SearchIndexEntry[] | null>(null)
  catalogError = $state<string | null>(null)

  template = $derived(this.templates.find((t) => t.id === this.plan?.templateId) ?? null)
  summary = $derived(this.plan && this.template ? evaluatePlan(this.plan, this.template, this.today) : null)
  terms = $derived(this.plan ? termRange(this.plan.entryTerm, this.plan.gradTerm) : [])

  /** Every open spot mapped to why the moving course can't go there, or null if it can. */
  targets = $derived.by(() => {
    const { plan, template, moving } = this
    if (!plan || !template || !moving) return null
    const result = new Map<string, string | null>()
    const current = plan.courses.find((c) => c.uid === moving.uid)?.placement
    const check = (placement: string) => {
      if (placement !== current) result.set(placement, placeFailure(plan, template, moving.course, placement, moving.uid))
    }
    for (const section of template.sections) {
      if (section.type === 'creditBucket') check(section.id)
      for (const slot of section.slots ?? []) {
        const placement = placementOf(section, slot)
        if (!plan.courses.some((c) => c.placement === placement)) check(placement)
      }
    }
    check(ADDITIONAL)
    return result
  })

  constructor() {
    const stored = readJson(PLAN_KEY)
    // TODO: replace the example fallback with onboarding.
    this.plan = this.adopt(stored && planErrors(stored).length === 0 ? (stored as Plan) : (examplePlan as Plan))

    const theme = readJson(THEME_KEY)
    this.dark = theme === null ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'

    void this.loadCatalog()

    $effect.root(() => {
      $effect(() => {
        document.documentElement.classList.toggle('dark', this.dark)
      })
      $effect(() => {
        if (this.plan) this.persist(PLAN_KEY, $state.snapshot(this.plan))
      })
    })
  }

  async loadCatalog() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}courses.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (!Array.isArray(data)) throw new Error('not a list')
      this.catalog = buildIndex(data as CatalogCourse[])
    } catch {
      this.catalogError = 'Course list unavailable. Run npm run fetch-courses, or add a custom course.'
    }
  }

  private adopt(plan: Plan): Plan | null {
    const template = this.templates.find((t) => t.id === plan.templateId)
    return template ? normalizePlan(plan, template) : null
  }

  private persist(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      this.saveError = null
    } catch {
      this.saveError = 'Changes could not be saved in this browser. Export your plan to keep it.'
    }
  }

  toggleDark() {
    this.dark = !this.dark
    this.persist(THEME_KEY, this.dark ? 'dark' : 'light')
  }

  /** New courses land in the current term, or the nearest end of the plan's range. */
  defaultTerm(): Term {
    const terms = this.terms
    const now = currentTerm(this.today)
    if (now && terms.includes(now)) return now
    const today = nowIndex(this.today)
    return today < termIndex(terms[0]) ? terms[0] : terms[terms.length - 1]
  }

  startMove(uid: string) {
    const course = this.plan?.courses.find((c) => c.uid === uid)
    if (!course) return
    this.moving = this.moving?.uid === uid ? null : { course: { ...course }, uid }
  }

  startPlacing(course: NewCourse) {
    this.moving = { course: { ...course, code: normalizeCode(course.code) } }
  }

  cancelMove() {
    this.moving = null
  }

  /** Drops the moving course into a placement if the rules allow it. */
  place(placement: string): boolean {
    const { plan, template, moving } = this
    if (!plan || !template || !moving) return false
    if (placeFailure(plan, template, moving.course, placement, moving.uid) !== null) return false
    if (moving.uid) {
      const course = plan.courses.find((c) => c.uid === moving.uid)
      if (course) course.placement = placement
    } else {
      plan.courses.push({
        uid: crypto.randomUUID(),
        code: moving.course.code,
        title: moving.course.title,
        credits: moving.course.credits,
        term: this.defaultTerm(),
        placement,
        ...(moving.course.distributions?.length ? { distributions: moving.course.distributions } : {}),
      })
    }
    this.moving = null
    return true
  }

  updateCourse(uid: string, patch: Partial<Pick<PlanCourse, 'term' | 'grade' | 'note' | 'credits'>>) {
    const course = this.plan?.courses.find((c) => c.uid === uid)
    if (course) Object.assign(course, patch)
  }

  removeCourse(uid: string) {
    if (!this.plan) return
    this.plan.courses = this.plan.courses.filter((c) => c.uid !== uid)
    if (this.moving?.uid === uid) this.moving = null
  }

  /** Label of the requirement a course counts toward, for chips and tooltips. */
  placementLabel(placement: string): string {
    const section = this.template && findTarget(this.template, placement)?.section
    return section ? (section.leftLabel ?? section.title) : 'Additional'
  }
}

export const app = new AppState()
