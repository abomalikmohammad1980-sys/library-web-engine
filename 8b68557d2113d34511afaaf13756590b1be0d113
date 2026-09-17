import { describe, expect, it } from 'vitest'
import type { SearchResult } from './engine/search_store'
import { compareSearchResultsByDeath, groupSearchResultsByBook, numberOrderedSearchResults } from './search_result_order'

const result = (bookId: string, title: string, author: string, deathYearHijri: number | undefined, paraIndex: number): SearchResult => ({
  bookId, title, author, authors: [author], tags: [], paraIndex, snippet: title, matchText: title, field: 'body',
  ...(deathYearHijri === undefined ? {} : { deathYearHijri }),
})

describe('search result ordering', () => {
  it('groups every book and orders its matches by paragraph under the author death order', () => {
    const later = result('later', 'كتاب متأخر', 'مؤلف متأخر', 900, 1)
    const bookA3 = result('a', 'مشارع الأشواق', 'ابن النحاس', 814, 542)
    const bookB = result('b', 'كتاب آخر', 'ابن النحاس', 814, 20)
    const bookA1 = result('a', 'مشارع الأشواق', 'ابن النحاس', 814, 336)
    const early = result('early', 'كتاب مبكر', 'مؤلف مبكر', 300, 8)

    const ordered = [later, bookA3, bookB, bookA1, early].sort(compareSearchResultsByDeath)
    expect(ordered).toEqual([early, bookB, bookA1, bookA3, later])
    expect([...numberOrderedSearchResults(ordered).values()]).toEqual([1, 2, 3, 4, 5])
  })

  it('keeps books contiguous in relevance and equal-date modes too', () => {
    const a2 = result('a', 'مشارع الأشواق', 'ابن النحاس', 814, 542)
    const b1 = result('b', 'كتاب آخر', 'مؤلف آخر', 900, 20)
    const a1 = result('a', 'مشارع الأشواق', 'ابن النحاس', 814, 336)
    const b2 = result('b', 'كتاب آخر', 'مؤلف آخر', 900, 30)
    const firstSeen = new Map([['a', 0], ['b', 1]])
    const ordered = groupSearchResultsByBook([a2, b1, a1, b2], (a, b) => firstSeen.get(a.bookId)! - firstSeen.get(b.bookId)!)
    expect(ordered.map(item => `${item.bookId}:${item.paraIndex}`)).toEqual(['a:336', 'a:542', 'b:20', 'b:30'])
    expect([...numberOrderedSearchResults(ordered).values()]).toEqual([1, 2, 3, 4])
  })
})
