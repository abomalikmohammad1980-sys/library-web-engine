import {expect,it} from 'vitest'
import {pageMetaFor,seoShard,PUBLIC_PAGE_META} from './page_meta_model'
it('keeps the homepage brand consistent with its main heading',()=>{
 expect(pageMetaFor('/').title).toBe('الخزانة: المكتبة الإسلامية الذكية')
 expect(pageMetaFor('/').description).toContain('فهارس المحتويات')
})
it('uses real identities and query-free canonicals for every public route',()=>{
 for(const [path,[title]] of Object.entries(PUBLIC_PAGE_META))expect(pageMetaFor(path)).toMatchObject({title,canonicalPath:path,robots:'index, follow'})
 expect(pageMetaFor('/authors/000020',{id:'000020',name:'الشافعي',biography:'<p>فقيه ومؤلف</p>'})).toMatchObject({title:'الشافعي: سيرته وكتبه | الخِزانة',description:'فقيه ومؤلف'})
 expect(pageMetaFor('/books/21633?pageIndex=3',{id:'21633',title:'الكتاب',author:'المؤلف',category:'الحديث',deathYearHijri:581})).toMatchObject({title:'الكتاب — المؤلف | الخِزانة',canonicalPath:'/books/21633',description:expect.stringContaining('581 هـ')})
})
it('never assigns a canonical to private, search or unresolved identities',()=>{
 for(const path of ['/settings','/search?q=x','/me','/books/local%3Aone','/authors/999999','/authors?create=1'])expect(pageMetaFor(path)).toMatchObject({robots:'noindex, follow'})
 for(const path of ['/settings','/search?q=x','/books/local%3Aone'])expect(pageMetaFor(path).canonicalPath).toBeUndefined()
 expect(seoShard('000020')).toBe('04');expect(()=>seoShard('../20')).toThrow()
})
