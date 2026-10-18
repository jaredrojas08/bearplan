<script lang="ts">
  import { termStatus } from '../lib/terms'
  import { app } from '../lib/store.svelte'
  import type { PlanCourse } from '../types'
  import Icon from './Icon.svelte'

  let { course, label = '', hint = '' }: { course: PlanCourse; label?: string; hint?: string } = $props()

  const STATUS_LABEL = { done: 'Completed', prog: 'In progress', plan: 'Planned' }

  let status = $derived(termStatus(course.term, app.today))
  let warnings = $derived(app.summary?.warnings[course.uid] ?? [])
  let isMoving = $derived(app.moving?.uid === course.uid)
  // Keep an imported out-of-range term selectable instead of silently changing it.
  let termOptions = $derived(app.terms.includes(course.term) ? app.terms : [course.term, ...app.terms])

  function onDragStart(event: DragEvent) {
    app.startMove(course.uid)
    event.dataTransfer?.setData('text/plain', course.code)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
  }
</script>

<div class="row" class:moving={isMoving}>
  <span class="course">
    <button
      class="grip"
      class:on={isMoving}
      draggable="true"
      aria-label={isMoving ? `Cancel moving ${course.code}` : `Move ${course.code}`}
      aria-pressed={isMoving}
      onclick={() => app.startMove(course.uid)}
      ondragstart={onDragStart}
      ondragend={() => app.cancelMove()}
    >
      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor" aria-hidden="true">
        <circle cx="2.5" cy="2.5" r="1.4" /><circle cx="7.5" cy="2.5" r="1.4" />
        <circle cx="2.5" cy="7" r="1.4" /><circle cx="7.5" cy="7" r="1.4" />
        <circle cx="2.5" cy="11.5" r="1.4" /><circle cx="7.5" cy="11.5" r="1.4" />
      </svg>
    </button>
    <span class="dot {status}" title={STATUS_LABEL[status]}></span>
    <span class="visually-hidden">{STATUS_LABEL[status]}:</span>
    <b class="mono code" title={course.title}>{course.code}</b>
    {#if label}<span class="label">{label}</span>{/if}
    {#each warnings as warning (warning)}<span class="warn-badge">{warning}</span>{/each}
  </span>
  <input
    class="cell mono"
    type="number"
    min="0"
    max="30"
    step="0.5"
    aria-label="Credits for {course.code}"
    value={course.credits}
    onchange={(e) => {
      const credits = Number(e.currentTarget.value)
      if (credits >= 0 && credits <= 30) app.updateCourse(course.uid, { credits })
    }}
  />
  <select
    class="sem"
    aria-label="Semester for {course.code}"
    value={course.term}
    onchange={(e) => app.updateCourse(course.uid, { term: e.currentTarget.value })}
  >
    {#each termOptions as term (term)}<option value={term}>{term}</option>{/each}
  </select>
  <input
    class="cell mono grade"
    list="bearplan-grades"
    aria-label="Grade for {course.code}"
    placeholder="—"
    maxlength="3"
    value={course.grade ?? ''}
    onchange={(e) => app.updateCourse(course.uid, { grade: e.currentTarget.value.trim().toUpperCase() || undefined })}
  />
  <span class="notes">
    <input
      class="cell note"
      aria-label="Advising notes for {course.code}"
      placeholder={hint}
      value={course.note ?? ''}
      onchange={(e) => app.updateCourse(course.uid, { note: e.currentTarget.value || undefined })}
    />
    <button class="remove" aria-label="Remove {course.code}" onclick={() => app.removeCourse(course.uid)}>
      <Icon name="close" size={12} stroke={2.4} />
    </button>
  </span>
</div>

<style>
  .row.moving {
    box-shadow: inset 0 0 0 2px var(--accent);
    border-radius: 12px;
  }
  .course {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    flex-wrap: wrap;
  }
  .code {
    font-weight: 500;
    white-space: nowrap;
  }
  .label {
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .grip {
    flex: none;
    width: 22px;
    height: 26px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: 0;
    border-radius: 8px;
    background: transparent;
    color: var(--muted);
    cursor: grab;
    padding: 0;
  }
  .grip:hover {
    background: var(--tint);
  }
  .grip.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .cell {
    width: 100%;
    min-width: 0;
    border: 1px solid transparent;
    background: transparent;
    border-radius: 6px;
    padding: 2px 4px;
    font-size: 13px;
  }
  .cell:hover,
  .cell:focus {
    border-color: var(--line);
    background: var(--card);
  }
  input[type='number'] {
    appearance: textfield;
  }
  input[type='number']::-webkit-inner-spin-button {
    display: none;
  }
  .grade {
    font-weight: 500;
  }
  .note {
    font-size: 11px;
    color: var(--muted);
  }
  .sem {
    font: 500 12px var(--mono);
    color: var(--accent-ink);
    background: var(--tint);
    border: 0;
    border-radius: 999px;
    padding: 4px 6px;
    cursor: pointer;
    width: 100%;
    appearance: none;
    text-align: center;
  }
  .notes {
    display: flex;
    align-items: center;
    gap: 2px;
    min-width: 0;
  }
  .remove {
    flex: none;
    width: 22px;
    height: 22px;
    border: 0;
    border-radius: 6px;
    background: transparent;
    color: var(--muted);
    cursor: pointer;
    opacity: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .row:hover .remove,
  .remove:focus-visible {
    opacity: 1;
  }
  .remove:hover {
    background: var(--tint);
    color: var(--accent);
  }
</style>
