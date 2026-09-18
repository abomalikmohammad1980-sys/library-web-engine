import {it,expect,vi,afterEach} from 'vitest'
import {localSearchBookFingerprint} from './engine/word_volume_identity'
const calls=vi.hoisted(()=>({extract:vi.fn()}))
vi.mock('./engine/library_store',()=>({currentLibraryIdentityScope:()=> 'user:A',getBook:async()=>undefined,listStoredBooks:async()=>[],listBooks:async()=>[],listAuthorRecords:async()=>[]}))
vi.mock('./engine/local_docx_worker',()=>({extractLocalWordParagraphs:calls.extract}))
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules();vi.clearAllMocks()})
it('a ready old paragraph cache survives failure to persist its normalized upgrade without reparsing Word',async()=>{
 const book:any={id:'ready',ownerScope:'user:A',originalSha256:'ready-sha',sourceFormat:'word',fileName:'ready.docx',data:new Uint8Array([1]),title:'كتاب',author:'مؤلف'}
 const rows=[{index:1,text:'الفقرات الموجودة جاهزة للبحث'}]
 const fingerprint=await localSearchBookFingerprint(book)
 const entry={key:JSON.stringify(['user:A',book.id,fingerprint]),bookId:book.id,ownerScope:'user:A',fingerprint,paragraphs:rows,updatedAt:0}
 const request=(value:any)=>{const r:any={};queueMicrotask(()=>{r.result=value;r.onsuccess?.()});return r}
 const db={transaction:()=>({objectStore:()=>({get:()=>request(entry),put:()=>{throw new DOMException('Storage full','QuotaExceededError')}})})}
 vi.stubGlobal('indexedDB',{open:()=>request(db)});calls.extract.mockRejectedValue(Error('cached Word must not be reparsed'))
 const {persistentIndexedParagraphs}=await import('./engine/search_store')
 await expect(persistentIndexedParagraphs(book)).resolves.toEqual(rows)
 expect(calls.extract).not.toHaveBeenCalled()
})
it('a stalled optional normalized-cache upgrade never holds ready paragraphs hostage',async()=>{
 vi.useFakeTimers()
 try{
  const book:any={id:'ready-hang',ownerScope:'user:A',originalSha256:'sha-hang',sourceFormat:'word',fileName:'ready.docx',data:new Uint8Array([1])},rows=[{index:0,text:'نص مفهرس جاهز'}]
  const fingerprint=await localSearchBookFingerprint(book)
  const entry={key:JSON.stringify(['user:A',book.id,fingerprint]),bookId:book.id,ownerScope:'user:A',fingerprint,paragraphs:rows,updatedAt:0}
  const request=(value:any)=>{const r:any={};queueMicrotask(()=>{r.result=value;r.onsuccess?.()});return r},abort=vi.fn()
  const db={transaction:()=>({abort,objectStore:()=>({get:()=>request(entry),put:()=>{},index:()=>({openCursor:()=>request(null)})})})}
  vi.stubGlobal('indexedDB',{open:()=>request(db)});vi.stubGlobal('IDBKeyRange',{only:(value:any)=>value});calls.extract.mockRejectedValue(Error('must not reparse'))
  const {persistentIndexedParagraphs}=await import('./engine/search_store');let resolved=false
  const result=persistentIndexedParagraphs(book).then(value=>{resolved=true;return value})
  await vi.advanceTimersByTimeAsync(1);expect(resolved).toBe(true);expect(await result).toEqual(rows);expect(calls.extract).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1001);expect(abort).toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0)
 }finally{vi.useRealTimers()}
})
