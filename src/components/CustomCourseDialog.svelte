<script lang="ts">
  import { app } from '../lib/store.svelte'

  let dialog: HTMLDialogElement
  let code = $state('')
  let credits = $state(3)
  let title = $state('')
  let categories = $state('')
  let error = $state('')

  export function open() {
    code = ''
    credits = 3
    title = ''
    categories = ''
    error = ''
    dialog.showModal()
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    const cleaned = code.trim().toUpperCase().split(/\s+/).join(' ')
    if (!/^[A-Z]{2,6} [0-9A-Z]{3,5}$/.test(cleaned)) {
      error = 'Use a code like "CS 4820" or "AP CHEM".'
      return
    }
    if (!(credits >= 0 && credits <= 30)) {
      error = 'Credits must be between 0 and 30.'
      return
    }
    app.startPlacing({
      code: cleaned,
      credits,
      title: title.trim() || 'Custom course',
      distributions: categories.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean),
    })
    dialog.close()
  }
</script>

<dialog bind:this={dialog} aria-labelledby="custom-title">
  <form onsubmit={submit}>
    <h2 id="custom-title" class="sub">Add a custom course</h2>
    <p class="muted">For transfer or AP credit, or a course missing from the catalog. Next, choose where it counts.</p>
    <label>Course code <input class="mono" bind:value={code} placeholder="CS 4820" required /></label>
    <label>Credits <input class="mono" type="number" min="0" max="30" step="0.5" bind:value={credits} required /></label>
    <label>Title <span class="muted">(optional)</span> <input bind:value={title} placeholder="AP Chemistry" /></label>
    <label>
      Distribution categories <span class="muted">(optional, comma separated)</span>
      <input class="mono" bind:value={categories} placeholder="SBA-AG, SSC-AS" />
    </label>
    {#if error}<p class="error" role="alert">{error}</p>{/if}
    <div class="actions">
      <button type="button" class="btn" onclick={() => dialog.close()}>Cancel</button>
      <button type="submit" class="btn primary">Choose a requirement</button>
    </div>
  </form>
</dialog>

<style>
  dialog {
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--card);
    color: var(--ink);
    padding: 24px;
    width: min(440px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: rgba(20, 16, 18, 0.45);
  }
  form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  p {
    margin: 0;
    font-size: 13px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
  }
  input {
    font-weight: 400;
    padding: 0 12px;
    min-height: 42px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--card);
  }
  .error {
    color: var(--warn);
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
</style>
