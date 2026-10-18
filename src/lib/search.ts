import type { CatalogCourse } from '../types'

export interface SearchIndexEntry {
  course: CatalogCourse
  /** Code without spaces, e.g. "cs4820". */
  compactCode: string
  title: string
  titleWords: string[]
}

export function buildIndex(courses: CatalogCourse[]): SearchIndexEntry[] {
  return courses.map((course) => {
    const title = course.title.toLowerCase()
    return {
      course,
      compactCode: course.code.toLowerCase().replace(/\s+/g, ''),
      title,
      titleWords: title.split(/[^a-z0-9]+/).filter(Boolean),
    }
  })
}

/** True when every character of `needle` appears in `hay` in order, like "algs" in "algorithms". */
function isSubsequence(needle: string, hay: string): boolean {
  let i = 0
  for (const ch of hay) if (ch === needle[i]) i++
  return i === needle.length
}

function tokenScore(token: string, entry: SearchIndexEntry): number {
  if (entry.compactCode.startsWith(token)) return 6
  if (entry.compactCode.includes(token)) return 4
  if (entry.titleWords.some((w) => w.startsWith(token))) return 3
  // Short tokens like "cs" hit too many titles mid-word ("topics"), so they need a word start.
  if (token.length < 3) return 0
  if (entry.title.includes(token)) return 2
  if (entry.titleWords.some((w) => isSubsequence(token, w))) return 1
  return 0
}

/**
 * Ranks courses for a query like "cs 4820", "cs4820", "algorithms" or "intro algs".
 * Every token must match somewhere; code prefixes rank above title matches.
 */
export function searchCourses(index: SearchIndexEntry[], query: string, limit = 8): CatalogCourse[] {
  const raw = query.trim().toLowerCase()
  if (!raw) return []
  const compactQuery = raw.replace(/\s+/g, '')
  const tokens = raw.split(/\s+/)

  const scored: { entry: SearchIndexEntry; score: number }[] = []
  for (const entry of index) {
    let score = 0
    if (entry.compactCode === compactQuery) score = 1000
    else if (entry.compactCode.startsWith(compactQuery)) score = 500
    else {
      for (const token of tokens) {
        const s = tokenScore(token, entry)
        if (s === 0) {
          score = 0
          break
        }
        score += s
      }
    }
    if (score > 0) scored.push({ entry, score })
  }

  return scored
    .sort((a, b) => b.score - a.score || a.entry.course.code.localeCompare(b.entry.course.code, 'en', { numeric: true }))
    .slice(0, limit)
    .map((s) => s.entry.course)
}
