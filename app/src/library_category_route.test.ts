import { describe, expect, it } from 'vitest'
import { BOOK_CATEGORIES } from './library_metadata'
import { INVALID_LIBRARY_CATEGORY, libraryCategoryRoute } from './library_category_route'
import {categoryHref, matchesCategoryFilter, UNCATEGORIZED_CATEGORY} from './taxonomy_links'

describe('library category deep-link state', () => {
  it('opens old and new uncategorized links without treating them as invalid', () => {
    for (const category of ['غير مصنف', UNCATEGORIZED_CATEGORY]) {
      expect(libraryCategoryRoute(new URLSearchParams({category}))).toEqual({requested:true,valid:true,value:UNCATEGORIZED_CATEGORY})
    }
    expect(categoryHref('غير مصنف')).toBe('#/library?category=__uncategorized__')
    expect(matchesCategoryFilter(undefined, UNCATEGORIZED_CATEGORY)).toBe(true)
    expect(matchesCategoryFilter('غير مصنف', UNCATEGORIZED_CATEGORY)).toBe(true)
    expect(matchesCategoryFilter('العقيدة', UNCATEGORIZED_CATEGORY)).toBe(false)
  })
  it('canonicalizes the reported encoded category and every official category', () => {
    const reported = libraryCategoryRoute(new URLSearchParams('category=%D8%A7%D9%84%D8%B3%D9%8A%D8%A7%D8%B3%D8%A9+%D8%A7%D9%84%D8%B4%D8%B1%D8%B9%D9%8A%D8%A9+%D9%88%D8%A7%D9%84%D9%82%D8%B6%D8%A7%D8%A1'))
    expect(reported).toEqual({ requested: true, valid: true, value: 'السياسة الشرعية والقضاء' })
    expect(BOOK_CATEGORIES).toHaveLength(40)
    for (const category of BOOK_CATEGORIES) {
      expect(libraryCategoryRoute(new URLSearchParams({ category }))).toEqual({ requested: true, valid: true, value: category })
    }
  })

  it('accepts a still-encoded value and fails closed for unknown categories', () => {
    expect(libraryCategoryRoute(new URLSearchParams({ category: encodeURIComponent('العقيدة') })).value).toBe('العقيدة')
    expect(libraryCategoryRoute(new URLSearchParams({ category: 'تصنيف غير موجود' }))).toEqual({ requested: true, valid: false, value: INVALID_LIBRARY_CATEGORY })
    expect(libraryCategoryRoute(new URLSearchParams())).toEqual({ requested: false, valid: true, value: '' })
  })
})
