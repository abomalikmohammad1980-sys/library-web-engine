import { describe, expect, it } from 'vitest'
import { ReaderPreviewCache } from './reader_preview_cache'

describe('reader preview cache lifecycle', () => {
  it('stays bounded through 20 large-book open/close cycles', () => {
    const cache = new ReaderPreviewCache<{ page: number }>(8)
    for (let cycle = 0; cycle < 20; cycle++) {
      cache.set(`large-${cycle}`, { page: cycle })
      expect(cache.size).toBeLessThanOrEqual(8)
    }
    expect(cache.get('large-0')).toBeUndefined()
    expect(cache.get('large-19')).toEqual({ page: 19 })
    expect(cache.size).toBe(8)
  })

  it('refreshes a reopened preview before evicting the least recently used page', () => {
    const cache = new ReaderPreviewCache<number>(2)
    cache.set('zahr', 1); cache.set('published-largest', 2)
    expect(cache.get('zahr')).toBe(1)
    cache.set('third', 3)
    expect(cache.get('published-largest')).toBeUndefined()
    expect(cache.get('zahr')).toBe(1)
  })
})
