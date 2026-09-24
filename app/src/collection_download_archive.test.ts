import {expect,it} from 'vitest'
import {unzipSync,strFromU8} from 'fflate'
import {collectionDownloadArchive} from './collection_download_archive'
const bytes=new Uint8Array([0,1,255,50])
const batch={startIndex:20,nextIndex:21,bytes:4,entries:[{id:'original',name:'00021-original.bok',bytes,sha256:'a'.repeat(64)}]}
it('preserves original bytes and describes only this batch, never a complete collection',async()=>{
 const archive=await collectionDownloadArchive(batch,{title:'قسم',part:2,totalAvailableFiles:21,unavailable:[{id:'missing',title:'أصل مفقود',reason:'original_unavailable'}],signal:new AbortController().signal})
 const files=unzipSync(archive),manifest=JSON.parse(strFromU8(files['manifest.json']!))
 expect(files['00021-original.bok']).toEqual(bytes)
 expect(Object.keys(files)).toHaveLength(2)
 expect(manifest).toMatchObject({lastBatch:true,totalAvailableFiles:21,part:2,missingOriginalCount:1,originalsOnly:true,range:{start:20,end:21}})
 expect(manifest).not.toHaveProperty('completeCollection')
 expect(manifest.unavailable[0].title).toBe('أصل مفقود')
})
it('rejects cancellation before starting a worker',async()=>{
 const controller=new AbortController();controller.abort()
 await expect(collectionDownloadArchive(batch,{title:'قسم',part:1,totalAvailableFiles:1,unavailable:[],signal:controller.signal})).rejects.toMatchObject({name:'AbortError'})
})
it('settles cancellation during archive work instead of leaving a pending promise',async()=>{
 const controller=new AbortController()
 const pending=collectionDownloadArchive(batch,{title:'قسم',part:1,totalAvailableFiles:1,unavailable:[],signal:controller.signal})
 const rejected=expect(pending).rejects.toMatchObject({name:'AbortError'});controller.abort();await rejected
})
