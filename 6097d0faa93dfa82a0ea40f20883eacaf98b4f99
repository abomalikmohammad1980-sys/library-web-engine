import type { SearchResult } from './engine/search_store'

function arabicCompare(a: string, b: string): number {
  return a.localeCompare(b, 'ar', { numeric: true, sensitivity: 'base' })
}

export function compareSearchResultsWithinBook(a: SearchResult, b: SearchResult): number {
  return a.paraIndex - b.paraIndex || arabicCompare(a.field, b.field)
}

function stableBookIdentity(a: SearchResult, b: SearchResult): number {
  return arabicCompare(a.author, b.author)
    || arabicCompare(a.title, b.title)
    || arabicCompare(a.bookId, b.bookId)
}

/**
 * الترتيب الأصلي للباحث: وفاة المؤلف، ثم يجمع الكتاب الواحد، ثم مواضعه.
 * لا نرتب برقم العرض القديم؛ فهو مشتق بعد اكتمال هذا الترتيب.
 */
export function compareSearchResultsByDeath(a: SearchResult, b: SearchResult): number {
  const aYear = a.contemporary || !a.deathYearHijri ? Number.POSITIVE_INFINITY : a.deathYearHijri
  const bYear = b.contemporary || !b.deathYearHijri ? Number.POSITIVE_INFINITY : b.deathYearHijri
  return aYear - bYear
    || stableBookIdentity(a, b)
    || compareSearchResultsWithinBook(a, b)
}

/**
 * يثبت الكتاب كوحدة ترتيب في كل أوضاع العرض. المقارن الخارجي يختار ترتيب
 * الكتب، ثم تجمع جميع مطابقات كل كتاب وتُرتب داخل الكتاب حسب موضعها.
 */
export function groupSearchResultsByBook(
  results: SearchResult[],
  compareBooks: (a: SearchResult, b: SearchResult) => number,
): SearchResult[] {
  const representatives = new Map<string, SearchResult>()
  for (const result of results) if (!representatives.has(result.bookId)) representatives.set(result.bookId, result)
  const orderedBooks = [...representatives.values()].sort((a, b) => compareBooks(a, b) || stableBookIdentity(a, b))
  const bookRank = new Map(orderedBooks.map((result, index) => [result.bookId, index]))
  return [...results].sort((a, b) =>
    (bookRank.get(a.bookId) ?? Number.MAX_SAFE_INTEGER) - (bookRank.get(b.bookId) ?? Number.MAX_SAFE_INTEGER)
      || compareSearchResultsWithinBook(a, b),
  )
}

export function numberOrderedSearchResults(results: SearchResult[]): Map<SearchResult, number> {
  return new Map(results.map((result, index) => [result, index + 1]))
}
