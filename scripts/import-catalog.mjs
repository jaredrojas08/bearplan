// Drafts requirement templates from the Cornell catalog (catalog.cornell.edu).
//
//   node scripts/import-catalog.mjs                  every undergraduate major and minor
//   node scripts/import-catalog.mjs --only econ-ba   some programs (slugs from the catalog URL)
//
// Writes public/catalog/<slug>.json plus public/catalog/index.json. Drafts hold the
// major's own course lists only; college requirements and prose rules need a person.

import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT = join(ROOT, 'public', 'catalog')
const CACHE = join(ROOT, 'node_modules', '.cache', 'bearplan-catalog')
const BASE = 'https://catalog.cornell.edu'
// The catalog answers non-browser user agents with an empty page.
const HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36' }
const DEGREES = /^(BA|BS|BA, BS|BFA|BAR|[A-Z]+-BS|Minor)$/
// Hand-checked templates in src/templates replace these catalog pages.
const VERIFIED = new Set([
  'computer-science-bs',
  'applied-economics-management-bs',
  'business-minor',
  'dyson-business-minor-engineers',
  'economics-ba',
  'music-ba',
  'chemistry-ba',
  'statistics-data-science-ba',
  'history-ba',
  'english-ba',
  'mathematics-ba',
  'computer-science-ba',
  'psychology-ba',
  'government-ba',
  'industrial-labor-relations-bs',
  'operations-research-engineering-bs',
  'hotel-management-bs',
  'information-science-ba',
  'information-science-bs',
  'biological-sciences-ba',
  'biological-sciences-bs',
])
const WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 }

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const clean = (text) => text.replace(/[​ ]/g, ' ').replace(/\s+/g, ' ').trim()
const slugify = (text) => clean(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'part'

let lastFetch = 0
async function page(path) {
  // A hash of the full path keeps distinct URLs apart; the readable part is for browsing the cache.
  const readable = path.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'index'
  const file = join(CACHE, `${readable}-${createHash('sha256').update(path).digest('hex').slice(0, 12)}.html`)
  try {
    return await readFile(file, 'utf8')
  } catch {}
  // One request per second keeps the load on the catalog server light.
  await sleep(Math.max(0, lastFetch + 1000 - Date.now()))
  lastFetch = Date.now()
  const res = await fetch(BASE + path, { headers: HEADERS, signal: AbortSignal.timeout(30_000) })
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const html = await res.text()
  if (html.length < 1000) throw new Error(`${path}: empty page (blocked?)`)
  await mkdir(CACHE, { recursive: true })
  await writeFile(file, html)
  return html
}

async function programList() {
  const $ = cheerio.load(await page('/programs/'))
  const found = new Map()
  $('a[href^="/programs/"]').each((_, a) => {
    const href = $(a).attr('href')
    const text = clean($(a).text())
    const degree = text.match(/\(([^)]+)\)$/)?.[1]
    if (degree && DEGREES.test(degree) && /^\/programs\/[^/]+\/$/.test(href)) found.set(href, { text, degree })
  })
  return [...found].map(([href, v]) => ({ slug: href.split('/')[2], ...v })).sort((a, b) => a.slug.localeCompare(b.slug))
}

// ---------- parsing the course tables ----------

const codeOf = (text) => clean(text).toUpperCase()
const firstNumber = (text) => {
  const word = text.toLowerCase().match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|\d+)\b/)?.[1]
  return word ? (WORDS[word] ?? Number(word)) : null
}
const hoursOf = (text) => {
  const n = clean(text).match(/^(\d+(?:\.\d+)?)(?:\s*-\s*(\d+(?:\.\d+)?))?$/)
  return n ? Number(n[1]) : null
}

/** A short row label from a loose rule, like "ECON 4000+" or "3000+ course". */
function looseLabel(rule) {
  const m = rule?.[0] ?? {}
  const parts = [m.subjects?.join(' / '), m.minLevel ? `${m.minLevel}+` : null].filter(Boolean)
  if (!parts.length) return 'Elective'
  return m.subjects ? parts.join(' ') : `${parts.join(' ')} course`
}

