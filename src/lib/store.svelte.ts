import archaeologyTemplate from '../templates/archaeology-ba.json'
import globalDevelopmentTemplate from '../templates/global-development-bs.json'
import globalDevelopmentPre2025Template from '../templates/global-development-bs-cals-pre2025.json'
import communicationTemplate from '../templates/communication-bs.json'
import communicationPre2025Template from '../templates/communication-bs-cals-pre2025.json'
import examplePlan from '../seed/example-plan.json'
import aemTemplate from '../templates/aem-cals-2025.json'
import aemPre2025Template from '../templates/aem-cals-pre2025.json'
import businessMinor from '../templates/business-minor.json'
import businessMinorEngineers from '../templates/business-minor-engineers.json'
import csBaTemplate from '../templates/computer-science-ba.json'
import csTemplate from '../templates/cs-engineering-fa24.json'
import cognitiveScienceTemplate from '../templates/cognitive-science-ba.json'
import chemistryTemplate from '../templates/chemistry-ba.json'
import astronomyTemplate from '../templates/astronomy-ba.json'
import asianStudiesTemplate from '../templates/asian-studies-ba.json'
import economicsTemplate from '../templates/economics-ba.json'
import latinaOStudiesTemplate from '../templates/latina-o-studies-ba.json'
import historyArtTemplate from '../templates/history-art-ba.json'
import physicsTemplate from '../templates/physics-ba.json'
import jewishStudiesTemplate from '../templates/jewish-studies-ba.json'
import germanStudiesTemplate from '../templates/german-studies-ba.json'
import musicTemplate from '../templates/music-ba.json'
import stsTemplate from '../templates/science-technology-studies-ba.json'
import religiousStudiesTemplate from '../templates/religious-studies-ba.json'
import capsTemplate from '../templates/china-asia-pacific-studies-ba.json'
import spanishTemplate from '../templates/spanish-ba.json'
import italianTemplate from '../templates/italian-ba.json'
import comparativeLiteratureTemplate from '../templates/comparative-literature-ba.json'
import africanaTemplate from '../templates/africana-studies-ba.json'
import classicsTemplate from '../templates/classics-ba.json'
import anthropologyTemplate from '../templates/anthropology-ba.json'
import linguisticsTemplate from '../templates/linguistics-ba.json'
import sociologyTemplate from '../templates/sociology-ba.json'
import philosophyTemplate from '../templates/philosophy-ba.json'
import statisticsTemplate from '../templates/statistics-data-science-ba.json'
import historyTemplate from '../templates/history-ba.json'
import englishTemplate from '../templates/english-ba.json'
import mathematicsTemplate from '../templates/mathematics-ba.json'
import hotelTemplate from '../templates/hotel-management-bs.json'
import governmentTemplate from '../templates/government-ba.json'
import bioBaTemplate from '../templates/biological-sciences-ba.json'
import bioBsPre2025Template from '../templates/biological-sciences-bs-cals-pre2025.json'
import bioBsTemplate from '../templates/biological-sciences-bs.json'
import ilrTemplate from '../templates/industrial-labor-relations-bs.json'
import infoSciBaTemplate from '../templates/information-science-ba.json'
import infoSciBsPre2025Template from '../templates/information-science-bs-cals-pre2025.json'
import infoSciBsTemplate from '../templates/information-science-bs.json'
import orieTemplate from '../templates/operations-research-engineering-bs.json'
import psychologyTemplate from '../templates/psychology-ba.json'
import { ADDITIONAL, type CatalogCourse, type CatalogEntry, type Plan, type PlanCourse, type Template, type Term } from '../types'
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

/** A checklist the pickers can offer, loaded or not. */
export interface ChecklistOption {
  id: string
  name: string
  college: string
  draft: boolean
}

export interface Moving {
  course: NewCourse
  uid?: string
}

const PLAN_KEY = 'bearplan:plan'
const THEME_KEY = 'bearplan:theme'
const TEMPLATES_KEY = 'bearplan:templates'

