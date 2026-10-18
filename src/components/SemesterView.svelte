<script lang="ts">
  import { app } from '../lib/store.svelte'
  import ProgressBar from './ProgressBar.svelte'

  const STATUS_TAG = { done: 'Done', prog: 'Now', plan: 'Planned' }

  let summary = $derived(app.summary!)
  let dragging = $state<{ uid: string; code: string } | null>(null)
  let hotTerm = $state<string | null>(null)
  let pctDone = $derived(Math.round((100 * summary.counts.done) / (summary.totalUnits || 1)))

  function onDrop(event: DragEvent, term: string) {
    event.preventDefault()
    if (dragging) app.updateCourse(dragging.uid, { term })
    dragging = null
    hotTerm = null
  }
</script>

<div class="view">
  <header class="top">
    <div class="titles">
      <span class="eyebrow">{app.plan?.entryTerm} → {app.plan?.gradTerm}</span>
      <h1 class="title">Semester plan</h1>
    </div>
    <div class="pill">
      <span class="mono pct">{pctDone}%</span>
      <div class="pill-bar"><ProgressBar counts={summary.counts} height={10} /></div>
      <span class="muted"><b class="mono ink">{summary.credits.total}</b> cr scheduled</span>
    </div>
  </header>
  <p class="muted intro">
    Drag a course to another term to change its semester. Its status follows today's date. The Sem picker on the
    Requirements page does the same from the keyboard.
  </p>

  <div class="scroller">
    <div class="terms" style:--count={summary.terms.length}>
      {#each summary.terms as t (t.term)}
        <section
          class="term {t.status}"
          aria-labelledby="term-{t.term}"
          ondragover={(e) => {
            if (!dragging) return
            e.preventDefault()
            hotTerm = t.term
          }}
          ondragleave={() => (hotTerm = null)}
          ondrop={(e) => onDrop(e, t.term)}
        >
          <div class="term-head">
            <h2 id="term-{t.term}" class="mono">{t.term}</h2>
            <span class="tag"><span class="dot {t.status}"></span>{STATUS_TAG[t.status]}</span>
          </div>
          <span class="muted small"><b class="mono ink">{t.credits}</b> cr · {t.courses.length} {t.courses.length === 1 ? 'course' : 'courses'}</span>
          {#each t.courses as course (course.uid)}
            <div
              class="chip-card"
              class:lift={dragging?.uid === course.uid}
              draggable="true"
              role="listitem"
              aria-label="{course.code}, {course.credits} credits, counts toward {app.placementLabel(course.placement)}"
              ondragstart={(e) => {
                dragging = { uid: course.uid, code: course.code }
                e.dataTransfer?.setData('text/plain', course.code)
              }}
              ondragend={() => {
                dragging = null
                hotTerm = null
              }}
            >
              <div class="chip-top">
                <b class="mono">{course.code}</b><span class="mono muted">{course.credits} cr</span>
              </div>
              <span class="muted tiny">{app.placementLabel(course.placement)}</span>
            </div>
          {/each}
          {#if dragging && hotTerm === t.term}
            <div class="dropz hot">Release to move {dragging.code} here</div>
          {:else if t.courses.length === 0 || dragging}
            <div class="dropz">Drop courses here</div>
          {/if}
        </section>
      {/each}
    </div>
  </div>
</div>

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
  .pill {
    display: flex;
    align-items: center;
    gap: 12px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 8px 16px 8px 8px;
    font-size: 13px;
  }
  .pct {
    padding: 8px 12px;
    font-weight: 600;
  }
  .pill-bar {
    width: 180px;
  }
  .ink {
    color: var(--ink);
  }
  .intro {
    margin: -8px 0 0;
  }
  .scroller {
    overflow-x: auto;
    padding: 4px 2px 20px;
  }
  .terms {
    display: grid;
    grid-template-columns: repeat(var(--count), minmax(150px, 1fr));
    gap: 12px;
    min-width: calc(var(--count) * 155px);
    align-items: start;
  }
  .term {
    border-radius: 16px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    background: var(--card);
    border: 1px solid var(--line);
    min-height: 200px;
  }
  .term.prog {
    border: 2px solid var(--accent);
    box-shadow: 0 8px 24px rgba(200, 16, 46, 0.12);
  }
  .term.plan {
    background: transparent;
    border-style: dashed;
  }
  .term-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  h2 {
    margin: 0;
    font-size: 18px;
    font-weight: 500;
  }
  .tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: var(--tint);
    color: var(--accent-ink);
    border-radius: 999px;
    padding: 3px 9px;
    font-size: 11px;
    font-weight: 600;
  }
  .small {
    font-size: 12px;
  }
  .tiny {
    font-size: 11px;
  }
  .chip-card {
    background: var(--bg);
    border: 1px solid var(--line);
    border-radius: 12px;
    padding: 9px 11px;
    display: flex;
    flex-direction: column;
    gap: 3px;
    cursor: grab;
  }
  .chip-card.lift {
    box-shadow: 0 12px 28px rgba(0, 0, 0, 0.2);
    transform: rotate(-2deg);
  }
  .chip-top {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 13px;
  }
  .chip-top b {
    font-weight: 500;
  }
  .chip-top > * {
    white-space: nowrap;
  }
  .dropz {
    border: 1.5px dashed var(--muted);
    border-radius: 14px;
    color: var(--muted);
    font-size: 12px;
    padding: 16px 8px;
    text-align: center;
    opacity: 0.8;
  }
  .dropz.hot {
    border: 0;
    background: var(--accent);
    color: var(--on-accent);
    opacity: 1;
    font-weight: 600;
  }
</style>
