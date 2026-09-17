import {expect,it} from 'vitest'
import {readFileSync} from 'node:fs'
import {pageMetaFor,seoShard,PUBLIC_PAGE_META,buildBookDescription,truncateSeoDescription,publicPageHeading,publicPaginationCanonicalPath} from './page_meta_model'
it('uses safe labelled Arabic descriptions without case inflection or repeated section prefixes',()=>{
 const description=buildBookDescription({id:'1',title:'كتاب السنة',author:'أبو موسى',deathYearHijri:581,category:'كتب السنة'})
 expect(description).toBe('كتاب السنة — المؤلف: أبو موسى (ت 581 هـ). القسم: كتب السنة. اقرأ الكتاب كاملًا وتصفح فهرس محتوياته في الخِزانة.')
 expect(buildBookDescription({id:'1',title:'<b>كتاب</b>',author:'أبي موسى'})).toBe('كتاب — المؤلف: أبي موسى. اقرأ الكتاب كاملًا وتصفح فهرس محتوياته في الخِزانة.')
 expect(description).not.toMatch(/كتب كتب|تأليف أب[وي]/)
})
it('truncates at a complete word, including the exact 155-character boundary',()=>{
 const prefix='أ'.repeat(150)
 expect(truncateSeoDescription(`${prefix} كلمة المزيد`)).toBe(`${prefix} كلمة`)
 expect(truncateSeoDescription(`${prefix} كلمات المزيد`)).toBe(prefix)
 expect(truncateSeoDescription('أ'.repeat(156))).toBe('')
 expect(truncateSeoDescription('سطر\n آخر')).toBe('سطر آخر')
})
it('keeps short static H1 headings separate from unchanged page titles',()=>{
 const expected={'/':'الخزانة','/features':'ميزات الخِزانة','/quran':'القرآن الكريم','/sunnah':'السنة النبوية','/authors':'المؤلفون','/browse':'تصفح الكتب','/new-books':'جديد الكتب'}
 for(const [path,heading] of Object.entries(expected)){
  expect(publicPageHeading(path+'?page=2')).toBe(heading)
  expect(pageMetaFor(path).title).toBe(PUBLIC_PAGE_META[path][0])
 }
 expect(publicPageHeading('/books/21633')).toBeUndefined()
 expect(publicPageHeading('/unknown')).toBeUndefined()
})
it('all catalog book descriptions avoid repeated categories and inflected author templates',()=>{
 const index=JSON.parse(readFileSync(new URL('../public/data/shamela-author-index.json',import.meta.url),'utf8'))
 const catalog=JSON.parse(readFileSync(new URL('../public/data/shamela-catalog.snapshot.json',import.meta.url),'utf8'))
 const authors=new Map<string,{name:string;deathYearHijri?:number}>()
 for(const author of index.authors)for(const book of author.books)authors.set(String(book.sourceBookId),author)
 let checked=0
 for(const batch of catalog.batches)for(const book of batch.books){
  const author=authors.get(String(book.bookId))
  const record={id:String(book.bookId),title:book.catalog.title,author:author?.name??book.catalog.author,category:book.catalog.category,deathYearHijri:author?.deathYearHijri}
  const description=pageMetaFor('/books/'+record.id,record).description
  expect(description,record.id).not.toMatch(/كتب\s+كتب|تأليف\s+أب[وي]/)
  expect(description.length,record.id).toBeLessThanOrEqual(155)
  expect(description.length,record.id).toBeGreaterThan(0)
  expect(description,record.id).toBe(description.trim())
  checked++
 }
 expect(checked).toBe(catalog.bookCount)
 expect(checked).toBeGreaterThan(0)
})
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
it('canonicalizes positive public listing pages without losing fixed metadata',()=>{
 for(const path of ['/authors','/browse','/new-books']){
  expect(pageMetaFor(path+'?page=1').canonicalPath).toBe(path)
  expect(pageMetaFor(path+'?page=2&utm_source=x#section')).toMatchObject({canonicalPath:path+'?page=2',robots:'index, follow',title:PUBLIC_PAGE_META[path][0]})
  expect(publicPaginationCanonicalPath(path+'?page=002')).toBe(path+'?page=2')
 }
 const author={id:'000020',name:'الشافعي',biography:'ترجمته'}
 expect(pageMetaFor('/authors/000020?page=2',author)).toMatchObject({canonicalPath:'/authors/000020?page=2',title:'الشافعي: سيرته وكتبه | الخِزانة',robots:'index, follow'})
 expect(pageMetaFor('/authors/000020?page=1',author).canonicalPath).toBe('/authors/000020')
})
it('does not create canonical query URLs from malformed, ambiguous or non-listing state',()=>{
 for(const query of ['page=0','page=-1','page=1.5','page=NaN','page=','page=2&page=3','page=1000001','page=9007199254740992','page=2%23bad'])expect(publicPaginationCanonicalPath('/authors?'+query)).toBe('/authors')
 for(const path of ['/quran','/sunnah','/features','/books/21633','/books/local/abc'])expect(publicPaginationCanonicalPath(path+'?page=2')).toBe(path)
 expect(pageMetaFor('/authors?page=2&create=1')).toMatchObject({robots:'noindex, follow'})
 expect(pageMetaFor('/authors?page=2&create=1').canonicalPath).toBeUndefined()
 expect(pageMetaFor('/authors/999999?page=2').canonicalPath).toBeUndefined()
 expect(pageMetaFor('/search?page=2&q=x').canonicalPath).toBeUndefined()
})
