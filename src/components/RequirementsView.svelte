<script lang="ts">
  import type { SectionResult } from '../lib/requirements'
  import { app } from '../lib/store.svelte'
  import { ADDITIONAL, type Section } from '../types'
  import { readFile } from '../lib/files'
  import CourseSearch from './CourseSearch.svelte'
  import CustomCourseDialog from './CustomCourseDialog.svelte'
  import Icon from './Icon.svelte'
  import SectionCard from './SectionCard.svelte'

  const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D+', 'D', 'D-', 'F', 'S', 'SX', 'U', 'UX', 'INC', 'W']

  const EXTRA_SECTION: Section = {
    id: ADDITIONAL,
    title: 'Additional Space',
    column: 'right',
    filter: '',
    icon: 'plus',
    note: 'Does not count toward requirements.',
    type: 'creditBucket',
    minCredits: 0,
  }

  let filter = $state('all')
  let planInput: HTMLInputElement
  let importErrors = $state<string[]>([])

  async function onPlanFile(event: Event) {
    const file = await readFile(event)
    if (!file) return
    if ('error' in file) {
      importErrors = [file.error]
      return
    }
    if (!confirm('Replace your current plan with this file? Export first if you want to keep it.')) return
    importErrors = app.importPlan(file.text)
  }
  let customDialog: CustomCourseDialog

  let extraResult = $derived.by((): SectionResult => {
    const courses = app.plan?.courses.filter((c) => c.placement === ADDITIONAL) ?? []
    const credits = courses.reduce((sum, c) => sum + c.credits, 0)
    return {
      section: EXTRA_SECTION, rows: [], courses, filled: credits, total: 0, credits, creditsToGo: 0,
      open: 0, complete: false, chips: [], groupOf: {}, units: [],
    }
  })

  // Rough card height, used to balance two columns when a filter is on.
  const cardSize = (r: SectionResult) => (r.section.slots?.length ?? r.courses.length + 1) + 2 + (r.section.note ? 1 : 0)

  let columns = $derived.by((): SectionResult[][] => {
    const results = app.summary?.sections ?? []
    if (filter === 'all') {
      return [
        results.filter((r) => r.section.column === 'left'),
        [...results.filter((r) => r.section.column === 'right'), extraResult],
      ]
    }
    const cols: SectionResult[][] = [[], []]
    const heights = [0, 0]
    for (const r of results.filter((r) => r.section.filter === filter)) {
      const i = heights[0] <= heights[1] ? 0 : 1
      cols[i].push(r)
      heights[i] += cardSize(r)
    }
    return cols
  })

  let filters = $derived([
    { id: 'all', label: 'All', icon: 'grid', open: Object.values(app.summary?.openByFilter ?? {}).reduce((a, b) => a + b, 0) },
    ...(app.template?.filters ?? []).map((f) => ({ ...f, icon: f.icon ?? 'star', open: app.summary?.openByFilter[f.id] ?? 0 })),
  ])

  let targetSummary = $derived.by(() => {
    if (!app.targets || !app.template) return { count: 0, areas: '' }
    const open = [...app.targets].filter(([, failure]) => failure === null).map(([p]) => p)
    const areas = [...new Set(open.map((p) => app.placementLabel(p)))]
    return { count: open.length, areas: areas.length ? areas.join(', ') : 'no other requirement' }
  })

  function onKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape' && app.moving) app.cancelMove()
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="view">
  <header class="top">
    <div class="titles">
      <span class="eyebrow">{app.template?.name} · {app.template?.college}</span>
      <h1 class="title">Degree requirements</h1>
    </div>
    <div class="actions">
      <button class="btn" onclick={() => planInput.click()}>Import</button>
      <button class="btn" onclick={() => app.exportPlan()}>Export</button>
      <input bind:this={planInput} type="file" accept="application/json,.json" hidden onchange={onPlanFile} />
    </div>
  </header>
  {#if importErrors.length}
    <ul class="errors" role="alert">
      {#each importErrors.slice(0, 5) as error (error)}<li>{error}</li>{/each}
    </ul>
  {/if}

  <div class="filters" role="toolbar" aria-label="Requirement groups">
    {#each filters as f (f.id)}
      <button class="pill" class:on={filter === f.id} aria-pressed={filter === f.id} onclick={() => (filter = f.id)}>
        <span class="ic"><Icon name={f.icon} /></span>
        {f.label}
        <span class="mono count">{f.open} open</span>
      </button>
    {/each}
  </div>

  <section class="add" aria-labelledby="add-title">
    <div class="add-head">
      <h2 id="add-title" class="sub">Add courses</h2>
      <span class="muted small">Drag onto a requirement, or click one and pick a spot. It only drops where it fits.</span>
    </div>
    <CourseSearch onCustom={() => customDialog.open()} />
  </section>

  {#if app.moving}
    <div class="banner" role="status">
      <span class="banner-title">{app.moving.uid ? 'Moving' : 'Placing'} <span class="mono">{app.moving.course.code}</span></span>
      <span class="banner-sub">Fits {targetSummary.count} open {targetSummary.count === 1 ? 'spot' : 'spots'} in {targetSummary.areas}</span>
      <button class="btn cancel" onclick={() => app.cancelMove()}>Cancel</button>
    </div>
  {/if}

  <h2 class="sub">Requirements</h2>
  <div class="grid">
    {#each columns as column, i (i)}
      <div class="col">
        {#each column as result (result.section.id)}
          <SectionCard {result} />
        {/each}
      </div>
    {/each}
  </div>
  <p class="foot muted">
    No course may be used twice; moving a course frees its old spot. Core, CS electives, project, probability,
    technical electives and external specialization need a letter grade of C- or better once affiliated.
  </p>
</div>

<CustomCourseDialog bind:this={customDialog} />
<datalist id="bearplan-grades">
  {#each GRADES as grade (grade)}<option value={grade}></option>{/each}
</datalist>

<style>
  .view {
    display: flex;
    flex-direction: column;
    gap: 20px;
    min-width: 0;
  }
  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
  }
  .titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .actions {
    display: flex;
    gap: 8px;
  }
  .errors {
    margin: 0;
    padding: 10px 14px 10px 28px;
    border-radius: 12px;
    background: var(--warn-bg);
    color: var(--warn-ink);
    font-size: 13px;
  }
  .filters {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }
  .pill {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 6px 14px 6px 8px;
    font: 600 13px var(--sans);
    background: var(--card);
    cursor: pointer;
    min-height: 44px;
  }
  .pill .ic {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    background: var(--tint);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .pill.on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .pill.on .ic {
    background: rgba(255, 255, 255, 0.18);
    color: var(--on-accent);
  }
  .count {
    font-size: 11px;
    opacity: 0.75;
  }
  .add {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .add-head {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .small {
    font-size: 12px;
  }
  .banner {
    position: sticky;
    top: 12px;
    z-index: 2;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px 16px;
    background: var(--accent);
    color: var(--on-accent);
    border-radius: 999px;
    padding: 8px 8px 8px 20px;
    box-shadow: var(--shadow);
  }
  .banner-title {
    font-weight: 600;
  }
  .banner-sub {
    font-size: 13px;
    opacity: 0.85;
  }
  .cancel {
    margin-left: auto;
    background: var(--on-accent);
    color: var(--accent);
    border: 0;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 16px;
    align-items: start;
    margin-top: -6px;
  }
  .col {
    display: flex;
    flex-direction: column;
    gap: 16px;
    min-width: 0;
  }
  .foot {
    margin: 0;
    font-size: 12px;
    max-width: 720px;
  }
  @media (max-width: 860px) {
    .grid {
      grid-template-columns: minmax(0, 1fr);
    }
    .banner {
      border-radius: 16px;
    }
  }
</style>
