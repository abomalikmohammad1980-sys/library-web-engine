import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dueAnnotationIds, dueReviewCount, listSpacedReviews, makeReviewDueNow, nextReviewAt, recordReview, removeSpacedReview, reviewTiming } from './spaced_review'

describe('spaced review schedule', () => {
  const values = new Map<string, string>()
  beforeEach(() => { values.clear(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }) })

  it('advances remembered items and resets difficult items to tomorrow', () => {
    const first = recordReview('a', 'remembered', 0)
    expect(first.intervalDays).toBe(1)
    expect(nextReviewAt('a')).toBe(86_400_000)
    expect(nextReviewAt('missing')).toBeNull()
    expect(reviewTiming('a', 1)).toBe('scheduled')
    expect(reviewTiming('a', 86_400_000)).toBe('due')
    expect(reviewTiming('missing', 1)).toBeNull()
    expect(makeReviewDueNow('missing', 2)).toBe(false)
    expect(dueAnnotationIds(['a', 'b'], 100)).toEqual(new Set(['b']))
    const second = recordReview('a', 'remembered', first.dueAt)
    expect(second.intervalDays).toBe(3)
    expect(recordReview('a', 'again', second.dueAt).intervalDays).toBe(1)
    expect(dueReviewCount(['a', 'b'], second.dueAt + 1)).toBe(1)
    expect(makeReviewDueNow('a', second.dueAt + 2)).toBe(true)
    expect(reviewTiming('a', second.dueAt + 2)).toBe('due')
    removeSpacedReview('a')
    expect(listSpacedReviews()).toEqual([])
  })
})
