<script lang="ts">
  import { readFile } from '../lib/files'
  import { app, type PlanDetails } from '../lib/store.svelte'
  import Icon from './Icon.svelte'
  import PlanForm from './PlanForm.svelte'

  let dialog: HTMLDialogElement
  let formKey = $state(0)
  let templateInput: HTMLInputElement
  let message = $state('')

  export function open() {
    message = ''
    formKey += 1
    dialog.showModal()
  }

  function save(details: PlanDetails) {
    const orphaned = app.plan && details.templateId !== app.plan.templateId && app.plan.courses.length > 0
    if (orphaned && !confirm('Switching checklists moves courses that no longer fit into Additional Space. Continue?')) return
    app.updateDetails(details)
    dialog.close()
  }

  async function onTemplateFile(event: Event) {
    const file = await readFile(event)
    if (!file) return
    if ('error' in file) {
      message = file.error
      return
    }
    const { errors, template } = app.importTemplate(file.text)
    message = template ? `Added "${template.name}". Pick it above to switch.` : errors.slice(0, 4).join(' ')
  }

  function startOver() {
    if (!confirm('Delete this plan from this browser? Export it first if you want to keep it.')) return
    app.resetPlan()
    dialog.close()
  }
</script>

<dialog bind:this={dialog} aria-labelledby="settings-title">
  <div class="head">
    <h2 id="settings-title" class="sub">Plan details</h2>
    <button class="icon-btn" aria-label="Close" onclick={() => dialog.close()}><Icon name="close" size={18} /></button>
  </div>
  {#if app.plan}
    {#key formKey}
      <PlanForm
        initial={{ name: app.plan.name, templateId: app.plan.templateId, entryTerm: app.plan.entryTerm, gradTerm: app.plan.gradTerm }}
        submitLabel="Save"
        onSubmit={save}
      />
    {/key}
  {/if}
  <hr />
  <div class="tools">
    <button class="btn" onclick={() => templateInput.click()}><Icon name="upload" /> Import requirement template</button>
    <button class="btn" onclick={() => app.exportPlan()}><Icon name="download" /> Export plan</button>
    <button class="btn danger" onclick={startOver}>Start over</button>
  </div>
  {#if message}<p class="muted msg" role="status">{message}</p>{/if}
  <input bind:this={templateInput} type="file" accept="application/json,.json" hidden onchange={onTemplateFile} />
</dialog>

<style>
  dialog {
    border: 1px solid var(--line);
    border-radius: 20px;
    background: var(--card);
    color: var(--ink);
    padding: 24px;
    width: min(500px, calc(100vw - 32px));
  }
  dialog::backdrop {
    background: rgba(20, 16, 18, 0.45);
  }
  .head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
  }
  hr {
    border: 0;
    border-top: 1px solid var(--line);
    margin: 20px 0;
  }
  .tools {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .tools .btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }
  .danger {
    color: var(--warn);
  }
  .msg {
    font-size: 13px;
    margin: 12px 0 0;
  }
</style>
