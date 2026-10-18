<script lang="ts">
  import type { Snippet } from 'svelte'
  import { readFile } from '../lib/files'
  import { app, type PlanDetails } from '../lib/store.svelte'
  import { latestFall, nextTerm, shiftTerm, termIndex, termRange, termStatus } from '../lib/terms'

  let {
    initial,
    submitLabel,
    onSubmit,
    secondary,
  }: {
    initial?: PlanDetails
    submitLabel: string
    onSubmit: (details: PlanDetails) => void
    secondary?: Snippet
  } = $props()

  const defaultEntry = latestFall(app.today)
  // Recent entry years only; older plans can still come in through an import.
  const entryOptions = termRange(shiftTerm(defaultEntry, -14), shiftTerm(defaultEntry, 2))

  // svelte-ignore state_referenced_locally
  let name = $state(initial?.name ?? '')
  // svelte-ignore state_referenced_locally
  let templateId = $state(initial?.templateId ?? app.templates[0].id)
  // svelte-ignore state_referenced_locally
  let entryTerm = $state(initial?.entryTerm ?? defaultEntry)
  // svelte-ignore state_referenced_locally
  let gradTerm = $state(initial?.gradTerm ?? shiftTerm(defaultEntry, 7))
  let templateMessage = $state('')
  let fileInput: HTMLInputElement

  let gradOptions = $derived(termRange(nextTerm(entryTerm), shiftTerm(entryTerm, 13)))
  let termCount = $derived(termIndex(gradTerm) - termIndex(entryTerm) + 1)
  let selectedTemplate = $derived(app.templates.find((t) => t.id === templateId))

  $effect(() => {
    if (termIndex(gradTerm) <= termIndex(entryTerm)) gradTerm = gradOptions[Math.min(6, gradOptions.length - 1)]
  })

  async function onTemplateFile(event: Event) {
    const file = await readFile(event)
    if (!file) return
    if ('error' in file) {
      templateMessage = file.error
      return
    }
    const { errors, template } = app.importTemplate(file.text)
    if (template) {
      templateId = template.id
      templateMessage = `Added "${template.name}".`
    } else {
      templateMessage = errors.slice(0, 4).join(' ')
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    onSubmit({ name: name.trim(), templateId, entryTerm, gradTerm })
  }

  let statusHint = $derived.by(() => {
    const current = termRange(entryTerm, gradTerm).find((t) => termStatus(t, app.today) === 'prog')
    return current
      ? `Past terms count as done, ${current} as in progress, later terms as planned.`
      : 'Past terms count as done and later terms as planned.'
  })
</script>

<form class="form" onsubmit={submit}>
  <label class="f">
    Your name
    <input type="text" bind:value={name} required maxlength="80" autocomplete="name" />
  </label>
  <label class="f">
    Requirement checklist
    <select bind:value={templateId}>
      {#each app.templates as t (t.id)}
        <option value={t.id}>{t.name} · {t.college} (entered {t.matriculatedFrom} or later)</option>
      {/each}
    </select>
    <span class="hint">
      Checklists are JSON files, so any major can be added.
      <button type="button" class="link" onclick={() => fileInput.click()}>Import a checklist JSON…</button>
    </span>
    {#if templateMessage}<span class="hint" role="status">{templateMessage}</span>{/if}
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onTemplateFile} />
  </label>
  <div class="two">
    <label class="f">
      Entry term
      <select class="mono" bind:value={entryTerm}>
        {#each entryOptions as t (t)}<option value={t}>{t}</option>{/each}
      </select>
    </label>
    <label class="f">
      Graduation term
      <select class="mono" bind:value={gradTerm}>
        {#each gradOptions as t (t)}<option value={t}>{t}</option>{/each}
      </select>
    </label>
  </div>
  {#if selectedTemplate && termIndex(entryTerm) < termIndex(selectedTemplate.matriculatedFrom)}
    <p class="note warn">This checklist is for students who entered {selectedTemplate.matriculatedFrom} or later.</p>
  {/if}
  <p class="note">{termCount} terms. {statusHint}</p>
  <div class="actions">
    {@render secondary?.()}
    <button type="submit" class="btn primary big">{submitLabel}</button>
  </div>
</form>

<style>
  .form {
    display: flex;
    flex-direction: column;
    gap: 18px;
  }
  .f {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 13px;
    font-weight: 600;
  }
  .f input,
  .f select {
    font-weight: 400;
    font-size: 15px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: 10px;
    background: var(--card);
    min-height: 46px;
  }
  .f select.mono {
    font-family: var(--mono);
  }
  .hint {
    font-weight: 400;
    font-size: 12px;
    color: var(--muted);
  }
  .link {
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent-ink);
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .note {
    margin: 0;
    background: var(--tint);
    color: var(--accent-ink);
    border-radius: 12px;
    padding: 12px 14px;
    font-size: 13px;
  }
  .note.warn {
    background: var(--warn-bg);
    color: var(--warn-ink);
  }
  .actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 4px;
    flex-wrap: wrap;
  }
  .big {
    font-size: 15px;
    min-height: 48px;
    padding: 0 24px;
    margin-left: auto;
  }
</style>
