import type { WordPageMap } from './engine/library_store'

export type SearchMode = 'exact' | 'morphological' | 'root'

const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
const FORMAT_CONTROLS = /[\u200C\u200D\u202A-\u202E\u2066-\u2069]/g
const DIGITS: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' }
const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل']
const SUFFIXES = ['كما', 'هما', 'كم', 'كن', 'نا', 'ها', 'هم', 'هن', 'ية', 'ات', 'ون', 'ين', 'ان', 'ه', 'ي', 'ة']

/** تطبيع عربي موحد للبحث والعرض، دون تغيير النص المخزن. */
export function normalizeArabic(value: string): string {
  return value.toLocaleLowerCase('ar')
    .replace(FORMAT_CONTROLS, '')
    .replace(DIACRITICS, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩۰-۹]/g, digit => DIGITS[digit] ?? digit)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripAffixes(word: string): string {
  let stem = normalizeArabic(word)
  const prefix = PREFIXES.find((part) => stem.startsWith(part) && stem.length - part.length >= 3)
  if (prefix) stem = stem.slice(prefix.length)
  const suffix = SUFFIXES.find((part) => stem.endsWith(part) && stem.length - part.length >= 3)
  if (suffix) stem = stem.slice(0, -suffix.length)
  return stem
}

export function deriveSearchTerm(query: string, mode: SearchMode): string {
  if (mode === 'exact') return query.trim()
  const words = query.trim().split(/\s+/).map(stripAffixes).filter((word) => word.length >= 2)
  if (mode === 'morphological') return words.join(' ') || query.trim()
  const root = words.map((word) => {
    const consonants = word.replace(/[اوي]/g, '')
    return (consonants.length >= 3 ? consonants : word).slice(0, 3)
  }).join(' ')
  return root || query.trim()
}

export function pageForParagraph(map: WordPageMap | undefined, paragraphIndex: number): number | undefined {
  if (!map || paragraphIndex < 0) return undefined
  const exact = map.paragraphs?.find((paragraph) => paragraph.paragraphIndex === paragraphIndex)
  if (exact) return exact.adjustedPage
  let page: number | undefined
  for (const start of map.starts) {
    if (start.paragraphIndex > paragraphIndex) break
    page = start.adjustedPage
  }
  return page
}

export interface VirtualRange { start: number; end: number }

export function virtualRange(offset: number, loaded: number, rowHeight = 174, windowSize = 36, overscan = 8): VirtualRange {
  if (loaded <= 0) return { start: 0, end: 0 }
  const start = Math.max(0, Math.min(loaded - 1, Math.floor(Math.max(0, offset) / rowHeight) - overscan))
  return { start, end: Math.min(loaded, start + windowSize) }
}