/** Rules a sentence like "Complete two 4000+ level ECON electives of 3 credits" implies. */
function ruleFromText(text, subjects) {
  const match = {}
  const level = text.match(/\b([1-6])000\s*(?:\+|-?\s*level|or above|or higher)/i)
  if (level) match.minLevel = Number(level[1]) * 1000
  const credits = text.match(/\b(\d)[- ]credit/i)
  if (credits) match.minCredits = Number(credits[1])
  const named = [...text.matchAll(/\b([A-Z]{2,6})\b/g)].map((m) => m[1]).filter((s) => subjects.has(s))
  if (named.length) match.subjects = [...new Set(named)]
  return Object.keys(match).length ? [match] : undefined
}

/**
 * Turns one catalog course table into requirement parts. Each part is a slot
 * list, or a credit bucket for "Select N credits" groups.
 */
/** Headers like "Group A (minimum 7 credits)" or "Quantitative (Choose One)" make the rows below a choice. */
function choiceOf(title) {
  if (!title) return null
  if (/recommend/i.test(title)) return { kind: 'skip' }
  // "Option 1: Select two courses" is still an alternative, so the prefix wins over the rest.
  if (/^option\b/i.test(title)) return { kind: 'option' }
  const credits =
    title.match(/(?:minimum|at least|min\.?)\s*(?:of\s*)?(\d+(?:\.\d+)?)\s*(?:credits?|cr)\b/i) ??
    title.match(/(\d+(?:\.\d+)?)\s*(?:credits?|cr)\s*(?:minimum|min\b|required)/i)
  if (credits) return { kind: 'credits', credits: Number(credits[1]) }
  const picked =
    title.match(/\b(?:choose|select)(?: at least)? (one|two|three|four|five|\d+)\b/i) ??
    title.match(/^(one|two|three|four|five|\d+)\s+(?:additional\s+)?(?:courses?|electives?)\b/i) ??
    title.match(/\((one|two|three|four|five|\d+)\s+courses?\)/i)
  if (picked) return { kind: 'pick', count: firstNumber(picked[1]) }
  if (/\b(list|group|electives?|one of)\b/i.test(title)) return { kind: 'pick', count: 1 }
  return null
}

const COUNT_START = /^(?:at least |complete |take |select |choose )?(?:a total of )?(one|two|three|four|five|six|seven|eight|nine|ten|\d+)\b/i

