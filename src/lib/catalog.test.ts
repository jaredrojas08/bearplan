import { describe, expect, it } from 'vitest'
import type { CatalogEntry, Template } from '../types'
import { evaluatePlan, withMinors } from './requirements'
import { templateErrors } from './validate'

const modules = import.meta.glob<{ default: unknown }>('../../public/catalog/*.json', { eager: true })
const byFile = Object.fromEntries(Object.entries(modules).map(([path, mod]) => [path.split('/').at(-1)!, mod.default]))
const index = byFile['index.json'] as CatalogEntry[]
const files = Object.keys(byFile).filter((f) => f !== 'index.json')
const host = byFile['economics-ba.json'] as Template

describe('catalog drafts', () => {
  it('lists every draft in the index, and nothing else', () => {
    expect(index.map((e) => `${e.id}.json`).sort()).toEqual([...files].sort())
  })

  it.each(files)('%s validates and evaluates', (file) => {
    const template = byFile[file] as Template
    expect(templateErrors(template)).toEqual([])
    expect(template.draft).toBe(true)
    expect(index.find((e) => e.id === template.id)?.kind).toBe(template.kind ?? 'major')
    const plan = {
      version: 1 as const, name: 'T', templateId: template.id, entryTerm: 'FA24', gradTerm: 'SP28',
      swimTest: false, spclArea: '', courses: [],
    }
    const resolved = template.kind === 'minor' ? withMinors(host, [template]) : template
    expect(evaluatePlan(plan, resolved, new Date(2026, 9, 1)).totalUnits).toBeGreaterThan(0)
  })
})
