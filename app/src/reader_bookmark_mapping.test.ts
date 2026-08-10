import { describe, expect, it } from 'vitest'
import { pageIndexForBookmark } from './reader_bookmark_mapping'

describe('reader bookmark mapping', () => {
  it('maps side TOC and internal links through the same rendered page group', () => {
    const pages = [
      { querySelectorAll: () => [] },
      { querySelectorAll: () => [{ id: 'chapter-8' }] },
      { querySelectorAll: () => [{ id: 'chapter-19' }] },
    ] as unknown as ParentNode[]
    const sideTarget = pageIndexForBookmark(pages, 'chapter-19')
    const internalTarget = pageIndexForBookmark(pages, 'chapter-19')
    expect(sideTarget).toBe(2)
    expect(internalTarget).toBe(sideTarget)
    expect(pageIndexForBookmark(pages, 'missing')).toBe(-1)
  })
})