export const BUILT_IN_TEMPLATES: Template[] = [
  archaeologyTemplate,
  globalDevelopmentTemplate,
  globalDevelopmentPre2025Template,
  communicationTemplate,
  communicationPre2025Template,
  csTemplate,
  aemTemplate,
  aemPre2025Template,
  csBaTemplate,
  economicsTemplate,
  latinaOStudiesTemplate,
  historyArtTemplate,
  astronomyTemplate,
  physicsTemplate,
  jewishStudiesTemplate,
  germanStudiesTemplate,
  musicTemplate,
  cognitiveScienceTemplate,
  stsTemplate,
  religiousStudiesTemplate,
  capsTemplate,
  spanishTemplate,
  italianTemplate,
  comparativeLiteratureTemplate,
  asianStudiesTemplate,
  africanaTemplate,
  classicsTemplate,
  anthropologyTemplate,
  linguisticsTemplate,
  sociologyTemplate,
  philosophyTemplate,
  chemistryTemplate,
  statisticsTemplate,
  historyTemplate,
  englishTemplate,
  mathematicsTemplate,
  governmentTemplate,
  ilrTemplate,
  psychologyTemplate,
  orieTemplate,
  hotelTemplate,
  infoSciBaTemplate,
  infoSciBsTemplate,
  infoSciBsPre2025Template,
  bioBaTemplate,
  bioBsTemplate,
  bioBsPre2025Template,
  businessMinor,
  businessMinorEngineers,
] as Template[]

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
  /** Drafted checklists that load on demand from public/catalog. */
  catalogIndex = $state.raw<CatalogEntry[]>([])
  /** True while a saved plan waits for its checklists to download. */
  restoring = $state(false)
  restoreError = $state<string | null>(null)

  majors = $derived(this.templates.filter((t) => t.kind !== 'minor'))
  minors = $derived(this.templates.filter((t) => t.kind === 'minor'))
  majorOptions = $derived(this.options('major'))
  minorOptions = $derived(this.options('minor'))

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
    const saved = stored && planErrors(stored).length === 0 ? (stored as Plan) : null
    if (saved && !this.hasTemplates(saved)) void this.restore(saved)
    else {
      this.plan = saved ? this.adopt(saved) : null
      this.backupUnreadable()
    }

    const theme = readJson(THEME_KEY)
    this.dark = theme === null ? window.matchMedia('(prefers-color-scheme: dark)').matches : theme === 'dark'

    void this.loadCatalog()
    void this.loadCatalogIndex()

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

  async loadCatalogIndex() {
    try {
      const res = await fetch(`${import.meta.env.BASE_URL}catalog/index.json`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data: unknown = await res.json()
      if (!Array.isArray(data)) throw new Error('not a list')
      this.catalogIndex = data.filter(
        (e): e is CatalogEntry => typeof e?.id === 'string' && typeof e.name === 'string' && (e.kind === 'major' || e.kind === 'minor'),
      )
    } catch {
      // Built-in checklists still work; the pickers just list fewer options.
    }
  }

  /**
   * Downloads drafted checklists that aren't loaded yet. "missing" means a checklist
   * doesn't exist (a retry can't help); "offline" means a download failed.
   */
  async ensureTemplates(ids: string[]): Promise<'ok' | 'missing' | 'offline'> {
    const wanted = [...new Set(ids)].filter((id) => !this.templates.some((t) => t.id === id))
    const results = await Promise.all(
      wanted.map(async (id): Promise<Template | 'missing' | 'offline'> => {
        // Ids come from saved plans and files, so only plain slugs reach the URL.
        if (!/^[a-z0-9-]+$/.test(id)) return 'missing'
        try {
          const res = await fetch(`${import.meta.env.BASE_URL}catalog/${id}.json`)
          if (res.status === 404) return 'missing'
          if (!res.ok) return 'offline'
          const data: unknown = await res.json()
          // A file for a different checklist would leave the requested one missing.
          return templateErrors(data).length === 0 && (data as Template).id === id ? (data as Template) : 'missing'
        } catch {
          return 'offline'
        }
      }),
    )
    const found = results.filter((t): t is Template => typeof t === 'object' && !this.templates.some((x) => x.id === t.id))
    if (found.length) this.templates = [...this.templates, ...found]
    if (results.includes('offline')) return 'offline'
    return ids.every((id) => this.templates.some((t) => t.id === id)) ? 'ok' : 'missing'
  }

  private hasTemplates(plan: Plan): boolean {
    return [plan.templateId, ...(plan.minors ?? [])].every((id) => this.templates.some((t) => t.id === id))
  }

  /** Loads a saved plan's drafted checklists before adopting it, so a failed download never drops courses. */
  async restore(saved: Plan) {
    this.restoring = true
    this.restoreError = null
    const status = await this.ensureTemplates([saved.templateId, ...(saved.minors ?? [])])
    this.restoring = false
    if (status === 'offline') {
      this.restoreError = 'Your plan\'s checklist could not be downloaded. Check your connection and try again.'
      return
    }
    if (status === 'missing') {
      this.restoreError = 'A checklist your plan uses is no longer available. Starting a new plan keeps a copy of this one in your browser.'
      return
    }
    this.plan = this.adopt(saved)
    this.backupUnreadable()
  }

  /** Leaves a plan that can't be restored: keeps a copy aside, then goes to onboarding. */
  startOverFromRestore() {
    if (!this.backupUnreadable()) {
      this.restoreError = 'This browser blocked saving a copy of your plan, so it was left in place. Export it from another browser first.'
      return
    }
    this.restoreError = null
    this.resetPlan()
  }

  retryRestore() {
    const stored = readJson(PLAN_KEY)
    if (stored && planErrors(stored).length === 0) void this.restore(stored as Plan)
  }

  /** Copies an unreadable plan aside so starting a new one can't overwrite it. */
  private backupUnreadable(): boolean {
    // Blocked storage throws here, and then there is nothing to copy.
    try {
      const raw = localStorage.getItem(PLAN_KEY)
      if (!this.plan && raw) localStorage.setItem(`${PLAN_KEY}:unreadable`, raw)
      return true
    } catch {
      return false
    }
  }

  private options(kind: 'major' | 'minor'): ChecklistOption[] {
    const loaded = this.templates
      .filter((t) => (t.kind ?? 'major') === kind)
      .map((t) => ({ id: t.id, name: t.name, college: t.college, draft: !!t.draft }))
    const unloaded = this.catalogIndex
      .filter((e) => e.kind === kind && !loaded.some((t) => t.id === e.id))
      .map((e) => ({ id: e.id, name: e.name, college: e.college, draft: true }))
    // One A-to-Z list; drafts are tagged in their labels instead of grouped apart.
    return [...loaded, ...unloaded].sort((a, b) => a.name.localeCompare(b.name) || a.college.localeCompare(b.college))
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
    // A template that can't hold the plan would replace it with nothing.
    const plan = this.adopt({ ...$state.snapshot(this.plan), ...details })
    if (!plan) return
    this.moving = null
    this.plan = plan
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
  async importPlan(text: string): Promise<string[]> {
    let data: unknown
    try {
      data = JSON.parse(text)
    } catch {
      return ['The file is not valid JSON.']
    }
    const errors = planErrors(data)
    if (errors.length) return errors
    const plan = data as Plan
    // A missing minor would otherwise be dropped and its courses moved to Additional Space.
    const ids = [plan.templateId, ...(plan.minors ?? [])]
    if ((await this.ensureTemplates(ids)) !== 'ok') {
      const missing = ids.filter((id) => !this.templates.some((t) => t.id === id))
      return [`This plan uses checklists that aren't available: ${missing.join(', ')}. Import those templates first, or check your connection.`]
    }
    if (!this.majors.some((t) => t.id === plan.templateId)) {
      return [`"${plan.templateId}" is a minor, not a major checklist.`]
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
    // Swapping a major for a minor under the same id would drop the plan or a minor's courses.
    const existing = this.templates.find((t) => t.id === template.id) ?? this.catalogIndex.find((e) => e.id === template.id)
    if (existing && (existing.kind ?? 'major') !== (template.kind ?? 'major')) {
      return { errors: [`"${template.id}" is already a ${existing.kind ?? 'major'} checklist. Give this file a different id.`] }
    }
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
