import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest'
const saved=vi.hoisted(()=>({book:undefined as unknown}))
vi.mock('./engine/library_store',async importOriginal=>({...await importOriginal<typeof import('./engine/library_store')>(),getBook:vi.fn(async()=>saved.book)}))
import {ensureShamelaBookReady,materializeShamelaPackBook} from './shamela_pack_seed'
import {getBook} from './engine/library_store'
describe('saved BOK offline audit',()=>{
 beforeEach(()=>{
  const values=new Map<string,string>();vi.stubGlobal('localStorage',{getItem:(key:string)=>values.get(key)??null,setItem:(key:string,value:string)=>values.set(key,value)})
  const raw={contract:'shamela-sqlite-pack/book-1' as const,workId:'shamela4_1:1001',metadata:{bookName:'كتاب محفوظ',bookDate:null,categoryId:null,metaDataRaw:null},authors:[],category:null,pages:[1,2,3].map(n=>({sourceRowId:String(n),sequence:n-1,part:'1',page:n,body:`نص الصفحة ${n}`,foot:null})),titles:[]}
  saved.book=materializeShamelaPackBook(raw,new TextEncoder().encode(JSON.stringify(raw)),'verified-fixture')
 })
 afterEach(()=>vi.unstubAllGlobals())
 it('reads local storage during visibility lookup without exposing a hidden book',async()=>{
  vi.stubGlobal('navigator',{onLine:true})
  let finish!: (value:Response)=>void
  const fetcher=vi.fn(()=>new Promise<Response>(resolve=>{finish=resolve}))
  vi.stubGlobal('fetch',fetcher);vi.mocked(getBook).mockClear()
  const opening=ensureShamelaBookReady('410001001')
  let settled=false;void opening.then(()=>{settled=true},()=>{settled=true})
  await Promise.resolve()
  expect(getBook).toHaveBeenCalledWith('410001001')
  expect(settled).toBe(false)
  finish(new Response(JSON.stringify({schemaVersion:1,overrides:[{bookId:'410001001',visibility:'hidden',logicallyDeleted:true}]})))
  await expect(opening).rejects.toThrow('shamela_pack_book_not_found')
 })
 it('opens a complete cached book without any network request offline',async()=>{
  const fetcher=vi.fn(async()=>{throw new TypeError('offline')});vi.stubGlobal('fetch',fetcher);vi.stubGlobal('navigator',{onLine:false})
  const restored=await ensureShamelaBookReady('410001001')
  expect(restored).toEqual(saved.book);expect(restored.bokPages?.at(-1)?.text).toBe('نص الصفحة 3')
  expect(restored.bokPages?.map(page=>({page:page.page,text:page.text}))).toEqual([1,2,3].map(page=>({page,text:`نص الصفحة ${page}`})))
  expect(fetcher).not.toHaveBeenCalled()
 })
 it('does not wait for a hung network when the complete book is already offline',async()=>{
  const fetcher=vi.fn(()=>new Promise<Response>(()=>{}));vi.stubGlobal('fetch',fetcher);vi.stubGlobal('navigator',{onLine:false})
  const result=await Promise.race([ensureShamelaBookReady('410001001'),new Promise(resolve=>setTimeout(()=>resolve('timed-out'),150))])
  expect(result).toEqual(saved.book);expect(fetcher).not.toHaveBeenCalled()
 })
 it.each([{visibility:'hidden',logicallyDeletedAt:undefined},{visibility:'public',logicallyDeletedAt:123}])('respects restrictions already applied to the local record: %j',async restriction=>{
  const previous=saved.book;saved.book={...previous as object,...restriction};vi.stubGlobal('navigator',{onLine:false});const fetcher=vi.fn();vi.stubGlobal('fetch',fetcher)
  await expect(ensureShamelaBookReady('410001001')).rejects.toThrow('shamela_pack_book_not_found');expect(fetcher).not.toHaveBeenCalled();saved.book=previous
 })
 it('keeps a known central deletion across a fresh offline lookup',async()=>{
  vi.stubGlobal('navigator',{onLine:true});const fetcher=vi.fn(async()=>new Response(JSON.stringify({schemaVersion:1,overrides:[{bookId:'410001001',visibility:'hidden',logicallyDeleted:true}]})));vi.stubGlobal('fetch',fetcher)
  await expect(ensureShamelaBookReady('410001001')).rejects.toThrow('shamela_pack_book_not_found')
  expect(localStorage.getItem('alkhizana:central-book-overrides:v1')).toContain('410001001')
  fetcher.mockClear();vi.stubGlobal('navigator',{onLine:false})
  await expect(ensureShamelaBookReady('410001001')).rejects.toThrow('shamela_pack_book_not_found');expect(fetcher).not.toHaveBeenCalled()
 })
})
