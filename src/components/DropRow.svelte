<script lang="ts">
  import { app } from '../lib/store.svelte'

  let { placement, label, note = '' }: { placement: string; label: string; note?: string } = $props()

  let failure = $derived(app.targets?.get(placement))
  let isTarget = $derived(app.targets !== null && failure === null)
  let hot = $state(false)

  function onDragOver(event: DragEvent) {
    if (!isTarget) return
    event.preventDefault()
    hot = true
  }

  function onDrop(event: DragEvent) {
    event.preventDefault()
    hot = false
    app.place(placement)
  }
</script>

<div class="row" role="group" aria-label={label} ondragover={onDragOver} ondragleave={() => (hot = false)} ondrop={onDrop}>
  <span class="span4">
    {#if isTarget}
      <button class="drop go" class:hot onclick={() => app.place(placement)}>
        {app.moving?.uid ? 'Move here' : 'Place here'} · {label}
      </button>
    {:else if app.targets && failure}
      <span class="drop no" title="Not allowed: {failure}">Not allowed: {failure}</span>
    {:else}
      <span class="drop">Drop a course · {label}</span>
    {/if}
  </span>
  <span class="note">{note}</span>
</div>

<style>
  .span4 {
    grid-column: span 4;
    min-width: 0;
  }
  .drop {
    display: block;
    border: 1.5px dashed var(--line);
    border-radius: 999px;
    color: var(--muted);
    font-size: 13px;
    padding: 4px 12px;
    width: 100%;
    text-align: left;
    background: transparent;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drop.go {
    border: 0;
    background: var(--accent);
    color: var(--on-accent);
    font-weight: 600;
    cursor: pointer;
    min-height: 28px;
  }
  .drop.go.hot {
    box-shadow: 0 0 0 3px var(--tint);
  }
  .drop.no {
    border-style: dotted;
    font-style: italic;
    font-size: 12px;
  }
  .note {
    font-size: 11px;
    color: var(--muted);
  }
</style>
