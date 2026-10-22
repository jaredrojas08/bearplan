<script lang="ts">
  import type { SectionResult } from '../lib/requirements'
  import { app } from '../lib/store.svelte'
  import { ADDITIONAL, type PlanCourse } from '../types'
  import CourseRow from './CourseRow.svelte'
  import DropRow from './DropRow.svelte'
  import Icon from './Icon.svelte'

  let { result }: { result: SectionResult } = $props()

  let section = $derived(result.section)
  let isExtra = $derived(section.id === ADDITIONAL)
  let holdsMoving = $derived(result.courses.some((c) => c.uid === app.moving?.uid))
  let hasTarget = $derived(
    app.targets !== null &&
      [...app.targets].some(([p, failure]) => failure === null && (p === section.id || p.startsWith(`${section.id}/`))),
  )
  let dim = $derived(app.moving !== null && !hasTarget && !holdsMoving)

  let summary = $derived.by(() => {
    if (isExtra) return `${result.credits} cr`
    if (section.type === 'creditBucket') return `${result.credits} / ${result.total} cr`
    return `${result.filled} / ${result.total}`
  })

  function bucketLabel(): string {
    if (isExtra) return 'extra course'
    return result.creditsToGo > 0 ? `add course · ${result.creditsToGo} cr to go` : 'add course'
  }

  // Shows the slot label beside the code only when it adds information, like "D2 EngrD".
  function slotLabel(label: string, course: PlanCourse): string {
    const number = course.code.split(' ')[1] ?? ''
    if (/^[A-Z]+ \d$/i.test(label) || label.includes(number) || label.includes(' or ')) return ''
    return label.includes(' ') ? label : ''
  }
</script>

<section class="sec" class:dim aria-labelledby="sec-{section.id}">
  <div class="head">
    <span class="icchip"><Icon name={section.icon ?? 'star'} /></span>
    <h3 id="sec-{section.id}">{section.title}</h3>
    <span class="score">
      {#if result.complete && !isExtra}<span class="done-mark"><Icon name="check" size={12} stroke={3} /></span>{/if}
      {summary}
    </span>
  </div>

  {#if section.note}<p class="note">{section.note}</p>{/if}

  {#if result.chips.length}
    <div class="chips">
      {#each result.chips as chip (chip.label)}
        <span class="chip" class:ok={chip.ok && !chip.limit} class:over={chip.limit && !chip.ok}>{chip.label} {chip.text}</span>
      {/each}
    </div>
  {/if}

  {#if section.spcl && app.plan}
    <label class="spcl">
      <span>SPCL</span>
      <input type="text" placeholder="Area name, e.g. Digital Cultures" bind:value={app.plan.spclArea} />
    </label>
  {/if}

  {#if section.swimTest && app.plan}
    <label class="tbl swim">
      <input type="checkbox" bind:checked={app.plan.swimTest} />
      University swim test passed
    </label>
  {/if}

  <div class="tbl">
    <div class="row head" aria-hidden="true"><span>Course</span><span>Cr</span><span>Sem</span><span>Grade</span><span>Notes</span></div>
    {#if section.type === 'slots'}
      {#each result.rows as row, i (row.slot.id)}
        {#if row.slot.option && row.slot.option !== result.rows[i - 1]?.slot.option}
          <div class="option-label">{result.rows.findIndex((r) => r.slot.option) === i ? '' : 'or '}{row.slot.option}</div>
        {/if}
        {#if row.course}
          <CourseRow course={row.course} label={slotLabel(row.slot.label, row.course)} hint={result.groupOf[row.course.uid] ?? ''} />
        {:else}
          <DropRow placement="{section.id}/{row.slot.id}" label={row.slot.label} />
        {/if}
      {/each}
    {:else}
      {#each result.courses as course (course.uid)}
        <CourseRow {course} />
      {/each}
      {#if app.moving && holdsMoving}
        <div class="row"><span class="here">currently here</span></div>
      {:else if app.moving || result.creditsToGo > 0 || (isExtra && result.courses.length === 0)}
        <DropRow placement={section.id} label={bucketLabel()} />
      {/if}
    {/if}
  </div>
</section>

<style>
  .sec {
    border-radius: 16px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    transition: opacity 0.15s;
    background: var(--card);
    border: 1px solid var(--line);
    min-width: 0;
  }
  .option-label {
    padding: 6px 10px 2px;
    font-size: 12px;
    font-weight: 600;
    color: var(--muted);
  }
  .sec.dim {
    opacity: 0.55;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .icchip {
    width: 30px;
    height: 30px;
    border-radius: 9px;
    background: var(--tint);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  h3 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
    flex: 1;
    min-width: 0;
  }
  .done-mark {
    color: var(--done);
    display: inline-flex;
  }
  .chip.over {
    color: var(--warn-ink);
    border-color: var(--warn);
    background: var(--warn-bg);
  }
  .note {
    margin: 0;
    font-size: 12px;
    color: var(--muted);
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .spcl {
    display: flex;
    align-items: center;
    gap: 8px;
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 4px 14px;
    font-size: 12px;
  }
  .spcl span {
    font-weight: 700;
    letter-spacing: 0.08em;
  }
  .spcl input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    padding: 4px 0;
    outline: none;
  }
  .swim {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    font-size: 13px;
  }
  .swim input {
    width: 18px;
    height: 18px;
    accent-color: var(--accent);
  }
  .here {
    grid-column: span 5;
    font-size: 12px;
    color: var(--muted);
    font-style: italic;
  }
</style>
