<script lang="ts">
  import NavRail, { type View } from './components/NavRail.svelte'
  import ProgressPanel from './components/ProgressPanel.svelte'
  import RequirementsView from './components/RequirementsView.svelte'
  import SemesterView from './components/SemesterView.svelte'
  import { app } from './lib/store.svelte'

  let view = $state<View>('requirements')
</script>

<div class="shell">
  <NavRail bind:view />
  <main>
    {#if app.saveError}<p class="save-error" role="alert">{app.saveError}</p>{/if}
    {#if app.summary}
      {#if view === 'requirements'}
        <RequirementsView />
      {:else}
        <SemesterView />
      {/if}
    {/if}
  </main>
  {#if app.summary && view === 'requirements'}
    <ProgressPanel />
  {/if}
</div>

<style>
  .shell {
    display: flex;
    flex-wrap: wrap;
    gap: 20px;
    padding: 20px;
    align-items: flex-start;
  }
  main {
    flex: 999 1 640px;
    min-width: 0;
    padding: 12px 8px;
  }
  .save-error {
    margin: 0 0 16px;
    padding: 10px 14px;
    border-radius: 12px;
    background: var(--warn-bg);
    color: var(--warn-ink);
  }
  @media (max-width: 640px) {
    .shell {
      padding: 12px 16px;
      gap: 12px;
    }
    main {
      padding: 0;
    }
  }
</style>
