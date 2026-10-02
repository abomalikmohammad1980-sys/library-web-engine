import { describe, expect, it } from 'vitest'
import { categoryHref, matchesCategoryFilter, UNCATEGORIZED_CATEGORY } from './taxonomy_links'

describe('uncategorized category query contract', () => {
  const books = [{ category: undefined }, { category: '' }, { category: 'الحديث' }, { category: 'غير مصنف' }]

  it('maps the display gateway to a sentinel and includes the visible legacy label', () => {
    expect(categoryHref()).toBe(`#/library?category=${UNCATEGORIZED_CATEGORY}`)
    expect(books.filter(book => matchesCategoryFilter(book.category, UNCATEGORIZED_CATEGORY))).toHaveLength(3)
  })

  it('treats the Arabic legacy label as the same filterable category', () => {
    expect(categoryHref('غير مصنف')).toBe(`#/library?category=${UNCATEGORIZED_CATEGORY}`)
    expect(books.filter(book => matchesCategoryFilter(book.category, 'غير مصنف'))).toHaveLength(3)
  })
})
