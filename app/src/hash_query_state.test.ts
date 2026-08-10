import { describe, expect, it } from 'vitest'
import { hashWithQuery } from './hash_query_state'

describe('hash query state', () => {
  it('replaces filters without history entries and removes cleared values', () => {
    const uncategorized = hashWithQuery('#/library', { category: '__uncategorized__', q: 'أصول' })
    expect(uncategorized).toContain('category=__uncategorized__')
    const creed = hashWithQuery(uncategorized, { category: 'العقيدة' })
    expect(new URLSearchParams(creed.split('?')[1]).get('category')).toBe('العقيدة')
    expect(hashWithQuery(creed, { category: null })).toBe('#/library?q=%D8%A3%D8%B5%D9%88%D9%84')
  })

  it('preserves unrelated filters while updating author and year fields', () => {
    const hash = hashWithQuery('#/library?category=x', { author: 'أحمد', from: 100, to: 200 })
    const params = new URLSearchParams(hash.split('?')[1])
    expect(Object.fromEntries(params)).toEqual({ category: 'x', author: 'أحمد', from: '100', to: '200' })
  })
})

