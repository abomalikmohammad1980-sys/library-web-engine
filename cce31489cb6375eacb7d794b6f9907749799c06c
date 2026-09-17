export interface QuranSearchOptions { respectTashkeel?: boolean; fuzzy?: boolean; maxFuzzyDistance?: number }
export type QuranMatchKind = 'exact' | 'token-prefix' | 'substring' | 'ordered-letters' | 'fuzzy'
export interface QuranSearchCandidate { id: string; text: string; searchText?: string }
export interface QuranSearchMatch extends QuranSearchCandidate { score: number; kind: QuranMatchKind; reason?: string }

const marks = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
type IndexedCandidate = { candidate: QuranSearchCandidate; text: string; expandedText: string; tokens: string[]; compact: string; expandedCompact: string }
const candidateIndexes = new WeakMap<object, Map<boolean, IndexedCandidate[]>>()
const candidateResults = new WeakMap<object, Map<string, readonly QuranSearchMatch[]>>()
export function normalizeQuranSearch(value: string, respectTashkeel = false): string {
  let normalized = value.normalize('NFC').replace(/ـ/g, '').replace(/[أإآٱ]/g, 'ا').replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و')
  if (!respectTashkeel) normalized = normalized.replace(marks, '')
  return normalized.replace(/\s+/g, ' ').trim()
}
function normalizeExpandedDaggerAlif(value: string, respectTashkeel = false): string {
  return normalizeQuranSearch(value.replace(/\u0670/g, 'ا'), respectTashkeel)
}
export function matchesQuranPhrase(query: string, text: string, respectTashkeel = false): boolean {
  const needle = normalizeQuranSearch(query, respectTashkeel)
  if (needle.length < 2) return false
  return normalizeQuranSearch(text, respectTashkeel).includes(needle)
    || normalizeExpandedDaggerAlif(text, respectTashkeel).includes(needle)
}
function boundedDistance(a: string, b: string, max: number): number {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index)
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i]; let rowMin = i
    for (let j = 1; j <= b.length; j += 1) { const value = Math.min(current[j - 1]! + 1, previous[j]! + 1, previous[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1)); current[j] = value; rowMin = Math.min(rowMin, value) }
    if (rowMin > max) return max + 1
    previous = current
  }
  return previous[b.length]!
}
function orderedLetters(query: string, text: string): boolean { let at = 0; for (const letter of text) if (letter === query[at]) at += 1; return at === query.length }
export function searchQuranCandidates(query: string, candidates: readonly QuranSearchCandidate[], options: QuranSearchOptions = {}): QuranSearchMatch[] {
  const needle = normalizeQuranSearch(query, options.respectTashkeel)
  if (needle.length < 2) return []
  const maxDistance = Math.min(2, Math.max(1, options.maxFuzzyDistance ?? 1)), allowFuzzy = options.fuzzy !== false
  const sensitive = options.respectTashkeel === true, key = candidates as object
  let resultVariants = candidateResults.get(key)
  if (!resultVariants) { resultVariants = new Map(); candidateResults.set(key, resultVariants) }
  const resultKey = `${sensitive ? 1 : 0}|${allowFuzzy ? 1 : 0}|${maxDistance}|${needle}`
  const cached = resultVariants.get(resultKey)
  if (cached) return cached.map(item => ({ ...item }))
  const matches: QuranSearchMatch[] = []
  let variants = candidateIndexes.get(key)
  if (!variants) { variants = new Map(); candidateIndexes.set(key, variants) }
  let indexed = variants.get(sensitive)
  if (!indexed) {
    indexed = candidates.map(candidate => {
      const sourceText = candidate.searchText ?? candidate.text
      const text = normalizeQuranSearch(sourceText, sensitive), expandedText = normalizeExpandedDaggerAlif(sourceText, sensitive)
      return { candidate, text, expandedText, tokens: [...new Set([...text.split(' '), ...expandedText.split(' ')])], compact: text.replace(/\s/g, ''), expandedCompact: expandedText.replace(/\s/g, '') }
    })
    variants.set(sensitive, indexed)
  }
  for (const item of indexed) {
    const { candidate, text, expandedText, tokens, compact, expandedCompact } = item
    let kind: QuranMatchKind | undefined, score = 0, reason: string | undefined
    if (text === needle || expandedText === needle) { kind = 'exact'; score = 100 }
    else if (tokens.some(token => token.startsWith(needle))) { kind = 'token-prefix'; score = 92 }
    else if (text.includes(needle) || expandedText.includes(needle)) { kind = 'substring'; score = 86 }
    else if (allowFuzzy && needle.length >= 3 && Math.min(text.length, expandedText.length) <= needle.length * 2 + 2 && (orderedLetters(needle, compact) || orderedLetters(needle, expandedCompact))) { kind = 'ordered-letters'; score = 68; reason = 'تقارب ترتيب الحروف' }
    else if (allowFuzzy && needle.length >= 4) { const distance = Math.min(...tokens.map(token => boundedDistance(needle, token, maxDistance))); if (distance <= maxDistance) { kind = 'fuzzy'; score = 60 - distance * 5; reason = 'تقارب إملائي' } }
    if (kind) matches.push({ ...candidate, kind, score, ...(reason ? { reason } : {}) })
  }
  const sorted = matches.sort((a, b) => b.score - a.score || a.id.localeCompare(b.id, 'ar'))
  if (resultVariants.size >= 64) resultVariants.delete(resultVariants.keys().next().value as string)
  resultVariants.set(resultKey, sorted.map(item => ({ ...item })))
  return sorted
}

export function canonicalQuranOrder<T extends { id: string }>(items: readonly T[]): T[] {
  const position = (id: string): [number, number] => { const [rawSurah, rawAyah] = id.split(':'); const surah = Number(rawSurah), ayah = Number(rawAyah); return [Number.isFinite(surah) ? surah : 999, Number.isFinite(ayah) ? ayah : 9999] }
  return [...items].sort((a, b) => { const [as, aa] = position(a.id), [bs, ba] = position(b.id); return as - bs || aa - ba })
}

export function countQuranOccurrences(query: string, texts: readonly string[], respectTashkeel = false): number {
  const needle = normalizeQuranSearch(query, respectTashkeel)
  if (needle.length < 2) return 0
  return texts.reduce((total, text) => {
    const haystack = normalizeQuranSearch(text, respectTashkeel)
    let count = 0, at = 0
    while ((at = haystack.indexOf(needle, at)) >= 0) { count += 1; at += Math.max(1, needle.length) }
    return total + count
  }, 0)
}

/**
 * يحسب الموضع القرآني مرة واحدة ولو كانت الآية مفهرسة بالرسمين العثماني
 * والإملائي؛ ويحتفظ بتعدد الورود الحقيقي داخل الآية بأخذ أكبر العدّين.
 */
export function countLogicalQuranOccurrences(query: string, verses: readonly { uthmani: string; imlai?: string }[], respectTashkeel = false): number {
  return verses.reduce((total, verse) => total + Math.max(
    countQuranOccurrences(query, [verse.uthmani], respectTashkeel),
    verse.imlai ? countQuranOccurrences(query, [verse.imlai], respectTashkeel) : 0,
  ), 0)
}
