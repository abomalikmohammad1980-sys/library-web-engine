import { describe, expect, it } from 'vitest'
import { groupBookEditions, normalizeWorkTitle } from './edition_groups'

describe('edition groups', () => {
  it('groups only repeated normalized work titles and orders newer editions first', () => {
    expect(normalizeWorkTitle('  كِتابُ العلم ـ (المختصر) ')).toBe('كتاب العلم المختصر')
    const groups = groupBookEditions([
      { id: 'a', title: 'كتاب العلم', author: 'أ', publicationYearHijri: 1400 },
      { id: 'b', title: 'كِتابُ العلم', author: 'أ', publicationYearHijri: 1440, edition: 'الثانية' },
      { id: 'c', title: 'كتاب آخر', author: 'ب' },
    ])
    expect(groups).toHaveLength(1); expect(groups[0]?.books.map(book => book.id)).toEqual(['b', 'a'])
  })
})
