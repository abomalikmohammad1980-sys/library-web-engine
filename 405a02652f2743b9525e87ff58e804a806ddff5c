import { describe, expect, it } from 'vitest'
import { bookPageCount, cacheReaderPageCount, cachedReaderPageCount, clearCachedReaderPageCount, wordPageMaximum } from './book_page_count'
import { beforeEach, vi } from 'vitest'

describe('book page count source', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
  })
  it('prefers the actual reader page count over an older Word map total', () => {
    expect(bookPageCount({ readerPageCount: 73, wordPageMap: { totalPages: 72, pages: Array(72) } })).toBe(73)
  })

  it('falls back to the Word map before the reader has rendered the book', () => {
    expect(bookPageCount({ wordPageMap: { totalPages: 72 } })).toBe(72)
  })

  it('survives a route reload synchronously while IndexedDB persistence completes', () => {
    cacheReaderPageCount('old-book', 73)
    expect(bookPageCount({ wordPageMap: { totalPages: 72 } }, cachedReaderPageCount('old-book'))).toBe(73)
    clearCachedReaderPageCount('old-book')
    expect(cachedReaderPageCount('old-book')).toBeUndefined()
  })

  it('separates 72 physical sheets from a Word numbering maximum of 73', () => {
    const book = { physicalPageCount: 72, wordPageMap: { totalPages: 72, starts: [{ adjustedPage: 1 }, { adjustedPage: 73 }] } }
    expect(bookPageCount(book)).toBe(72)
    expect(wordPageMaximum(book)).toBe(73)
  })
})
