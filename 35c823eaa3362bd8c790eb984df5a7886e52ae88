import { describe, expect, it } from 'vitest'
import { categoryHref, matchesCategoryFilter, UNCATEGORIZED_CATEGORY } from './taxonomy_links'

describe('uncategorized category query contract', () => {
  const books = [{ category: undefined }, { category: '' }, { category: 'الحديث' }, { category: 'غير مصنف' }]

  it('maps the display gateway to a sentinel and filters only missing categories', () => {
    expect(categoryHref()).toBe(`#/library?category=${UNCATEGORIZED_CATEGORY}`)
    expect(books.filter(book => matchesCategoryFilter(book.category, UNCATEGORIZED_CATEGORY))).toHaveLength(2)
  })

  it('does not collide with a literal category carrying the Arabic label', () => {
    expect(categoryHref('غير مصنف')).toContain(encodeURIComponent('غير مصنف'))
    expect(books.filter(book => matchesCategoryFilter(book.category, 'غير مصنف'))).toEqual([{ category: 'غير مصنف' }])
  })
})
