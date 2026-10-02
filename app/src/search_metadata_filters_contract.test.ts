import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
vi.mock('./engine/library_store',()=>({currentLibraryIdentityScope:()=> 'guest:metadata-test',listBooks:vi.fn(),listAuthorRecords:async()=>[],canonicalAuthorName:(value:string)=>value}))
import {listBooks,type StoredBook} from './engine/library_store'
import {searchAllBooks} from './engine/search_store'
import {installSubjectCategories} from './subject_categories'

describe('expanded search metadata filters', () => {
  it('indexes coauthors, tags and category and exposes real category/death filters', () => {
    const screen = readFileSync(new URL('./screens/search.ts', import.meta.url), 'utf8')
    expect(screen).toContain("multiChoice('التصنيفات'")
    expect(screen).toContain("labeledSelect('القرن الهجري'")
    expect(screen).toContain("'قبل الهجرة'")
    expect(screen).toContain("'معاصر'")
    expect(screen).toContain("'شجرة العناوين'")
    expect(screen).toContain("'بطاقات الكتب'")
    expect(screen).toContain("'سنة وفاة المؤلف من'")
    expect(screen).toContain('authors: author.values()')
    expect(screen).toContain("['death', 'وفيات المؤلفين']")
    expect(screen).toContain('values.sort(compareSearchResultsByDeath)')
    expect(screen).not.toContain("'غير متاحين في بيانات الكتب الحالية'")
    // المسح يعيد كل مرشحات البحث الحالية، بما فيها المرشحات المضافة لاحقًا؛
    // لا يثبت العقد ترتيب الخصائص النصي داخل الكائن.
    for (const field of ['category', 'books', 'authors', 'categories', 'century', 'from', 'to', 'fields', 'sort']) {
      expect(screen).toMatch(new RegExp(`${field}: null`))
    }
  })
  it('searches actual metadata and refreshes cached category text after rename',async()=>{
    const book={id:'private-meta',title:'كتاب',author:'الأول',authors:[{name:'الأول'},{name:'الثاني'}],category:'التفسير',description:'مسألة مميزة',tags:[{name:'موضوع مميز',source:'manual'}],fileName:'test.txt',sourceFormat:'text'} as unknown as StoredBook
    vi.mocked(listBooks).mockResolvedValue([book])
    const category=await searchAllBooks('التفسير',{fields:['category']})
    expect(category.map(row=>row.bookId)).toEqual(['private-meta'])
    expect((await searchAllBooks('مسألة',{fields:['card'],authors:['الثاني']})).map(row=>row.bookId)).toEqual(['private-meta'])
    expect((await searchAllBooks('موضوع',{fields:['tag']})).map(row=>row.bookId)).toEqual(['private-meta'])
    installSubjectCategories([{id:'subject:3',name:'علوم التنزيل',aliases:['التفسير','علوم التنزيل'],revision:2}])
    const renamed=await searchAllBooks('التنزيل',{fields:['category'],categories:['التفسير']})
    expect(renamed.map(row=>row.category)).toEqual(['علوم التنزيل'])
  })

})