function parseTable($, table, subjects, lists, heading) {
  const parts = []
  let area = null
  let current = null
  let group = null
  let loose = null
  let label = null
  let orNext = false

  // Consecutive "Option 1", "Option 2" areas become one section whose rows carry their option.
  let option = null
  const newArea = (title) => {
    const choice = choiceOf(title)
    group = null
    loose = null
    if (choice?.kind === 'option') {
      if (!option) {
        area = { title: area?.title ?? heading ?? 'Options', slots: [], buckets: [], notes: [] }
        parts.push(area)
      }
      option = title.replace(/:\s*$/, '')
      return
    }
    option = null
    area = { title, slots: [], buckets: [], notes: [], skip: choice?.kind === 'skip' }
    parts.push(area)
    if (choice?.kind === 'credits') {
      group = { kind: 'credits', credits: choice.credits, codes: [], open: true, title }
      area.buckets.push(group)
    } else if (choice?.kind === 'pick') {
      group = { kind: 'pick', count: choice.count ?? 1, codes: [], open: true, label: title }
      area.slots.push(group)
    }
  }
  const ensureArea = () => area ?? newArea(heading)
  // "(HIST-HPE)" names a catalog course list printed further down the page.
  const listCodes = (text) =>
    [...text.matchAll(/\(([A-Z]{2,6}-[A-Z]{2,6})\)/g)].flatMap((m) => lists.get(m[1]) ?? [])

  $(table).find('tbody tr').each((_, tr) => {
    const row = $(tr)
    const cls = row.attr('class') ?? ''
    if (cls.includes('hidden')) return
    row.find('sup').remove()
    const codes = row.find('a.code').map((_, a) => codeOf($(a).text())).get()
    const comment = clean(row.find('.courselistcomment').text())
    const hours = hoursOf(row.find('td.hourscol').text())
    const indented = row.find('.blockindent').length > 0
    const text = clean(row.find('td').first().text())
    const title = clean(row.find('td').eq(1).text())

    if (cls.includes('areaheader')) return void newArea(comment || text)
    const sentence = comment || text
    // Sub-headers are labels unless they state a requirement themselves ("Three courses in ...").
    if (cls.includes('areasubheader') && !(COUNT_START.test(sentence) && /course|seminar|elective|credit/i.test(sentence))) {
      label = sentence.replace(/:$/, '')
      return
    }
    ensureArea()

    if (codes.length && (cls.includes('orclass') || orNext)) {
      // "or ECON 3130" and a row marked "(OR)" add options to the course above.
      orNext = /\(OR\)/.test(title)
      if (current && !(group && indented)) {
        current.codes.push(...codes)
        return
      }
    }

    if (codes.length) {
      orNext = /\(OR\)/.test(title)
      if (group && (indented || group.open)) {
        group.codes.push(...codes)
        return
      }
      group = null
      loose = null
      // "PHYS 1112 & PHYS 1116" requires both, so each gets a row.
      for (const code of codes) {
        current = { label: code, codes: [code], ...(option ? { option } : {}) }
        area.slots.push(current)
      }
      label = null
      return
    }

    if (!sentence) return
    if (indented) {
      // Options under a choice: category names add their course lists; AP credit and the like are skipped.
      const extra = listCodes(sentence)
      const target = group ?? loose
      if (target && extra.length) (target.codes ??= []).push(...extra)
      if (group || loose) return
    }
    const select = /^(select|choose|complete|take)\b/i.test(sentence) || /following|from the list|from this list/i.test(sentence)
    const creditGroup = /credits?\b/i.test(sentence) && !/course/i.test(sentence.split(/credits?/i)[0])
    if (/following|list/i.test(sentence) && select) {
      const count = firstNumber(sentence) ?? 1
      if (creditGroup) {
        group = { kind: 'credits', credits: hours ?? count, codes: [], open: true, title: label ?? sentence }
        area.buckets.push(group)
      } else {
        group = { kind: 'pick', count, codes: [], open: true, label: label ?? `${area.title ?? 'Choice'}`, ...(option ? { option } : {}) }
        area.slots.push(group)
      }
      loose = null
      label = null
      return
    }
    // A sentence row like "Complete two 4000+ level ECON courses" becomes rows with loose rules.
    const count = COUNT_START.test(sentence) ? firstNumber(sentence) : null
    group = null
    loose = null
    if (count && count <= 12 && !/^up to|^no more|^at most|^a maximum/i.test(sentence)) {
      const rule = ruleFromText(sentence, subjects)
      const fromLists = listCodes(sentence)
      loose = { kind: 'loose', count, label: label ?? looseLabel(rule), rule, note: sentence, ...(fromLists.length ? { codes: fromLists } : {}) }
      area.slots.push(loose)
    } else if (hours && /elective|course/i.test(sentence)) {
      const rule = ruleFromText(sentence, subjects)
      area.slots.push({ kind: 'loose', count: 1, label: label ?? looseLabel(rule), rule, note: sentence })
    } else {
      area.notes.push(sentence)
    }
    label = null
  })
  // A long run of plain course rows with no stated count is an option list, not a list of required courses.
  for (const part of parts) {
    const required = part.slots.filter((s) => !s.kind && !s.option)
    if (required.length <= 8) continue
    part.slots = [
      { kind: 'pick', count: 1, label: part.title ?? 'Choice', codes: required.flatMap((s) => s.codes) },
      ...part.slots.filter((s) => s.kind || s.option),
    ]
    part.notes.unshift('The catalog lists these courses without a count here; check how many are required.')
  }
  return parts.filter((p) => !p.skip && (p.slots.length || p.buckets.length))
}

