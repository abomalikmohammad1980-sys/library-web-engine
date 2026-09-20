import {afterEach,expect,it,vi} from 'vitest'
vi.mock('./shamela_pack_seed',()=>({
 readCompleteShamelaLibraryCatalog:async()=>[],
 loadCentralBookOverrides:async()=>{throw Error('visibility_unavailable')},
 applyCentralOverridesToBookList:(books:unknown)=>books,
 materializeAvailableShamelaCatalogBooks:()=>[],
}))
afterEach(()=>{vi.unstubAllGlobals();vi.resetModules()})
it('rejects an unavailable visibility gate instead of leaving the library promise pending',async()=>{
 vi.stubGlobal('indexedDB',{open:()=>{
  const req:any={result:{transaction:()=>({objectStore:()=>({getAll:()=>{
   const read:any={result:[]};queueMicrotask(()=>read.onsuccess());return read
  }})})}}
  queueMicrotask(()=>req.onsuccess());return req
 }})
 const {listBooks}=await import('./engine/library_store')
 await expect(listBooks({requireCompleteCatalog:true})).rejects.toThrow('visibility_unavailable')
})
