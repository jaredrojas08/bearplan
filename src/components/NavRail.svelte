<script lang="ts" module>
  export type View = 'requirements' | 'semesters'
</script>

<script lang="ts">
  import { app } from '../lib/store.svelte'
  import Icon from './Icon.svelte'

  let { view = $bindable(), onSettings }: { view: View; onSettings: () => void } = $props()

  let initials = $derived(
    (app.plan?.name ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0].toUpperCase())
      .slice(0, 2)
      .join(''),
  )
</script>

<nav aria-label="Main">
  <div class="logo" role="img" aria-label="BearPlan">
    <svg width="26" height="26" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path d="M16 8H24a3.5 3.5 0 0 0 3 6a3.5 3.5 0 0 0 5 4a3.5 3.5 0 0 0 6 3V38a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
      <path d="M21 19q5 1 9 5" /><path d="M22 25q4.5 1 8 5" /><path d="M23 31q4 1 7 4" />
      <path d="M32 22V42" /><path d="M19 42V47l2.5-2 2.5 2V42" />
      <g transform="rotate(-32 13 20)">
        <rect x="10" y="4" width="6" height="22" rx="1.5" fill="var(--accent)" />
        <path d="M10 26l3 5 3-5" fill="var(--accent)" />
      </g>
    </svg>
  </div>
  <button class="icon-btn" class:on={view === 'requirements'} aria-label="Requirements" aria-current={view === 'requirements' ? 'page' : undefined} onclick={() => (view = 'requirements')}>
    <Icon name="home" size={20} />
  </button>
  <button class="icon-btn" class:on={view === 'semesters'} aria-label="Semesters" aria-current={view === 'semesters' ? 'page' : undefined} onclick={() => (view = 'semesters')}>
    <Icon name="calendar" size={20} />
  </button>
  <div class="spacer"></div>
  <button class="icon-btn" aria-label={app.dark ? 'Switch to light mode' : 'Switch to dark mode'} onclick={() => app.toggleDark()}>
    <Icon name={app.dark ? 'sun' : 'moon'} size={18} />
  </button>
  <button class="icon-btn" aria-label="Plan settings, import and export" onclick={onSettings}>
    <Icon name="settings" size={20} />
  </button>
  {#if initials}<div class="avatar" aria-hidden="true">{initials}</div>{/if}
</nav>

<style>
  nav {
    position: sticky;
    top: 20px;
    flex: 0 0 72px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 18px 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    min-height: calc(100vh - 40px);
  }
  .logo {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    background: var(--accent);
    color: var(--on-accent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 24px;
  }
  .spacer {
    flex: 1;
  }
  .avatar {
    width: 40px;
    height: 40px;
    border-radius: 999px;
    background: var(--tint);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 13px;
  }
  @media (max-width: 640px) {
    nav {
      position: static;
      flex: 1 1 100%;
      flex-direction: row;
      min-height: 0;
      padding: 8px 12px;
      gap: 6px;
    }
    .logo {
      margin: 0 12px 0 0;
    }
    /* The initials repeat the progress panel's name card, and the row has to fit 320px. */
    .avatar {
      display: none;
    }
  }
</style>
