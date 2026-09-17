import { beforeEach, describe, expect, it, vi } from 'vitest'
import { dismissRecommendation, dismissedRecommendationIds, restoreDismissedRecommendations } from './recommendation_preferences'

describe('recommendation preferences', () => {
  const values = new Map<string, string>()
  beforeEach(() => { values.clear(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }) })

  it('persists unique dismissals and restores them without touching books', () => {
    dismissRecommendation('b'); dismissRecommendation('b'); dismissRecommendation('c')
    expect(dismissedRecommendationIds()).toEqual(['b', 'c'])
    restoreDismissedRecommendations()
    expect(dismissedRecommendationIds()).toEqual([])
  })
})

