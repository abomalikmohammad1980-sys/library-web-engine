import {expect,it,vi} from 'vitest'
import {boundCollectionOriginals,planCollectionOriginals,type CollectionOriginalBook} from './collection_originals'
import {prepareCollectionBatch} from './collection_download_batch'
const text=new TextEncoder()
const book:CollectionOriginalBook={id:'1',title:'كتاب',fileName:'original.html',data:text.encode('<p>أصل</p>'),sourceFormat:'html',mimeType:'text/html'}
it('does not substitute published reading JSON for an unavailable BOK original',async()=>{
 const resolve=vi.fn(async()=>({...book,fileName:'1.json',data:text.encode('{"pages":[]}'),sourceFormat:'shamela-bok'}))
 const plan=await planCollectionOriginals([book],resolve,new AbortController().signal,()=>true)
 expect(plan.assets).toEqual([]);expect(plan.unavailable[0]?.reason).toBe('original_unavailable')
})
it('deduplicates refs and exports the exact original bytes',async()=>{
 const resolve=vi.fn(async()=>book),signal=new AbortController().signal
 const plan=await planCollectionOriginals([book,book],resolve,signal,()=>true)
 expect(plan.assets).toHaveLength(1);expect(resolve).toHaveBeenCalledTimes(1)
 const batch=await prepareCollectionBatch(plan.assets,0,signal)
 expect(batch.entries[0]?.bytes).toEqual(book.data)
 expect(batch.entries[0]?.name).toBe('00001-original.html')
})
it('fails closed when identity changes after preparation',async()=>{
 let current=true
 const plan=await planCollectionOriginals([book],async()=>book,new AbortController().signal,()=>current)
 current=false
 await expect(plan.assets[0]!.load(new AbortController().signal)).rejects.toMatchObject({name:'AbortError'})
})
it('detects original replacement between planning and download',async()=>{
 let current=book
 const signal=new AbortController().signal,plan=await planCollectionOriginals([book],async()=>current,signal,()=>true)
 current={...book,data:text.encode('<p>بديل</p>')}
 await expect(prepareCollectionBatch(plan.assets,0,signal)).rejects.toThrow(/length|digest/)
})
it('does not silently export an incomplete multi-volume book',async()=>{
 const partial={...book,volumes:[{number:1,fileName:'a.html',data:book.data},{number:2,fileName:'b.html',data:new Uint8Array()}]}
 const plan=await planCollectionOriginals([book],async()=>partial,new AbortController().signal,()=>true)
 expect(plan.assets).toHaveLength(0);expect(plan.unavailable).toHaveLength(1)
})
it('records unavailable books without labelling the collection complete',async()=>{
 const plan=await planCollectionOriginals([book],async()=>undefined,new AbortController().signal,()=>true)
 expect(plan.unavailable).toEqual([{id:'1',title:'كتاب',reason:'missing'}])
})
it('prefers retained original bytes over a derived reading representation',async()=>{
 const original=text.encode('<html><body>الأصل المحفوظ</body></html>')
 const stored={...book,data:text.encode('derived reading text'),sourceData:original,sourceMimeType:'text/html'}
 const signal=new AbortController().signal
 const plan=await planCollectionOriginals([book],async()=>stored,signal,()=>true)
 const batch=await prepareCollectionBatch(plan.assets,0,signal)
 expect(batch.entries[0]?.bytes).toEqual(original)
})
it('accepts retained BOK bytes but never manufactures them from JSON',async()=>{
 const sourceData=new Uint8Array(64)
 sourceData.set(text.encode('Standard Jet DB'),4)
 const stored={...book,fileName:'1.catalog.json',sourceFormat:'shamela-bok',data:text.encode('{"pages":[]}'),sourceData}
 const signal=new AbortController().signal
 const plan=await planCollectionOriginals([book],async()=>stored,signal,()=>true)
 const batch=await prepareCollectionBatch(plan.assets,0,signal)
 expect(batch.entries[0]?.name).toBe('00001-1.bok')
 expect(batch.entries[0]?.bytes).toEqual(sourceData)
})
it('keeps smaller originals downloadable when one file exceeds the browser limit',()=>{
 const load=vi.fn(async()=>new Response('original'))
 const plan=boundCollectionOriginals({assets:[
  {id:'large',fileName:'large.bok',bytes:64*1024*1024+1,load},
  {id:'small',fileName:'small.bok',bytes:8,load},
 ],unavailable:[{id:'missing',title:'ملف مفقود',reason:'missing'}]},64*1024*1024)
 expect(plan.assets.map(asset=>asset.id)).toEqual(['small'])
 expect(plan.unavailable).toEqual([
  {id:'missing',title:'ملف مفقود',reason:'missing'},
  {id:'large',title:'large.bok',reason:'size_limit'},
 ])
 expect(load).not.toHaveBeenCalled()
})
