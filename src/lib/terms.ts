import type { Status, Term } from '../types'

const TERM_RE = /^(FA|SP)(\d{2})$/

export function isTerm(value: string): boolean {
  return TERM_RE.test(value)
}

/** Orders terms on one number line: SP26 < FA26 < SP27. */
export function termIndex(term: Term): number {
  const m = TERM_RE.exec(term)
  if (!m) throw new Error(`Bad term code: ${term}`)
  return (2000 + Number(m[2])) * 2 + (m[1] === 'FA' ? 1 : 0)
}

function termFromIndex(index: number): Term {
  const year = Math.floor(index / 2) % 100
  return (index % 2 ? 'FA' : 'SP') + String(year).padStart(2, '0')
}

/** Entry term through grad term, inclusive. */
export function termRange(from: Term, to: Term): Term[] {
  const terms: Term[] = []
  for (let i = termIndex(from); i <= termIndex(to); i++) terms.push(termFromIndex(i))
  return terms
}

export function shiftTerm(term: Term, by: number): Term {
  return termFromIndex(termIndex(term) + by)
}

export function nextTerm(term: Term): Term {
  return shiftTerm(term, 1)
}

/** The most recent fall term that has started, e.g. FA26 in October 2026 and FA25 in March 2026. */
export function latestFall(today: Date): Term {
  const year = today.getFullYear() - (today.getMonth() >= 7 ? 0 : 1)
  return `FA${String(year % 100).padStart(2, '0')}`
}

/**
 * Position of today on the term line. January to May is spring, August to
 * December is fall, and summer sits halfway between, so no term is current.
 */
function nowIndex(today: Date): number {
  const year = today.getFullYear()
  const month = today.getMonth() + 1
  if (month <= 5) return year * 2
  if (month <= 7) return year * 2 + 0.5
  return year * 2 + 1
}

export function currentTerm(today: Date): Term | null {
  const index = nowIndex(today)
  return Number.isInteger(index) ? termFromIndex(index) : null
}

export function termStatus(term: Term, today: Date): Status {
  const diff = termIndex(term) - nowIndex(today)
  if (diff < 0) return 'done'
  if (diff === 0) return 'prog'
  return 'plan'
}
