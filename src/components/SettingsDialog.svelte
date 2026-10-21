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
    if (!app.plan) return
    const switching = details.templateId !== app.plan.templateId && app.plan.courses.length > 0
    if (switching && !confirm('Switching checklists moves courses that no longer fit into Additional Space. Continue?')) return
    // Courses placed in a dropped concentration lose their spot.
    const dropped = (app.template?.concentrations ?? []).filter(
      (c) => app.plan!.concentrations?.includes(c.id) && !details.concentrations.includes(c.id),
    )
    const droppedIds = new Set(dropped.flatMap((c) => c.sections.map((s) => s.id)))
    // Minor sections carry the minor's id once merged into the template.
    const droppedMinors = (app.plan.minors ?? []).filter((id) => !details.minors.includes(id))
    const isDropped = (sectionId: string) =>
      droppedIds.has(sectionId) || droppedMinors.some((id) => app.template?.sections.find((s) => s.id === sectionId)?.minor === id)
    const names = [...dropped.map((c) => c.name), ...droppedMinors.map((id) => app.minors.find((m) => m.id === id)?.name ?? id)]
    const losing = !switching && app.plan.courses.some((c) => isDropped(c.placement.split('/')[0]))
    if (losing && !confirm(`Courses in ${names.join(' and ')} will move to Additional Space. Continue?`)) return
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
        initial={{
          name: app.plan.name,
          templateId: app.plan.templateId,
          entryTerm: app.plan.entryTerm,
          gradTerm: app.plan.gradTerm,
          concentrations: app.plan.concentrations ?? [],
          minors: app.plan.minors ?? [],
        }}
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
