import type {LocatedShamelaPackBook,ShamelaPackManifestBook} from './shamela_pack_seed'
import {SHAMELA_CATALOG_SNAPSHOT} from './shamela_catalog_snapshot.generated'
type Descriptor={path:string;bytes:number;sha256:string;bookCount:number;batchCount:number;sourceSha256:string}
export function createCatalogSnapshotReader(descriptor:Descriptor=SHAMELA_CATALOG_SNAPSHOT,timeoutMs=12000,maxTotalMs=60000){
 const states=new WeakMap<typeof fetch,{pending?:Promise<LocatedShamelaPackBook[]>;retryAt?:number}>()
 return async(fetcher:typeof fetch=globalThis.fetch):Promise<LocatedShamelaPackBook[]>=>{
  let state=states.get(fetcher);if(state?.pending)return state.pending
  if(state?.retryAt&&Date.now()<state.retryAt)throw Error('catalog_snapshot_cooldown')
  state={};states.set(fetcher,state)
  state.pending=(async()=>{
   if(descriptor.bytes<1||descriptor.bytes>6_000_000||descriptor.path!=='./data/shamela-catalog.snapshot.json')throw Error('catalog_snapshot_budget')
   const controller=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined,totalTimer:ReturnType<typeof setTimeout>|undefined
   let progress=()=>{}
   const deadline=new Promise<never>((_resolve,reject)=>{
    const abort=()=>{controller.abort();reject(Error('catalog_snapshot_timeout'))}
    progress=()=>{if(timer)clearTimeout(timer);timer=setTimeout(abort,timeoutMs)}
    progress();totalTimer=setTimeout(abort,maxTotalMs)
   })
   try{return await Promise.race([(async()=>{
    // The /api route bypasses even older installed service workers. Cache-first
    // cloning of this multi-megabyte JSON can stall the reader before bytes
    // arrive; the release SHA below still verifies every byte independently.
    const response=await fetcher(`./api/library/catalog-snapshot?v=${descriptor.sha256}`,{signal:controller.signal,cache:'force-cache'})
    if(!response.ok||!response.body)throw Error('catalog_snapshot_http')
    progress()
    const reader=response.body.getReader(),bytes=new Uint8Array(descriptor.bytes);let at=0
    const cancel=()=>{void reader.cancel().catch(()=>{})};controller.signal.addEventListener('abort',cancel,{once:true})
    try{for(;;){controller.signal.throwIfAborted();const {done,value}=await reader.read();if(done)break;if(at+value.length>bytes.length)throw Error('catalog_snapshot_budget');bytes.set(value,at);at+=value.length;if(value.length)progress()}}finally{controller.signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}
    controller.signal.throwIfAborted();if(at!==bytes.length)throw Error('catalog_snapshot_integrity')
    const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(sha!==descriptor.sha256)throw Error('catalog_snapshot_integrity')
    const payload=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)) as {contract:string;bookCount:number;batches:Array<{id:string;manifest:string;books:ShamelaPackManifestBook[]}>}
    if(payload.contract!=='khizana-library-catalog-snapshot/1'||payload.bookCount!==descriptor.bookCount||!Array.isArray(payload.batches)||payload.batches.length!==descriptor.batchCount)throw Error('catalog_snapshot_contract')
    const result:LocatedShamelaPackBook[]=[],seen=new Set<string>(),batchIds=new Set<string>()
    for(const batch of payload.batches){if(!/^batch-\d{4}$/.test(batch.id)||batchIds.has(batch.id)||batch.manifest!==`./library/shamela/batches/${batch.id}/manifest.json`||!Array.isArray(batch.books))throw Error('catalog_snapshot_contract');batchIds.add(batch.id)
     for(const entry of batch.books){if(!entry||! /^[1-9]\d*$/.test(entry.bookId)||seen.has(entry.bookId))throw Error('catalog_snapshot_duplicate');seen.add(entry.bookId);result.push({entry,batchId:batch.id,root:batch.manifest.slice(0,batch.manifest.lastIndexOf('/')+1)})}
    }
    if(result.length!==descriptor.bookCount)throw Error('catalog_snapshot_incomplete');controller.signal.throwIfAborted();return result
   })(),deadline])}finally{if(timer)clearTimeout(timer);if(totalTimer)clearTimeout(totalTimer)}
  })().catch(error=>{delete state!.pending;state!.retryAt=Date.now()+30000;throw error})
  return state.pending
 }
}
export const readShamelaCatalogSnapshot=createCatalogSnapshotReader()
