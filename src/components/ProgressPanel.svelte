<script lang="ts">
  import { app } from '../lib/store.svelte'
  import Icon from './Icon.svelte'
  import ProgressBar from './ProgressBar.svelte'

  let { onEdit }: { onEdit?: () => void } = $props()

  let summary = $derived(app.summary!)
  let plan = $derived(app.plan!)
  let total = $derived(summary.totalUnits || 1)
  let pctDone = $derived(Math.round((100 * summary.counts.done) / total))
  let pctWithProg = $derived(Math.round((100 * (summary.counts.done + summary.counts.prog)) / total))
  let initials = $derived(
    plan.name.split(/\s+/).filter(Boolean).map((p) => p[0].toUpperCase()).slice(0, 2).join(''),
  )

  // Bars scale to the heaviest term, with a floor so light terms stay readable.
  let maxCredits = $derived(Math.max(20, ...summary.terms.map((t) => t.credits)))
  let chartLabel = $derived(summary.terms.map((t) => `${t.term} ${t.credits} cr`).join(', '))

  const LEGEND = [
    ['done', 'Completed'],
    ['prog', 'In progress'],
    ['plan', 'Planned'],
    ['empty', 'Empty'],
  ] as const
</script>

<aside class="panel" aria-label="Your progress">
  <div class="who">
    <div class="initials" aria-hidden="true">{initials}</div>
    <div class="who-text">
      <span class="name">{plan.name}</span>
      <span class="muted small">Entered {plan.entryTerm} · Graduating {plan.gradTerm}</span>
    </div>
    {#if onEdit}
      <button class="icon-btn" aria-label="Edit plan details" onclick={onEdit}><Icon name="pen" size={18} /></button>
    {/if}
  </div>

  <div class="card stack">
    <div class="between">
      <span class="muted small">Degree progress</span>
      <span class="chip incl">{pctWithProg}% incl. this term</span>
    </div>
    <span class="big">{pctDone}%</span>
    <ProgressBar counts={summary.counts} />
    <div class="legend">
      {#each LEGEND as [key, label] (key)}
        <span><span class="dot {key}"></span>{label}<b class="mono">{summary.counts[key]}</b></span>
      {/each}
    </div>
  </div>

  <div class="card stack">
    <div class="between">
      <span class="muted small">Credits per term</span>
      <span class="mono small">{summary.credits.total}{summary.credits.required ? ` / ${summary.credits.required}` : ''} cr</span>
    </div>
    <div class="chart" role="img" aria-label={chartLabel}>
      {#each summary.terms as t (t.term)}
        <div class="term-col">
          <span class="mono tiny">{t.credits || ''}</span>
          <div
            class="term-bar {t.status}"
            class:none={!t.credits}
            style:height="{t.credits ? Math.round((t.credits / maxCredits) * 80) : 12}px"
          ></div>
          <span class="mono tiny">{t.term}</span>
        </div>
      {/each}
    </div>
    <span class="muted tiny-text">
      {summary.credits.done} done · {summary.credits.prog} this term · {summary.credits.plan} planned.
      {app.template?.totalCreditsNote ?? 'Confirm the credit total with your advisor.'}
    </span>
  </div>

  <div class="between">
    <h2 class="sub">What's left</h2>
    <span class="muted small">{summary.counts.empty} open</span>
  </div>
  {#if summary.whatsLeft.length}
    <ul class="left">
      {#each summary.whatsLeft as item (item.sectionId)}
        <li>
          <span class="swatch" aria-hidden="true"></span>
          <span class="left-text">
            {item.label}{item.creditsToGo ? ` (${item.creditsToGo} cr)` : ''}
            {#if item.needs.length}<span class="muted tiny-text">Needs {item.needs.join(' · ')}</span>{/if}
          </span>
          {#if item.open && !item.creditsToGo}<span class="mono muted small">×{item.open}</span>{/if}
        </li>
      {/each}
    </ul>
  {:else}
    <p class="muted small">Every requirement is filled. Confirm with your advisor.</p>
  {/if}

  <h2 class="sub">Plan-wide checks</h2>
  {#each summary.checks as check (check.check.id)}
    <div class="check" class:met={check.met}>
      {#if check.met}<Icon name="check" size={16} stroke={2.5} />{/if}
      <span><b>{check.check.title}</b> {check.text}</span>
    </div>
  {/each}
</aside>

<style>
  .panel {
    flex: 1 1 300px;
    max-width: 340px;
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .who {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .initials {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--tint);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex: none;
  }
  .who-text {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
  }
  .name {
    font-size: 15px;
    font-weight: 700;
  }
  .stack {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .between {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
  }
  .small {
    font-size: 12px;
  }
  .tiny {
    font-size: 10px;
    color: var(--muted);
  }
  .tiny-text {
    font-size: 11px;
    display: block;
  }
  .incl {
    background: var(--tint);
    color: var(--ink);
  }
  .big {
    font-size: 34px;
    font-weight: 600;
    line-height: 1;
  }
  .legend {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 6px 12px;
    font-size: 12px;
  }
  .legend > span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend b {
    margin-left: auto;
  }
  .chart {
    display: flex;
    align-items: flex-end;
    gap: 6px;
    height: 120px;
  }
  .term-col {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 4px;
  }
  .term-bar {
    width: 100%;
    border-radius: 8px;
  }
  .term-bar.done {
    background: var(--done);
  }
  .term-bar.prog {
    background: var(--prog);
    box-shadow: 0 0 0 2px var(--ink);
  }
  .term-bar.plan {
    background: var(--plan);
  }
  .term-bar.none {
    background: transparent;
    border: 1.5px dashed var(--line);
  }
  .left {
    margin: 0;
    padding: 0;
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .left li {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--bg);
    border-radius: 14px;
    padding: 9px 12px;
    font-size: 13px;
  }
  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 3px;
    flex: none;
    background: var(--accent);
  }
  .left-text {
    flex: 1;
    min-width: 0;
  }
  .check {
    display: flex;
    align-items: center;
    gap: 10px;
    border-radius: 14px;
    padding: 10px 12px;
    font-size: 13px;
    background: var(--bg);
  }
  .check.met {
    background: var(--tint);
  }
  .check :global(svg) {
    flex: none;
    color: var(--done);
  }
  @media (max-width: 1100px) {
    .panel {
      max-width: none;
    }
  }
</style>
