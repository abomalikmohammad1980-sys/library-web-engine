import { describe,expect,it,vi } from 'vitest'
import { performance } from 'node:perf_hooks'
import { buildVerifiedSunnahSearchScope,completeSunnahSearchScope,previewVerifiedSunnahBooks,searchAllVerifiedSunnahBooks } from './sunnah_global_search'
import type { StoredBook } from './engine/library_store'
const book=(id:string,title:string,category='كتب السنة')=>({id:`410${id.padStart(6,'0')}`,sourceKind:'shamela4.1',sourceBookId:id,title,author:'مؤلف الكتاب',category} as StoredBook)
describe('verified full Sunnah search scope',()=>{it('includes Sahihayn and the four Sunan from documented metadata, not the 30-record witness sample',()=>{const scope=buildVerifiedSunnahSearchScope([book('735','صحيح البخاري'),book('1727','صحيح مسلم'),book('1726','سنن أبي داود'),book('1435','سنن الترمذي'),book('829','سنن النسائي'),book('1198','سنن ابن ماجه'),book('9','تفسير','التفسير')]);expect(scope.books.map(x=>x.sourceBookId)).toEqual(['735','829','1198','1435','1726','1727']);expect(scope.contract).toBe('sunnah-global-search-scope/1')});it('passes the complete documented scope to the routed index, keeps deep positions, and reports complete coverage under one second',async()=>{const scope=buildVerifiedSunnahSearchScope([book('735','صحيح البخاري'),book('1727','صحيح مسلم')]),search=vi.fn(async(_q,_o,_l,ids)=>({total:1,offset:0,limit:40,hits:[{id:'735:8',bookId:'735',paragraphIndex:7,text:'إنما الأعمال بالنيات',matchOffset:0}],unavailableBookIds:[],pendingBookIds:[],coverageComplete:true})),started=performance.now(),page=await searchAllVerifiedSunnahBooks({search} as never,scope,'إنما الأعمال بالنيات');expect(performance.now()-started).toBeLessThan(1000);expect(search).toHaveBeenCalledWith('إنما الأعمال بالنيات',0,40,['410000735','410001727']);expect(page.scopeCoverageComplete).toBe(true);expect(page.hits[0]?.paragraphIndex).toBe(7)});it('fails closed in coverage when any scoped shard is unavailable',async()=>{const scope=buildVerifiedSunnahSearchScope([book('735','صحيح البخاري')]),page=await searchAllVerifiedSunnahBooks({search:async()=>({total:0,offset:0,limit:40,hits:[],unavailableBookIds:['735'],pendingBookIds:[],coverageComplete:true})} as never,scope,'حديث');expect(page.scopeCoverageComplete).toBe(false)})})

it('keeps an early scoped page explicitly incomplete and leaves the exhaustive search as the authority',async()=>{
 const scope=buildVerifiedSunnahSearchScope([book('735','صحيح البخاري')])
 const searchBoundedV2=vi.fn(async()=>({total:900,offset:0,limit:20,hits:[{id:'735:8',bookId:'735',paragraphIndex:7,text:'الحج عرفة',matchOffset:0}],unavailableBookIds:[],pendingBookIds:[],coverageComplete:false}))
 const page=await previewVerifiedSunnahBooks({searchBoundedV2} as never,scope,'الحج عرفة',20)
 expect(searchBoundedV2).toHaveBeenCalledWith('الحج عرفة',0,20,['410000735'],undefined)
 expect(page.hits).toHaveLength(1)
 expect(page.scopeCoverageComplete).toBe(false)
})

it('يفتح نطاق الكتالوج عند إعادة التحميل قبل اكتمال IndexedDB ويعيد طلب الدفعة المتقطعة',async()=>{
  const empty=buildVerifiedSunnahSearchScope([])
  expect(empty.books).toEqual([])
  let batchAttempts=0
  const fetcher=vi.fn(async(input:RequestInfo|URL)=>{
    const url=String(input)
    if(url.endsWith('catalog.json'))return new Response(JSON.stringify({batches:[{manifest:'./batch.json'}]}),{status:200})
    batchAttempts++
    if(batchAttempts===1)throw new TypeError('transient reload race')
    return new Response(JSON.stringify({books:[{bookId:'735',catalog:{title:'صحيح البخاري',author:'الإمام البخاري',authorId:'215',deathYearHijri:256,category:'كتب السنة'}}]}),{status:200})
  }) as typeof fetch
  const complete=await completeSunnahSearchScope(empty,fetcher)
  expect(complete.books).toEqual([{publicId:'410000735',sourceBookId:'735',title:'صحيح البخاري',category:'كتب السنة',author:'الإمام البخاري',authorId:'shamela-author-215',deathYearHijri:256}])
  expect(batchAttempts).toBe(2)
})

it.each(['ar', 'fr'])('يبني النطاق canonical من الكتالوج بلا اعتماد على هوية IndexedDB أو لغة الواجهة %s', async locale => {
  const staleLocal = {
    ...book('735', locale === 'ar' ? 'عنوان محلي قديم' : 'Ancien titre'),
    id: 'local-invalid-id',
    sourceKind: 'imported',
  } as StoredBook
  const localScope = buildVerifiedSunnahSearchScope([staleLocal])
  expect(localScope.books).toEqual([])
  const fetcher = (async (input: RequestInfo | URL) => String(input).endsWith('catalog.json')
    ? new Response(JSON.stringify({ batches: [{ manifest: './batch.json' }] }), { status: 200 })
    : new Response(JSON.stringify({ books: [{ bookId: '735', catalog: { title: 'صحيح البخاري', author: 'الإمام البخاري', category: 'كتب السنة' } }] }), { status: 200 })) as typeof fetch
  const complete = await completeSunnahSearchScope(localScope, fetcher)
  expect(complete.books).toEqual([{ publicId: '410000735', sourceBookId: '735', title: 'صحيح البخاري', category: 'كتب السنة', author: 'الإمام البخاري' }])
})