function toSections(parts, heading, idPrefix) {
  const sections = []
  const used = new Set()
  const uniqueId = (base) => {
    let id = `${idPrefix}${slugify(base)}`
    // "additional" is the app's own Additional Space.
    for (let n = 2; used.has(id) || id === 'additional'; n++) id = `${idPrefix}${slugify(base)}-${n}`
    used.add(id)
    return id
  }
  for (const part of parts) {
    const title = part.title?.replace(/:$/, '') || heading || 'Requirements'
    const notes = [...part.notes]
    const slots = []
    let n = 0
    for (const s of part.slots) {
      if (s.kind === 'pick' || s.kind === 'loose') {
        if (s.kind === 'pick' && s.codes.length === 0) continue
        const unique = s.codes?.length ? [...new Set(s.codes)] : null
        const rule = unique ? [{ codes: unique, reason: 'Not on this list in the catalog' }] : s.rule
        for (let i = 0; i < Math.min(s.count, 12); i++) {
          const label = unique && unique.length <= 3 ? unique.join(' / ') : s.label
          slots.push({ id: `s${++n}`, label: s.count > 1 ? `${label} (${i + 1})` : label, ...(rule ? { rule } : {}), ...(s.option ? { option: s.option } : {}) })
        }
        if (s.kind === 'loose' && s.note && !notes.includes(s.note)) notes.push(s.note)
      } else {
        const unique = [...new Set(s.codes)]
        slots.push({
          id: `s${++n}`,
          label: unique.length <= 3 ? unique.join(' / ') : `${unique[0]} or other`,
          rule: [{ codes: unique }],
          ...(s.option ? { option: s.option } : {}),
        })
      }
    }
    const note = notes.join(' ').slice(0, 600) || undefined
    if (slots.length) sections.push({ id: uniqueId(title), title, type: 'slots', slots, ...(note ? { note } : {}) })
    for (const b of part.buckets) {
      const codes = [...new Set(b.codes)]
      if (!codes.length || !b.credits) continue
      sections.push({
        id: uniqueId(`${title} ${b.title}`),
        title: b.title.length > 60 ? `${title}: electives` : `${title}: ${b.title}`.replace(/^Requirements: /, ''),
        type: 'creditBucket',
        minCredits: b.credits,
        rule: [{ codes, reason: 'Not on this list in the catalog' }],
        note: b.title,
      })
    }
  }
  return sections
}

