<script lang="ts">
  import { searchCourses } from '../lib/search'
  import { app } from '../lib/store.svelte'
  import type { CatalogCourse } from '../types'
  import Icon from './Icon.svelte'

  let { onCustom }: { onCustom: () => void } = $props()

  let query = $state('')
  let results = $derived(app.catalog ? searchCourses(app.catalog, query, 6) : [])
  let inPlan = $derived(new Set(app.plan?.courses.map((c) => c.code) ?? []))

  // Variable-credit courses (research, 1 to 4) default to the max; the Cr cell is editable.
  const toNewCourse = (c: CatalogCourse) => ({
    code: c.code,
    title: c.title,
    credits: c.creditsMax,
    distributions: c.distributions,
  })

  const creditText = (c: CatalogCourse) => (c.creditsMin === c.creditsMax ? `${c.creditsMax} cr` : `${c.creditsMin}–${c.creditsMax} cr`)

  function onDragStart(event: DragEvent, course: CatalogCourse) {
    app.startPlacing(toNewCourse(course))
    event.dataTransfer?.setData('text/plain', course.code)
    if (event.dataTransfer) event.dataTransfer.effectAllowed = 'copy'
  }

  // Only cancel when the drop didn't land; a successful place() already cleared it.
  function onDragEnd(course: CatalogCourse) {
    if (app.moving && !app.moving.uid && app.moving.course.code === course.code) app.cancelMove()
  }
</script>

<div class="results">
  <label class="search">
    <Icon name="search" size={18} stroke={2} />
    <span class="visually-hidden">Search courses by code or title</span>
    <input
      type="search"
      class="mono"
      placeholder={app.catalog ? 'CS 4410, algorithms…' : 'Loading courses…'}
      disabled={!app.catalog}
      bind:value={query}
    />
  </label>
  {#each results as course (course.code)}
    <button
      class="result"
      draggable="true"
      title="{course.title}. Click, then pick a requirement, or drag it onto one."
      onclick={() => app.startPlacing(toNewCourse(course))}
      ondragstart={(e) => onDragStart(e, course)}
      ondragend={() => onDragEnd(course)}
    >
      <span class="result-top">
        <b class="mono">{course.code}</b>
        <span class="score">{creditText(course)}</span>
      </span>
      <span class="result-title">{course.title}</span>
      <span class="muted tiny">
        {course.rosters.join(' · ')}{inPlan.has(course.code) ? ' · in your plan' : ''}
      </span>
    </button>
  {/each}
  {#if query.trim() && app.catalog && results.length === 0}
    <span class="muted empty">No match in the cached catalog.</span>
  {/if}
  <button class="custom" onclick={onCustom}>+ Custom course</button>
</div>
{#if app.catalogError}<p class="muted tiny">{app.catalogError}</p>{/if}

<style>
  .results {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: stretch;
  }
  .search {
    flex: 1 1 220px;
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 999px;
    padding: 0 16px;
    min-height: 48px;
    color: var(--muted);
    align-self: flex-start;
  }
  .search:focus-within {
    border-color: var(--accent);
  }
  .search input {
    flex: 1;
    min-width: 0;
    border: 0;
    background: transparent;
    font: 500 15px var(--mono);
    color: var(--ink);
    outline: none;
  }
  .result {
    flex: 1 1 170px;
    max-width: 260px;
    background: var(--tint);
    border: 1px solid var(--line);
    border-radius: 14px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    cursor: grab;
    text-align: left;
    min-width: 0;
  }
  .result:hover {
    border-color: var(--accent);
  }
  .result-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
  }
  .result-top b {
    font-size: 13px;
  }
  .result-title {
    font-size: 14px;
    font-weight: 500;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tiny {
    font-size: 11px;
    margin: 0;
  }
  .empty {
    align-self: center;
    font-size: 13px;
  }
  .custom {
    flex: 0 1 140px;
    min-height: 76px;
    border-radius: 14px;
    background: transparent;
    border: 1.5px dashed var(--line);
    color: var(--muted);
    font: 600 13px var(--sans);
    cursor: pointer;
  }
  .custom:hover {
    border-color: var(--accent);
    color: var(--accent);
  }
</style>
