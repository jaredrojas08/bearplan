import examplePlan from '../seed/example-plan.json'
import aemTemplate from '../templates/aem-cals-2025.json'
import aemPre2025Template from '../templates/aem-cals-pre2025.json'
import businessMinor from '../templates/business-minor.json'
import businessMinorEngineers from '../templates/business-minor-engineers.json'
import csTemplate from '../templates/cs-engineering-fa24.json'
import { ADDITIONAL, type CatalogCourse, type Plan, type PlanCourse, type Template, type Term } from '../types'
import { buildIndex, type SearchIndexEntry } from './search'
import { evaluatePlan, findTarget, normalizeCode, placeFailure, placementOf, withConcentrations, withMinors, type CourseFacts } from './requirements'
import { termRange, upcomingTerm } from './terms'
import { normalizePlan, planErrors, templateErrors } from './validate'

export interface NewCourse extends CourseFacts {
  title: string
}

/** A course being moved (has a uid) or a new one being placed (no uid). */
export interface PlanDetails {
  name: string
  templateId: string
  entryTerm: Term
  gradTerm: Term
  concentrations: string[]
  minors: string[]
}

export interface Moving {
  course: NewCourse
  uid?: string
}

const PLAN_KEY = 'bearplan:plan'
const THEME_KEY = 'bearplan:theme'
const TEMPLATES_KEY = 'bearplan:templates'

export const BUILT_IN_TEMPLATES: Template[] = [csTemplate, aemTemplate, aemPre2025Template, businessMinor, businessMinorEngineers] as Template[]

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

  majors = $derived(this.templates.filter((t) => t.kind !== 'minor'))
  minors = $derived(this.templates.filter((t) => t.kind === 'minor'))

  /** The plan's template with its chosen concentrations' and minors' sections added. */
  template = $derived.by(() => {
    const base = this.templates.find((t) => t.id === this.plan?.templateId)
    if (!base) return null
    const minors = (this.plan?.minors ?? []).flatMap((id) => this.minors.filter((m) => m.id === id))
    return withMinors(withConcentrations(base, this.plan?.concentrations), minors)
  })
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
    const imported = readJson(TEMPLATES_KEY)
    if (Array.isArray(imported)) {
      const valid = imported.filter((t) => templateErrors(t).length === 0) as Template[]
      this.templates = [...BUILT_IN_TEMPLATES, ...valid.filter((t) => !BUILT_IN_TEMPLATES.some((b) => b.id === t.id))]
    }

    // No saved plan, or one that no longer validates, sends the user to onboarding.
    const stored = readJson(PLAN_KEY)
    this.plan = stored && planErrors(stored).length === 0 ? this.adopt(stored as Plan) : null
    // Copy an unreadable plan aside so starting a new one can't overwrite it.
    // Blocked storage throws here, and then there is nothing to copy.
    try {
      const raw = localStorage.getItem(PLAN_KEY)
      if (!this.plan && raw) localStorage.setItem(`${PLAN_KEY}:unreadable`, raw)
    } catch {}

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

  createPlan(details: PlanDetails) {
    this.plan = { version: 1, ...details, swimTest: false, spclArea: '', courses: [] }
  }

  loadExample() {
    this.plan = this.adopt(structuredClone(examplePlan) as Plan)
  }

  /** Changing the template can orphan placements, so those courses move to additional space. */
  updateDetails(details: PlanDetails) {
    if (!this.plan) return
    this.moving = null
    this.plan = this.adopt({ ...$state.snapshot(this.plan), ...details })
  }

  resetPlan() {
    this.moving = null
    this.plan = null
    try {
      localStorage.removeItem(PLAN_KEY)
    } catch {
      // Nothing saved to remove.
    }
  }

  /** Returns the problems that stopped the import, or an empty list on success. */
  importPlan(text: string): string[] {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return ['The file is not valid JSON.']
    }
    const errors = planErrors(data)
    if (errors.length) return errors
    const plan = data as Plan
    if (!this.majors.some((t) => t.id === plan.templateId)) {
      return [`This plan uses the "${plan.templateId}" checklist. Import that template first.`]
    }
    this.moving = null
    this.plan = this.adopt(plan)
    return []
  }

  importTemplate(text: string): { errors: string[]; template?: Template } {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return { errors: ['The file is not valid JSON.'] }
    }
    const errors = templateErrors(data)
    if (errors.length) return { errors }
    const template = data as Template
    if (BUILT_IN_TEMPLATES.some((t) => t.id === template.id)) {
      return { errors: [`"${template.id}" is a built-in checklist. Give your copy a different id.`] }
    }
    this.templates = [...this.templates.filter((t) => t.id !== template.id), template]
    this.persist(TEMPLATES_KEY, this.templates.filter((t) => !BUILT_IN_TEMPLATES.some((b) => b.id === t.id)))
    // A replaced template can drop slots, so the open plan's placements need rechecking.
    if (this.plan?.templateId === template.id || this.plan?.minors?.includes(template.id)) {
      this.moving = null
      this.plan = this.adopt($state.snapshot(this.plan))
    }
    return { errors: [], template }
  }

  exportPlan() {
    if (!this.plan) return
    const blob = new Blob([JSON.stringify($state.snapshot(this.plan), null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `bearplan-${this.plan.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-') || 'plan'}.json`
    link.click()
    setTimeout(() => URL.revokeObjectURL(url))
  }

  private adopt(plan: Plan): Plan | null {
    const template = this.templates.find((t) => t.id === plan.templateId)
    return template && template.kind !== 'minor' ? normalizePlan(plan, template, this.templates) : null
  }

  private persist(key: string, value: unknown) {
    try {
      localStorage.setItem(key, JSON.stringify(value))
      // A small theme write can succeed while the plan is still unsaved.
      if (key === PLAN_KEY) this.saveError = null
    } catch {
      this.saveError = 'Changes could not be saved in this browser. Export your plan to keep it.'
    }
  }

  toggleDark() {
    this.dark = !this.dark
    this.persist(THEME_KEY, this.dark ? 'dark' : 'light')
  }

  defaultTerm(): Term {
    return upcomingTerm(this.terms, this.today)
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

  toggleRepeatable(code: string) {
    if (!this.plan) return
    const codes = this.plan.repeatable ?? []
    this.plan.repeatable = codes.includes(code) ? codes.filter((c) => c !== code) : [...codes, code]
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
