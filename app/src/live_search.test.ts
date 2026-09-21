import { describe, expect, it } from 'vitest'
import { clearLiveSearchHistory, liveMetadataSuggestions, liveSearchHistory, nextLiveSearchOptionIndex, rememberLiveSearch } from './live_search'
import type { ShamelaAuthorIndex } from './shamela_author_index'

const index: ShamelaAuthorIndex = {
  contract: 'shamela-author-metadata-index/1', counts: { batches: 1, books: 3, authors: 2 }, categories: [],
  authors: [
    { authorId: 'a1', id: 'a1', name: 'ابن تيمية', bookCount: 2, books: [
      { id: '410000001', sourceBookId: '1', title: 'مجموع فتاوى ابن تيمية', batchId: 'batch-0000' },
      { id: '410000002', sourceBookId: '2', title: 'درء تعارض العقل والنقل', batchId: 'batch-0000' },
    ] },
    { authorId: 'a2', id: 'a2', name: 'محمد أبو زهرة', bookCount: 1, books: [
      { id: '410000003', sourceBookId: '3', title: 'ابن تيمية حياته وعصره', batchId: 'batch-0000' },
    ] },
  ],
}

describe('live metadata suggestions', () => {
  it('matches subject names only when enabled and retains visibility and scope fences',()=>{
    const categorized={...index,authors:index.authors.map(author=>({...author,books:author.books.map(book=>({...book,category:'العقيدة والتوحيد'}))}))}
    expect(liveMetadataSuggestions(categorized,'العقيدة')).toHaveLength(0)
    expect(liveMetadataSuggestions(categorized,'العقيدة',200,[],undefined,new Set(),true)).toHaveLength(3)
    expect(liveMetadataSuggestions(categorized,'العقيدة',200,[],new Set(['410000001','410000002']),new Set(['2']),true).map(x=>x.href)).toEqual(['#/reader/410000001'])
    expect(liveMetadataSuggestions(index,'شروح الحديث',200,[{id:'public',title:'شرح',author:'مؤلف',category:'شروح الحديث'}],undefined,new Set(),true)).toHaveLength(1)
  })
  it('keeps a bounded deduplicated local search history and clears it', () => {
    const values = new Map<string, string>(), storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value) }, removeItem: (key: string) => { values.delete(key) } }
    rememberLiveSearch('  الجنة   ورب النضر  ', storage)
    rememberLiveSearch('بحث ثان', storage)
    rememberLiveSearch('الجنة ورب النضر', storage)
    expect(liveSearchHistory(storage)).toEqual(['الجنة ورب النضر', 'بحث ثان'])
    for (let index = 0; index < 12; index++) rememberLiveSearch(`بحث ${index}`, storage)
    expect(liveSearchHistory(storage)).toHaveLength(8)
    clearLiveSearchHistory(storage)
    expect(liveSearchHistory(storage)).toEqual([])
  })
  it('wraps keyboard option navigation and handles an empty list', () => {
    expect(nextLiveSearchOptionIndex(-1, 3, 1)).toBe(0)
    expect(nextLiveSearchOptionIndex(-1, 3, -1)).toBe(2)
    expect(nextLiveSearchOptionIndex(2, 3, 1)).toBe(0)
    expect(nextLiveSearchOptionIndex(0, 3, -1)).toBe(2)
    expect(nextLiveSearchOptionIndex(0, 0, 1)).toBe(-1)
  })
  it('returns books whose title or author matches, without an author-page result', () => {
    const results = liveMetadataSuggestions(index, 'ابن تيمية', 10)
    expect(results.map(result => [result.kind, result.label])).toEqual([
      ['book', 'ابن تيمية حياته وعصره'],
      ['book', 'مجموع فتاوى ابن تيمية'],
      ['book', 'درء تعارض العقل والنقل'],
    ])
    expect(results.every(result => result.href.startsWith('#/reader/'))).toBe(true)
    expect(results[0]?.href).toBe('#/reader/410000003')
  })

  it('normalizes Arabic spelling and keeps short input closed', () => {
    expect(liveMetadataSuggestions(index, 'إبن تيمية', 10)).toHaveLength(3)
    expect(liveMetadataSuggestions(index, 'ا', 10)).toEqual([])
  })

  it('never leaks suggestions outside an explicit section book scope', () => {
    const published = [
      { id: 'inside', title: 'ديوان داخل القسم', author: 'شاعر', category: 'الشعر ودواوينه' },
      { id: 'outside', title: 'ديوان خارج القسم', author: 'شاعر', category: 'الأدب' },
    ]
    const results = liveMetadataSuggestions(index, 'ديوان', 10, published, new Set(['inside']))
    expect(results.map(result => result.label)).toEqual(['ديوان داخل القسم'])
    expect(results.some(result => result.href.includes('outside'))).toBe(false)
  })
  it('includes ready Word/PDF published works that are outside the Shamela author index', () => {
    const results = liveMetadataSuggestions(index, 'ديوان سيد قطب', 10, [
      { id: 'test-4a3e61ab3b660a72', title: 'ديوان سيد قطب؛ لعبد الباقي حسين', author: 'سيد قطب' },
    ])
    expect(results).toEqual([expect.objectContaining({
      kind: 'book', label: 'ديوان سيد قطب؛ لعبد الباقي حسين', href: '#/reader/test-4a3e61ab3b660a72',
    })])
  })
})
