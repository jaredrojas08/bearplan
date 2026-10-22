<script lang="ts">
  import type { Snippet } from 'svelte'
  import { readFile } from '../lib/files'
  import { app, type PlanDetails } from '../lib/store.svelte'
  import type { Term } from '../types'
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
  const earlier = (a: Term, b: Term) => (termIndex(a) <= termIndex(b) ? a : b)
  const later = (a: Term, b: Term) => (termIndex(a) >= termIndex(b) ? a : b)
  // Recent entry years only, widened so an imported plan's own terms stay selectable.
  // svelte-ignore state_referenced_locally
  const entryOptions = termRange(
    earlier(shiftTerm(defaultEntry, -14), initial?.entryTerm ?? defaultEntry),
    later(shiftTerm(defaultEntry, 2), initial?.entryTerm ?? defaultEntry),
  )

  // svelte-ignore state_referenced_locally
  let name = $state(initial?.name ?? '')
  // svelte-ignore state_referenced_locally
  let templateId = $state(initial?.templateId ?? app.majorOptions[0].id)
  // svelte-ignore state_referenced_locally
  let entryTerm = $state(initial?.entryTerm ?? defaultEntry)
  // svelte-ignore state_referenced_locally
  let gradTerm = $state(initial?.gradTerm ?? shiftTerm(defaultEntry, 7))
  // svelte-ignore state_referenced_locally
  let concentrations = $state<string[]>(initial?.concentrations ?? [])
  // svelte-ignore state_referenced_locally
  let minors = $state<string[]>(initial?.minors ?? [])
  let templateMessage = $state('')
  let fileInput: HTMLInputElement

  let gradOptions = $derived(termRange(nextTerm(entryTerm), later(shiftTerm(entryTerm, 13), initial?.gradTerm ?? entryTerm)))
  let termCount = $derived(termIndex(gradTerm) - termIndex(entryTerm) + 1)
  let selectedTemplate = $derived(app.majors.find((t) => t.id === templateId))
  let minorOptions = $derived(app.minorOptions.filter((m) => !minors.includes(m.id)))
  const minorName = (id: string) => app.minorOptions.find((m) => m.id === id)?.name ?? id
  let loadMessage = $state('')

  // Drafted checklists download when picked, so concentrations and limits are known before saving.
  $effect(() => {
    const id = templateId
    loadMessage = ''
    void app.ensureTemplates([id]).then((status) => {
      if (status !== 'ok' && id === templateId) loadMessage = 'This checklist could not be downloaded. Check your connection.'
    })
  })

  async function addMinor(event: Event) {
    const select = event.currentTarget as HTMLSelectElement
    const id = select.value
    select.value = ''
    if (!id) return
    if ((await app.ensureTemplates([id])) === 'ok') minors = [...minors, id]
    else loadMessage = `The ${minorName(id)} minor could not be downloaded. Check your connection.`
  }
  let offered = $derived(selectedTemplate?.concentrations ?? [])
  let maxConcentrations = $derived(selectedTemplate?.maxConcentrations ?? 1)

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
    if (template?.kind === 'minor') {
      if (!minors.includes(template.id)) minors = [...minors, template.id]
      templateMessage = `Added the "${template.name}" minor.`
    } else if (template) {
      templateId = template.id
      templateMessage = `Added "${template.name}".`
    } else {
      templateMessage = errors.slice(0, 4).join(' ')
    }
  }

  function submit(event: SubmitEvent) {
    event.preventDefault()
    // Picks from a previously selected checklist don't carry over.
    const kept = concentrations.filter((id) => offered.some((c) => c.id === id))
    onSubmit({ name: name.trim(), templateId, entryTerm, gradTerm, concentrations: kept, minors })
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
      {#each [false, true] as draft (draft)}
        <optgroup label={draft ? 'Drafts from the catalog (not yet checked)' : 'Checked checklists'}>
          {#each app.majorOptions.filter((o) => o.draft === draft) as o (o.id)}
            {@const t = app.majors.find((m) => m.id === o.id)}
            <option value={o.id}>
              {o.name} · {o.college}{t && !draft
                ? ` (${t.matriculatedBefore ? `entered ${t.matriculatedFrom} to before ${t.matriculatedBefore}` : `entered ${t.matriculatedFrom} or later`})`
                : ''}
            </option>
          {/each}
        </optgroup>
      {/each}
    </select>
    <span class="hint">
      Checklists are JSON files, so any major can be added.
      <button type="button" class="link" onclick={() => fileInput.click()}>Import a checklist JSON…</button>
    </span>
    {#if templateMessage}<span class="hint" role="status">{templateMessage}</span>{/if}
    {#if selectedTemplate?.draft}
      <span class="hint draft-hint">Drafted automatically from the catalog: the major's own courses only, not checked by a person.</span>
    {/if}
    {#if loadMessage}<span class="hint" role="alert">{loadMessage}</span>{/if}
    <input bind:this={fileInput} type="file" accept="application/json,.json" hidden onchange={onTemplateFile} />
  </label>
  {#if offered.length}
    <fieldset class="f">
      <legend>Concentration{maxConcentrations > 1 ? `s (up to ${maxConcentrations})` : ''}</legend>
      <div class="choices">
        {#each offered as c (c.id)}
          <label class="choice">
            <input
              type="checkbox"
              value={c.id}
              bind:group={concentrations}
              disabled={!concentrations.includes(c.id) && concentrations.filter((id) => offered.some((o) => o.id === id)).length >= maxConcentrations}
            />
            {c.name}
          </label>
        {/each}
      </div>
      <span class="hint">Optional. Change it any time in plan details.</span>
    </fieldset>
  {/if}
  {#if app.minorOptions.length}
    <div class="f">
      <label for="minor-pick">Minors</label>
      {#if minors.length}
        <ul class="minor-list">
          {#each minors as id (id)}
            <li class="minor-chip">
              {minorName(id)}
              <button type="button" class="link" aria-label="Remove the {minorName(id)} minor" onclick={() => (minors = minors.filter((m) => m !== id))}>Remove</button>
            </li>
          {/each}
        </ul>
      {/if}
      {#if minorOptions.length}
        <select id="minor-pick" onchange={addMinor}>
          <option value="">Add a minor…</option>
          {#each [false, true] as draft (draft)}
            <optgroup label={draft ? 'Drafts from the catalog' : 'Checked'}>
              {#each minorOptions.filter((m) => m.draft === draft) as m (m.id)}<option value={m.id}>{m.name} · {m.college}</option>{/each}
            </optgroup>
          {/each}
        </select>
      {/if}
      <span class="hint">Optional. A course can count for your major and a minor; each minor's unique-credit rule still applies.</span>
    </div>
  {/if}
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
  {:else if selectedTemplate?.matriculatedBefore && termIndex(entryTerm) >= termIndex(selectedTemplate.matriculatedBefore)}
    <p class="note warn">This checklist is for students who entered before {selectedTemplate.matriculatedBefore}.</p>
  {/if}
  <p class="note">{termCount} terms. {statusHint}</p>
  <div class="actions">
    {@render secondary?.()}
    <button type="submit" class="btn primary big" disabled={!selectedTemplate}>{submitLabel}</button>
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
  fieldset.f {
    border: 0;
    margin: 0;
    padding: 0;
  }
  legend {
    padding: 0;
    margin-bottom: 6px;
  }
  .choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
    gap: 6px 14px;
  }
  /* Overrides the text-field sizing that .f input gives every input. */
  .f .choice input {
    min-height: 0;
    padding: 0;
  }
  .choice {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    font-size: 14px;
  }
  .minor-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .minor-chip {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 400;
    font-size: 14px;
    background: var(--tint);
    border-radius: 999px;
    padding: 4px 12px;
  }
  .draft-hint {
    color: var(--warn-ink);
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
