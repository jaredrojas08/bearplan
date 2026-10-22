import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import type { CatalogEntry, Template } from '../types'
import { evaluatePlan, withMinors } from './requirements'
import { templateErrors } from './validate'

const DIR = join(__dirname, '../../public/catalog')
const files = readdirSync(DIR).filter((f) => f.endsWith('.json') && f !== 'index.json')
const read = (file: string) => JSON.parse(readFileSync(join(DIR, file), 'utf8'))
const index: CatalogEntry[] = read('index.json')

describe('catalog drafts', () => {
  it('lists every draft in the index, and nothing else', () => {
    expect(index.map((e) => `${e.id}.json`).sort()).toEqual([...files].sort())
  })

  it.each(files)('%s validates and evaluates', (file) => {
    const template = read(file) as Template
    expect(templateErrors(template)).toEqual([])
    expect(template.draft).toBe(true)
    expect(index.find((e) => e.id === template.id)?.kind).toBe(template.kind ?? 'major')
    const plan = {
      version: 1 as const, name: 'T', templateId: template.id, entryTerm: 'FA24', gradTerm: 'SP28',
      swimTest: false, spclArea: '', courses: [],
    }
    const host = template.kind === 'minor' ? withMinors(read('economics-ba.json'), [template]) : template
    expect(evaluatePlan(plan, host, new Date(2026, 9, 1)).totalUnits).toBeGreaterThan(0)
  })
})
