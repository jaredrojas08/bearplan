#!/usr/bin/env node
// Builds public/courses.json from the Cornell Class Roster API.
//
//   node scripts/fetch-courses.mjs                      newest two fall/spring rosters
//   node scripts/fetch-courses.mjs --rosters FA26,SP26  specific rosters
//   node scripts/fetch-courses.mjs --subjects CS,MATH   only some subjects (quick test)

import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const API = 'https://classes.cornell.edu/api/2.0/'
// The API asks for at most one request per second.
const REQUEST_GAP_MS = 1100
const MAX_RETRIES = 3
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/courses.json')

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '')
    if (!['rosters', 'subjects'].includes(key) || !argv[i + 1]) {
      throw new Error(`Usage: fetch-courses.mjs [--rosters FA26,SP26] [--subjects CS,MATH]`)
    }
    args[key] = argv[i + 1].split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
  }
  return args
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let lastRequest = 0

/** GETs an API path, spaced at least REQUEST_GAP_MS apart. Returns null for "no results". */
async function get(path, attempt = 1) {
  const wait = lastRequest + REQUEST_GAP_MS - Date.now()
  if (wait > 0) await sleep(wait)
  lastRequest = Date.now()

  const res = await fetch(API + path)
  // The search endpoint answers 404 when a subject has no classes that term.
  if (res.status === 404) return null
  if (res.status === 429 || res.status >= 500) {
    if (attempt > MAX_RETRIES) throw new Error(`${path}: HTTP ${res.status} after ${MAX_RETRIES} retries`)
    await sleep(REQUEST_GAP_MS * 2 ** attempt)
    return get(path, attempt + 1)
  }
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`)
  const body = await res.json()
  if (body.status !== 'success') throw new Error(`${path}: ${body.message ?? 'API error'}`)
  return body.data
}

function rosterOrder(slug) {
  const year = Number(slug.slice(2))
  return year * 4 + { WI: 0, SP: 1, SU: 2, FA: 3 }[slug.slice(0, 2)]
}

/** Distribution categories now live in crseAttrs; older rosters used catalogDistr. */
function distributionsOf(cls) {
  const fromAttrs = (cls.crseAttrs ?? [])
    .filter((a) => a.attrDescrShort === 'DistReq' && a.crseAttrValue)
    .map((a) => a.crseAttrValue.trim())
  if (fromAttrs.length) return [...new Set(fromAttrs)]
  return (cls.catalogDistr ?? '').match(/[A-Z]+(?:-[A-Z]+)?/g) ?? []
}

function creditsOf(cls) {
  const groups = cls.enrollGroups ?? []
  const mins = groups.map((g) => g.unitsMinimum).filter((n) => typeof n === 'number')
  const maxes = groups.map((g) => g.unitsMaximum).filter((n) => typeof n === 'number')
  return { creditsMin: mins.length ? Math.min(...mins) : 0, creditsMax: maxes.length ? Math.max(...maxes) : 0 }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  let rosters = args.rosters
  if (!rosters) {
    const { rosters: all } = await get('config/rosters.json')
    rosters = all
      .map((r) => r.slug)
      .filter((slug) => /^(FA|SP)\d{2}$/.test(slug))
      .sort((a, b) => rosterOrder(b) - rosterOrder(a))
      .slice(0, 2)
  }
  // Newest roster first, so its titles and credits win on duplicates.
  rosters.sort((a, b) => rosterOrder(b) - rosterOrder(a))
  console.log(`Rosters: ${rosters.join(', ')}`)

  const courses = new Map()
  for (const roster of rosters) {
    let subjects = args.subjects
    if (!subjects) {
      const data = await get(`config/subjects.json?roster=${roster}`)
      subjects = data.subjects.map((s) => s.value)
    }
    for (const [i, subject] of subjects.entries()) {
      process.stdout.write(`\r${roster} ${i + 1}/${subjects.length} ${subject.padEnd(6)}`)
      const data = await get(`search/classes.json?roster=${roster}&subject=${encodeURIComponent(subject)}`)
      for (const cls of data?.classes ?? []) {
        const code = `${cls.subject} ${cls.catalogNbr}`
        const existing = courses.get(code)
        if (existing) {
          if (!existing.rosters.includes(roster)) existing.rosters.push(roster)
          continue
        }
        courses.set(code, {
          code,
          title: cls.titleLong || cls.titleShort || '',
          ...creditsOf(cls),
          distributions: distributionsOf(cls),
          rosters: [roster],
        })
      }
    }
    process.stdout.write('\n')
  }

  const sorted = [...courses.values()].sort((a, b) => a.code.localeCompare(b.code, 'en', { numeric: true }))
  await mkdir(dirname(OUT), { recursive: true })
  await writeFile(OUT, JSON.stringify(sorted) + '\n')
  console.log(`Wrote ${sorted.length} courses to ${OUT}`)
}

main().catch((err) => {
  console.error(`\n${err.message}`)
  process.exit(1)
})
