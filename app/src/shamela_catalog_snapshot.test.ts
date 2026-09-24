import {it,expect,vi} from 'vitest'
import {readFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {createCatalogSnapshotReader} from './shamela_catalog_snapshot'
import {SHAMELA_CATALOG_SNAPSHOT as descriptor} from './shamela_catalog_snapshot.generated'
import {readCompleteShamelaLibraryCatalog,enrichShamelaCatalogMetadata,materializeAvailableShamelaCatalogBooks} from './shamela_pack_seed'
import {mergeCentralLibraryBooks} from './engine/library_store'
import {resetShamelaAuthorMetadataForTests} from './shamela_author_metadata'
function fixturePath(input:RequestInfo|URL):string{
 const path=String(input).split('?')[0]!.replace(/^\.\//,'')
 if(path==='api/library/catalog-snapshot')return 'data/shamela-catalog.snapshot.json'
 if(path==='data/shamela-catalog.snapshot.json')throw Error('old_service_worker_route_used')
 return path
}
it('preserves every field of all 8594 source entries including cards and 41 uncovered books',async()=>{
 const data=await readFile('app/public/data/shamela-catalog.snapshot.json'),catalog=JSON.parse(await readFile('app/public/library/shamela/catalog.json','utf8')),expected=[]
 for(const batch of catalog.batches){const manifest=JSON.parse(await readFile('app/public/'+batch.manifest.slice(2),'utf8'));for(const entry of manifest.books)expected.push({entry,batchId:batch.id,root:batch.manifest.slice(0,batch.manifest.lastIndexOf('/')+1)})}
 let calls=0;const fetcher=async()=>{calls++;return new Response(data)},read=createCatalogSnapshotReader()
 const [a,b]=await Promise.all([read(fetcher),read(fetcher)]);expect(a).toEqual(expected);expect(b).toEqual(expected);expect(calls).toBe(1);expect(a.length).toBe(8594)
 const release=JSON.parse(await readFile('artifacts/heading-search-central-v2/client-release.json','utf8')),covered=new Set(release.coveredSourceBookIds)
 expect(a.filter(item=>!covered.has(item.entry.bookId))).toHaveLength(41)
 expect(createHash('sha256').update(data).digest('hex')).toBe(descriptor.sha256)
 const metadata=JSON.parse(await readFile('app/public/data/shamela-author-metadata.json','utf8'))
 expect(enrichShamelaCatalogMetadata(a,metadata)).toEqual(enrichShamelaCatalogMetadata(expected,metadata))
 const books=materializeAvailableShamelaCatalogBooks(enrichShamelaCatalogMetadata(a,metadata).map(item=>item.entry)),local={...books.find(book=>!covered.has(String(Number(book.id)-410000000)))!,tags:[{id:'local-tag',name:'وسم محلي'}],bokToc:[{id:'toc-local',title:'باب النسخ',pageIndex:0}],extractedText:'متن محلي'}
 const merged=mergeCentralLibraryBooks(books,[local]),retained=merged.find(book=>book.id===local.id)!
 expect(retained.tags).toEqual(local.tags);expect(retained.bokToc).toEqual(local.bokToc);expect(retained.extractedText).toBe(local.extractedText)
})
it('uses one successful snapshot and preserves snapshot failure without batch fanout',async()=>{
 for(const broken of [false,true]){
  resetShamelaAuthorMetadataForTests();const calls:string[]=[];let bytes=0
  const fetcher:typeof fetch=async input=>{const path=fixturePath(input);calls.push(path);if(broken&&path==='data/shamela-catalog.snapshot.json')return new Response(null,{status:404});try{const body=await readFile('app/public/'+path);bytes+=body.length;return new Response(body,{headers:{'content-type':'application/json'}})}catch{return new Response(null,{status:404})}}
  vi.stubGlobal('fetch',fetcher)
  try{const start=performance.now();if(broken)await expect(readCompleteShamelaLibraryCatalog(fetcher)).rejects.toThrow('catalog_snapshot_http');else expect(await readCompleteShamelaLibraryCatalog(fetcher)).toHaveLength(8594);console.log(JSON.stringify({catalogMode:broken?'failed-no-fanout':'snapshot',requests:calls.length,bytes,ms:Math.round(performance.now()-start)}));expect(calls.filter(path=>path==='data/shamela-catalog.snapshot.json')).toHaveLength(1);expect(calls.filter(path=>/batches\/.*manifest\.json$/.test(path))).toHaveLength(0);expect(calls).toHaveLength(2);expect(calls.filter(path=>path==='data/shamela-author-metadata.json')).toHaveLength(1)}finally{vi.unstubAllGlobals();resetShamelaAuthorMetadataForTests()}
 }
})
it('starts independent author metadata before the catalog response finishes',async()=>{
 resetShamelaAuthorMetadataForTests()
 let release!:()=>void
 const gate=new Promise<void>(resolve=>{release=resolve}),calls:string[]=[]
 const fetcher:typeof fetch=async input=>{
  const path=fixturePath(input);calls.push(path)
  if(path==='data/shamela-catalog.snapshot.json')await gate
  return new Response(await readFile('app/public/'+path))
 }
 vi.stubGlobal('fetch',fetcher)
 const pending=readCompleteShamelaLibraryCatalog(fetcher)
 try{
  await vi.waitFor(()=>expect(calls).toContain('data/shamela-author-metadata.json'))
  release();expect(await pending).toHaveLength(8594)
 }finally{release();await pending.catch(()=>{});vi.unstubAllGlobals();resetShamelaAuthorMetadataForTests()}
})
it('rejects corrupted, oversized and missing snapshots without accepting partial success',async()=>{
 for(const response of [new Response('wrong'),new Response(new Uint8Array(descriptor.bytes+1)),new Response(null,{status:404})]){
  await expect(createCatalogSnapshotReader()(async()=>response)).rejects.toThrow()
 }
})
it('times out hung snapshot fetches and does not duplicate a failed attempt in the cooldown',async()=>{
 let calls=0;const fetcher=async()=>{calls++;return new Promise<Response>(()=>{})},read=createCatalogSnapshotReader(descriptor,10)
 await expect(read(fetcher)).rejects.toThrow('timeout');await expect(read(fetcher)).rejects.toThrow();expect(calls).toBe(1)
})
it('rejects authenticated duplicate or missing rows rather than reporting complete coverage',async()=>{
 const raw=JSON.parse(await readFile('app/public/data/shamela-catalog.snapshot.json','utf8'))
 for(const kind of ['duplicate','missing']){
  const payload=structuredClone(raw);if(kind==='duplicate')payload.batches[0].books[1]=payload.batches[0].books[0];else payload.batches[0].books.pop()
  const bytes=Buffer.from(JSON.stringify(payload)),changed={...descriptor,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')}
  await expect(createCatalogSnapshotReader(changed)(async()=>new Response(bytes))).rejects.toThrow()
 }
})
it('retries after failed-attempt cooldown without making two simultaneous snapshot requests',async()=>{
 const bytes=await readFile('app/public/data/shamela-catalog.snapshot.json');let calls=0,now=1000;const clock=vi.spyOn(Date,'now').mockImplementation(()=>now)
 try{const fetcher=async()=>++calls===1?new Response(null,{status:503}):new Response(bytes),read=createCatalogSnapshotReader()
  await expect(read(fetcher)).rejects.toThrow();await expect(read(fetcher)).rejects.toThrow();expect(calls).toBe(1);now+=30001
  const values=await Promise.all([read(fetcher),read(fetcher)]);expect(values[0]).toHaveLength(8594);expect(calls).toBe(2)
 }finally{clock.mockRestore()}
})
