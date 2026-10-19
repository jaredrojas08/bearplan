<script lang="ts">
  import { readFile } from '../lib/files'
  import { app } from '../lib/store.svelte'
  import PlanForm from './PlanForm.svelte'

  let planInput: HTMLInputElement
  let importErrors = $state<string[]>([])

  async function onPlanFile(event: Event) {
    const file = await readFile(event)
    if (!file) return
    importErrors = 'error' in file ? [file.error] : app.importPlan(file.text)
  }
</script>

<div class="onboarding">
  <div class="hero">
    <div class="brand">
      <div class="logo" role="img" aria-label="BearPlan">
        <svg width="32" height="32" viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M16 8H24a3.5 3.5 0 0 0 3 6a3.5 3.5 0 0 0 5 4a3.5 3.5 0 0 0 6 3V38a4 4 0 0 1-4 4H16a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z" />
          <path d="M21 19q5 1 9 5" /><path d="M22 25q4.5 1 8 5" /><path d="M23 31q4 1 7 4" />
          <path d="M32 22V42" /><path d="M19 42V47l2.5-2 2.5 2V42" />
          <g transform="rotate(-32 13 20)">
            <rect x="10" y="4" width="6" height="22" rx="1.5" fill="#fff" />
            <path d="M10 26l3 5 3-5" fill="#fff" />
          </g>
        </svg>
      </div>
      <span class="wordmark">BearPlan</span>
    </div>
    <div class="pitch">
      <h1>See how close you are to graduating</h1>
      <p>
        Pick your major's checklist, add the courses you've taken, and the planner shows what's done, what's in
        progress and what's left.
      </p>
    </div>
    <div class="example" aria-hidden="true">
      <div class="example-row"><span>Example plan</span><span class="mono">54%</span></div>
      <div class="example-bar"><span style:width="54%" class="w"></span><span style:width="8%" class="o"></span></div>
    </div>
  </div>

  <div class="side">
    <div class="card-form" role="region" aria-labelledby="ob-title">
      <div class="titles">
        <span class="eyebrow">Get started</span>
        <h2 id="ob-title">Set up your plan</h2>
      </div>
      <PlanForm submitLabel="Create plan" onSubmit={(details) => app.createPlan(details)}>
        {#snippet secondary()}
          <span class="links">
            <button type="button" class="link" onclick={() => planInput.click()}>Import a saved plan</button>
            <button type="button" class="link" onclick={() => app.loadExample()}>Try the example plan</button>
          </span>
        {/snippet}
      </PlanForm>
      <input bind:this={planInput} type="file" accept="application/json,.json" hidden onchange={onPlanFile} />
      {#if importErrors.length}
        <ul class="errors" role="alert">
          {#each importErrors.slice(0, 5) as error (error)}<li>{error}</li>{/each}
        </ul>
      {/if}
    </div>
    <p class="privacy muted">Your plan stays in this browser. Nothing is sent to a server.</p>
  </div>
</div>

<style>
  .onboarding {
    min-height: 100vh;
    display: flex;
    flex-wrap: wrap;
  }
  .hero {
    flex: 0 1 560px;
    background: #c8102e;
    color: #fff;
    padding: 64px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 40px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .logo {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #fff;
    color: #c8102e;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .wordmark {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .pitch {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  h1 {
    margin: 0;
    font-size: 44px;
    font-weight: 700;
    line-height: 1.1;
    letter-spacing: -0.015em;
  }
  .pitch p {
    margin: 0;
    font-size: 16px;
    line-height: 1.55;
    color: #fad4da;
  }
  .example {
    display: flex;
    flex-direction: column;
    gap: 10px;
    background: rgba(255, 255, 255, 0.1);
    border-radius: 16px;
    padding: 18px;
    font-size: 13px;
  }
  .example-row {
    display: flex;
    justify-content: space-between;
  }
  .example-bar {
    display: flex;
    gap: 2px;
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.2);
  }
  .example-bar span {
    border-radius: 999px;
  }
  .w {
    background: #fff;
  }
  .o {
    background: #f29a2e;
  }
  .side {
    flex: 1 1 420px;
    /* Long checklist names in the select would otherwise set a minimum wider than a phone. */
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 14px;
    padding: 40px 16px;
  }
  .card-form {
    width: min(460px, 100%);
    background: var(--card);
    border: 1px solid var(--line);
    border-radius: 20px;
    padding: 32px;
    display: flex;
    flex-direction: column;
    gap: 18px;
    box-shadow: 0 20px 50px rgba(30, 26, 26, 0.08);
  }
  .titles {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  h2 {
    margin: 0;
    font-size: 24px;
    font-weight: 700;
  }
  .links {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent-ink);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    text-align: left;
    text-decoration: underline;
  }
  .errors {
    margin: 0;
    padding: 10px 14px 10px 28px;
    border-radius: 12px;
    background: var(--warn-bg);
    color: var(--warn-ink);
    font-size: 13px;
  }
  .privacy {
    font-size: 12px;
    margin: 0;
  }
  @media (max-width: 760px) {
    .hero {
      padding: 32px 20px;
      flex-basis: 100%;
    }
    h1 {
      font-size: 32px;
    }
    .card-form {
      padding: 20px;
    }
  }
</style>
