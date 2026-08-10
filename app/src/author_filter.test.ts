import { describe, expect, it } from 'vitest'
import { authorNameMatches, filterAuthorEntries, nextAuthorVisibleCount, normalizeArabicAuthorName } from './author_filter'

describe('authors directory filtering', () => {
  it('normalizes Arabic marks and matches every contiguous partial query', () => {
    expect(normalizeArabicAuthorName('ابْنُ تَيْمِيَّة')).toBe('ابن تيميه')
    expect(authorNameMatches('شيخ الإسلام أحمد ابن تيمية الحراني', [], 'ابن تيمية')).toBe(true)
    expect(authorNameMatches('تيمية بن أحمد', [], 'ابن تيمية')).toBe(false)
    expect(authorNameMatches('ابن رشد', ['أحمد التيمي'], 'ابن تيمية')).toBe(false)
    expect(authorNameMatches('دعامة بن فلان', [], 'دع')).toBe(true)
    expect(authorNameMatches('دعامة بن فلان', [], 'دعا')).toBe(true)
  })

  it('matches within one alias but never combines text from separate aliases', () => {
    expect(authorNameMatches('أحمد الحراني', ['ابن تيمية'], 'ابن تيمية')).toBe(true)
    expect(authorNameMatches('أحمد الحراني', ['ابن رشد', 'تيمية الكبرى'], 'ابن تيمية')).toBe(false)
  })

  it('shows authors with books by default and can reveal the complete catalog', () => {
    const entries = [
      { value: 1, name: 'ابن تيمية', bookCount: 12 },
      { value: 2, name: 'ابن تيمية الصغير', bookCount: 0 },
    ]
    expect(filterAuthorEntries(entries, 'ابن تيمية', true).map(entry => entry.value)).toEqual([1])
    expect(filterAuthorEntries(entries, 'ابن تيمية', false).map(entry => entry.value)).toEqual([1, 2])
  })

  it('advances in bounded batches until every matching author is visible', () => {
    expect(nextAuthorVisibleCount(80, 205)).toBe(160)
    expect(nextAuthorVisibleCount(160, 205)).toBe(205)
    expect(nextAuthorVisibleCount(205, 205)).toBe(205)
  })
})