/** Splits the curriculum into headed blocks; concentration-style headings become optional groups. */
function parseProgram(html, program) {
  const $ = cheerio.load(html)
  const container = $('#curriculumtextcontainer').length ? $('#curriculumtextcontainer') : $('#textcontainer')
  const title = clean($('.page-title').first().text()) || program.text
  const college = clean($('p.college-text').first().text())
  const pageText = clean(container.text())
  const totalCredits = Number(pageText.match(/Minimum Credits for Degree:\s*(\d+)/)?.[1]) || undefined
  const uniqueCredits = Number(pageText.match(/minimum of (\d+) unique credits/i)?.[1]) || undefined

  // The course lists sit in the curriculum's own blocks; college rules come after these headings.
  const stopAt = /graduation requirements|learning outcomes|requirements for all students/i
  const courseSubjects = new Set(container.find('a.code').map((_, a) => codeOf($(a).text()).split(' ')[0]).get())

  // Pages without course tables state the rules in prose; keep that text for a credit-only draft.
  const prose = []
  let inRequirements = false
  container.find('h2, h3, h4, p, li').each((_, el) => {
    const text = clean($(el).text())
    if (/^h/.test(el.tagName)) {
      if (stopAt.test(text)) inRequirements = false
      else if (/requirements?/i.test(text)) inRequirements = true
    } else if (inRequirements && text && !/^Minimum Credits/.test(text) && !prose.some((p) => p.includes(text))) {
      // A paragraph and the list items inside it both match, so keep the longest text once.
      for (let i = prose.length - 1; i >= 0; i--) if (text.includes(prose[i])) prose.splice(i, 1)
      prose.push(text)
    }
  })
  const programCredits = Number(pageText.match(/Minimum Credits for (?:Minor|Major):\s*(\d+)/)?.[1]) ||
    Number(prose.join(' ').match(/\b(\d{2})\s+(?:academic\s+)?credits\b/i)?.[1]) || undefined

  // Category course lists ("Course List (Per Attribute)") are options for requirement rows, not requirements.
  const lists = new Map()
  const isList = (table) => /per attribute/i.test($(table).find('caption').text())
  container.find('table.sc_courselist').each((_, table) => {
    if (!isList(table)) return
    const heading = clean($(table).prevAll('h2, h3, h4, h5').first().text() || $(table).parent().prevAll('h2, h3, h4, h5').first().text())
    const attr = heading.match(/\(([A-Z]{2,6}-[A-Z]{2,6})\)/)?.[1]
    if (attr) lists.set(attr, $(table).find('a.code').map((_, a) => codeOf($(a).text())).get())
  })

  const blocks = []
  let heading = null
  let level = 0
  // Concentrations follow a "Concentrations" heading, as its children or as headings at its own level.
  let markerLevel = null
  let concentrationLevel = null
  let concentration = null
  let stopped = false
  container.find('h2, h3, h4, h5, table.sc_courselist').each((_, el) => {
    if (stopped) return
    const tag = el.tagName.toLowerCase()
    if (tag !== 'table') {
      const text = clean($(el).text())
      const lvl = Number(tag[1])
      if (stopAt.test(text)) return void (stopped = true)
      const isMarker = /^(concentrations?|tracks?|specializations?|focused electives|focus areas?|areas of concentration)$|^(concentrations?|tracks?|specializations?) \(|requirements by concentration|^concentration requirements/i.test(text)
      if (isMarker) {
        markerLevel = lvl
        concentrationLevel = null
        concentration = null
      } else if (markerLevel !== null) {
        if (concentrationLevel === null && (lvl === markerLevel || lvl === markerLevel + 1)) concentrationLevel = lvl
        if (lvl === concentrationLevel) concentration = text
        else if (concentrationLevel !== null && lvl < concentrationLevel) markerLevel = concentrationLevel = concentration = null
      }
      heading = text
      level = lvl
      return
    }
    if (isList(el)) return
    const parts = parseTable($, el, courseSubjects, lists, heading)
    if (!parts.length) return
    blocks.push({ heading, parts, concentration })
  })
  return { title, college, totalCredits, uniqueCredits, blocks, prose, programCredits, courseSubjects: [...courseSubjects] }
}

function toTemplate(program, parsed) {
  const minor = program.degree === 'Minor'
  const name = parsed.title.replace(/\s*\((?:Minor)\)$/, '')
  const base = []
  const concentrations = new Map()
  for (const block of parsed.blocks) {
    if (block.concentration) {
      const id = slugify(block.concentration)
      const list = concentrations.get(id) ?? { id, name: block.concentration, parts: [] }
      list.parts.push(...block.parts.map((p) => ({ ...p, title: p.title ?? block.heading })))
      concentrations.set(id, list)
    } else {
      base.push(...block.parts.map((p) => ({ ...p, title: p.title ?? block.heading })))
    }
  }

  // Sections alternate columns by size so the two columns stay close in height.
  const place = (sections, start = [0, 0]) => {
    const height = [...start]
    for (const s of sections) {
      const i = height[0] <= height[1] ? 0 : 1
      s.column = i === 0 ? 'left' : 'right'
      s.filter = 'major'
      s.icon = s.type === 'creditBucket' ? 'star' : 'book'
      height[i] += (s.slots?.length ?? 1) + 2
    }
    return height
  }
  const sections = toSections(base, null, '')
  const heights = place(sections)
  const concentrationList = [...concentrations.values()]
    .map((c) => ({ id: c.id, name: c.name.slice(0, 80), sections: toSections(c.parts, c.name, `${c.id.slice(0, 20)}-`) }))
    .filter((c) => c.sections.length)
  for (const c of concentrationList) place(c.sections, heights)

  if (sections.length === 0 && concentrationList.length === 0) {
    if (!parsed.programCredits || !parsed.prose.length) return null
    sections.push({
      id: 'requirements',
      title: minor ? 'Minor Requirements' : 'Major Requirements',
      type: 'creditBucket',
      minCredits: parsed.programCredits,
      // Subjects named in the text keep unrelated courses out; cross-listed ones may need a custom entry.
      ...(parsed.courseSubjects.length
        ? { rule: [{ subjects: parsed.courseSubjects, reason: `Needs a ${parsed.courseSubjects.join(' / ')} course` }] }
        : {}),
      note: parsed.prose.join(' ').slice(0, 900),
      column: 'left',
      filter: 'major',
      icon: 'book',
    })
  }
  return {
    id: program.slug,
    ...(minor ? { kind: 'minor' } : {}),
    name: minor ? name : parsed.title,
    college: parsed.college || 'Cornell University',
    matriculatedFrom: 'FA22',
    draft: true,
    source: `${BASE}/programs/${program.slug}/`,
    ...(!minor && parsed.totalCredits ? { totalCredits: parsed.totalCredits } : {}),
    ...(minor && parsed.uniqueCredits ? { minUniqueCredits: parsed.uniqueCredits } : {}),
    filters: [{ id: 'major', label: minor ? 'Minor' : 'Major', icon: 'book' }],
    sections: sections.length ? sections : concentrationList.shift().sections,
    ...(concentrationList.length && !minor ? { concentrations: concentrationList, maxConcentrations: 1 } : {}),
    checks: [],
  }
}

async function main() {
  const args = process.argv.slice(2)
  const only = args[0] === '--only' ? new Set(args[1]?.split(',')) : null
  if (args.length && !only?.size) throw new Error('Usage: import-catalog.mjs [--only slug,slug]')

  const programs = (await programList()).filter((p) => !VERIFIED.has(p.slug) && (!only || only.has(p.slug)))
  await mkdir(OUT, { recursive: true })
  const index = []
  const skipped = []
  for (const [i, program] of programs.entries()) {
    process.stdout.write(`\r${i + 1}/${programs.length} ${program.slug.padEnd(50)}`)
    try {
      const template = toTemplate(program, parseProgram(await page(`/programs/${program.slug}/`), program))
      if (!template) {
        skipped.push(`${program.slug}: no course tables`)
        continue
      }
      await writeFile(join(OUT, `${program.slug}.json`), JSON.stringify(template, null, 1) + '\n')
      index.push({ id: template.id, kind: template.kind ?? 'major', name: template.name, college: template.college })
    } catch (err) {
      skipped.push(`${program.slug}: ${err.message}`)
    }
  }
  process.stdout.write('\n')
  if (!only) await writeFile(join(OUT, 'index.json'), JSON.stringify(index, null, 1) + '\n')
  console.log(`Wrote ${index.length} drafts to ${OUT}`)
  if (skipped.length) console.log(`Skipped ${skipped.length}:\n  ${skipped.join('\n  ')}`)
}

main().catch((err) => {
  console.error(`\n${err.message}`)
  process.exit(1)
})
