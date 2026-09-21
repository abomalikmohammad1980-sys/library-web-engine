import {expect,it,vi,afterEach} from 'vitest'
import {parseVerifiedShamelaPack,prepareShamelaPackBook} from './shamela_pack_prepare'
const payload={contract:'shamela-sqlite-pack/book-1',workId:'shamela4_1:1673',metadata:{bookName:'فتح الباري',bookDate:852},authors:[],category:null,pages:[{sourceRowId:'1',sequence:0,part:'1',page:1,body:'نص محفوظ',foot:null}],titles:[]}
const entry={workId:payload.workId,counts:{pages:1,titles:0},sha256:'a'.repeat(64),catalog:{title:'فتح الباري',author:null,authorId:null,category:null,publicationYearHijri:null,rawSourceMetadata:null}}
afterEach(()=>vi.unstubAllGlobals())
it('keeps exact source bytes, page identities and derived text',()=>{
 const bytes=new TextEncoder().encode(JSON.stringify(payload)),book=parseVerifiedShamelaPack(bytes,entry)
 expect(book.data).toBe(bytes);expect(book.bokPages?.[0]).toMatchObject({id:1,text:'نص محفوظ',part:1,page:1});expect(book.extractedText).toBe('نص محفوظ')
 expect(()=>parseVerifiedShamelaPack(bytes,{...entry,counts:{pages:2,titles:0}})).toThrow('count_mismatch')
})
it('transfers large byte buffers to a bounded worker and terminates it on success',async()=>{
 const bytes=new Uint8Array(8*1024*1024),terminate=vi.fn(),post=vi.fn()
 class FakeWorker{onmessage:any;onerror:any;terminate=terminate;postMessage(data:any,transfer:any){post(data,transfer);queueMicrotask(()=>this.onmessage({data:{book:{id:'ok'}}}))}}
 vi.stubGlobal('Worker',FakeWorker)
 expect(await prepareShamelaPackBook(bytes,entry)).toEqual({id:'ok'})
 expect(post.mock.calls[0][1]).toEqual([bytes.buffer]);expect(terminate).toHaveBeenCalledOnce()
})
