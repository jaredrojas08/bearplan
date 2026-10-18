// Plans and templates are small; anything bigger is the wrong file.
const MAX_BYTES = 2_000_000

/** Reads the file picked in an <input type="file"> as text, then clears the input. */
export async function readFile(event: Event): Promise<{ text: string } | { error: string } | null> {
  const input = event.currentTarget as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return null
  if (file.size > MAX_BYTES) return { error: 'That file is too large to be a plan or checklist.' }
  try {
    return { text: await file.text() }
  } catch {
    return { error: 'The file could not be read.' }
  }
}
