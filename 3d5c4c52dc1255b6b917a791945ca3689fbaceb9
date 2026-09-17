import { describe, expect, it, vi } from 'vitest'
import { bestEffortClone } from './reader_cache'

describe('reader page cache', () => {
  it('returns a successful clone', () => {
    expect(bestEffortClone({ page: 1 }, source => ({ ...source }))).toEqual({ page: 1 })
  })

  it('turns a platform clone failure into a cache miss instead of a reader failure', () => {
    const failure = vi.fn()
    expect(bestEffortClone({ page: 1 }, () => { throw new DOMException('private detail', 'DataCloneError') }, failure)).toBeUndefined()
    expect(failure).toHaveBeenCalledOnce()
  })
})
