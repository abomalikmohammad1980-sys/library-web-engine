import { describe, expect, it } from 'vitest'
import { bookPageCount, bookVolumeCount, cacheReaderPageCount, cachedReaderPageCount, clearCachedReaderPageCount, wordPageMaximum } from './book_page_count'
import { beforeEach, vi } from 'vitest'

describe('book page count source', () => {
  it('counts an image collection as pages, not printed volumes',()=>{expect(bookVolumeCount({sourceFormat:'jpeg',volumes:[{},{}]})).toBe(1);expect(bookPageCount({sourceFormat:'jpeg',physicalPageCount:2})).toBe(2)})
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

  it('uses visible PDF and derived textual page totals without inventing a count', () => {
    expect(bookPageCount({ physicalPageCount: 186 })).toBe(186)
    expect(bookPageCount({ readerPageCount: 42 })).toBe(42)
    expect(bookPageCount({})).toBe(0)
  })

  it('counts actual BOK pages across multiple or single parts', () => {
    const multi = { physicalPageCount: 99, volumeCount: 9, bokPages: [{ part: 1 }, { part: 1 }, { part: 2 }, { part: 3 }] }
    expect(bookPageCount(multi)).toBe(4)
    expect(bookVolumeCount(multi)).toBe(3)
    expect(bookVolumeCount({ bokPages: [{ part: 1 }, { part: 1 }] })).toBe(1)
  })
})
