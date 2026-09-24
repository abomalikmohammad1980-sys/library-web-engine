import {it,expect} from 'vitest'
import {installSubjectCategories,canonicalSubjectCategory,subjectCategoryNames} from './subject_categories'
import {BOOK_CATEGORIES} from './library_metadata'
import {effectiveBookCategory,categoryHref,matchesCategoryFilter} from './taxonomy_links'
import {libraryCategoryRoute} from './library_category_route'
it('keeps old names and stable IDs attached after a rename',()=>{
 installSubjectCategories([{id:'subject:3',name:'التفسير وعلومه',aliases:['التفسير','التفاسير','التفسير وعلومه'],revision:2}])
 expect(canonicalSubjectCategory('التفسير')).toBe('التفسير وعلومه')
 expect(canonicalSubjectCategory('subject:3')).toBe('التفسير وعلومه')
 expect(subjectCategoryNames()).toEqual(['التفسير وعلومه'])
 expect(BOOK_CATEGORIES.map(x=>x)).toEqual(['التفسير وعلومه'])
 expect([...BOOK_CATEGORIES]).toEqual(['التفسير وعلومه'])
 expect(BOOK_CATEGORIES.filter(Boolean)).toEqual(['التفسير وعلومه'])
 expect(effectiveBookCategory({category:'التفسير'})).toBe('التفسير وعلومه')
 expect(categoryHref('التفسير')).toContain(encodeURIComponent('التفسير وعلومه'))
 expect(matchesCategoryFilter('التفسير','التفسير وعلومه')).toBe(true)
 expect(libraryCategoryRoute(new URLSearchParams({category:'التفسير'})).value).toBe('التفسير وعلومه')
})
it('rejects conflicting alias ownership atomically',()=>{
 expect(()=>installSubjectCategories([{id:'subject:1',name:'أ',aliases:['أ'],revision:1},{id:'subject:2',name:'ب',aliases:['أ','ب'],revision:1}])).toThrow()
 expect(canonicalSubjectCategory('التفسير')).toBe('التفسير وعلومه')
})
