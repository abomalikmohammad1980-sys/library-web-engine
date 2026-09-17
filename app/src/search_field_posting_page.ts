import { normalizeArabicSearch } from '../../packages/search/src/index'
import { SearchFieldBoundaries, type SeparatedContentScope } from './search_field_boundaries'
import { searchFieldSourceSnippet } from './search_field_source_snippet'

export type FieldPostingCandidate = { id: string; positionsByQueryWord: readonly (readonly number[])[]; deathYearHijri?: number }
export type FieldSourceHydration = { fullText: string; range: readonly [number, number] }
export type FieldBoundaryBookProvider = { book: (bookId: string) => Promise<SearchFieldBoundaries | undefined> }

/** Opt-in adapter primitive, not wired to the global search switch. Posting
 * lists, boundaries and hydration must belong to the SAME verified release.
 * Pagination counts paragraphs, not repeated occurrences of a word in one page.
 */
export async function searchFieldPostingPage(options: {
  query: string; scope: SeparatedContentScope; offset: number; limit: number;
  candidates: readonly FieldPostingCandidate[]; boundaries: SearchFieldBoundaries | FieldBoundaryBookProvider;
  coverage: { complete: boolean; unavailableBookIds: readonly string[] };
  hydrate: (id: string, scope: SeparatedContentScope) => Promise<FieldSourceHydration>;
  signal?: AbortSignal;
}) {
  const { boundaries, scope, signal } = options
  const check = () => signal?.throwIfAborted()
  check()
  if (!Number.isSafeInteger(options.offset) || options.offset < 0 || !Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 500) throw Error('search_field_page_range')
  const words = normalizeArabicSearch(options.query).split(' ').filter(Boolean)
  if (!words.length) throw Error('search_field_query_empty')
  const seen = new Set<string>(), unavailable = new Set(options.coverage.unavailableBookIds)
  const selected: Array<{ id: string; tokenStart: number; occurrenceCount: number }> = []
  let currentBook: string | undefined, currentBoundaries: SearchFieldBoundaries | undefined
  let totalDocuments = 0, totalOccurrences = 0
  const ordered = [...options.candidates].sort((a, b) => (a.deathYearHijri ?? Infinity) - (b.deathYearHijri ?? Infinity) || a.id.localeCompare(b.id))
  for (const candidate of ordered) {
    check()
    if (!/^\d+:\d+$/u.test(candidate.id) || seen.has(candidate.id) || candidate.positionsByQueryWord.length !== words.length) throw Error('search_field_candidate_invalid')
    seen.add(candidate.id)
    const bookId = candidate.id.split(':')[0]!
    if (boundaries instanceof SearchFieldBoundaries) currentBoundaries = boundaries
    else if (currentBook !== bookId) {
      // Release-pinned overlays retain only a bounded book cache. Do not merge
      // the entire library's boundary rows into one browser-resident map.
      currentBoundaries = await boundaries.book(bookId)
      check()
    }
    currentBook = bookId
    if (!currentBoundaries?.has(candidate.id)) { unavailable.add(bookId); continue }
    const starts = currentBoundaries.phraseStarts(candidate.id, candidate.positionsByQueryWord, scope)
    if (!starts.length) continue
    totalOccurrences += starts.length
    if (totalDocuments >= options.offset && selected.length < options.limit) selected.push({ id: candidate.id, tokenStart: starts[0]!, occurrenceCount: starts.length })
    totalDocuments++
  }
  const hits = []
  for (const row of selected) {
    check()
    const source = await options.hydrate(row.id, scope)
    check()
    hits.push({ ...row, ...searchFieldSourceSnippet(source.fullText, source.range, row.tokenStart, options.query) })
  }
  return { hits, totalDocuments, totalOccurrences, offset: options.offset, limit: options.limit, coverageComplete: options.coverage.complete && unavailable.size === 0, unavailableBookIds: [...unavailable] }
}
