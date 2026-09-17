import {decodeRecoveryManifest,decodeRecoveredRows,type RecoveryPin,type RecoveryRow} from './snippet_source_recovery'

/** Bounded transport; pins must come from the admitted release, never the fetched file. */
export async function readRecoveryBytes(response:Response,length:number,signal?:AbortSignal):Promise<Uint8Array>{
 if(response.status!==200||!response.body||!Number.isSafeInteger(length)||length<1||length>4*1024*1024){await response.body?.cancel();throw Error('snippet_recovery_response')}
 const reader=response.body.getReader(),bytes=new Uint8Array(length);let offset=0
 const abort=()=>{void reader.cancel().catch(()=>undefined)}
 signal?.addEventListener('abort',abort,{once:true})
 try{
  signal?.throwIfAborted()
  for(;;){const {done,value}=await reader.read();signal?.throwIfAborted();if(done)break;if(offset+value.byteLength>length)throw Error('snippet_recovery_length');bytes.set(value,offset);offset+=value.byteLength}
  if(offset!==length)throw Error('snippet_recovery_length')
  return bytes
 }finally{signal?.removeEventListener('abort',abort);await reader.cancel().catch(()=>undefined);reader.releaseLock()}
}
export function createRecoveryTransport(config:{baseUrl:string;manifest:RecoveryPin&{auditSha256:string;rows:number}},options:{fetcher?:typeof fetch;digest:(bytes:Uint8Array)=>Promise<string>;signal?:AbortSignal}){
 const base=new URL(config.baseUrl)
 if(!['http:','https:'].includes(base.protocol)||base.username||base.password||base.search||base.hash||!base.pathname.endsWith('/'))throw Error('snippet_recovery_base')
 const fetcher=options.fetcher??fetch,signal=options.signal
 let manifestTask:ReturnType<typeof decodeRecoveryManifest>|undefined,active=0
 const waiters:Array<()=>void>=[],pending=new Map<string,Promise<ReadonlyMap<string,RecoveryRow>>>(),cache=new Map<string,ReadonlyMap<string,RecoveryRow>>()
 const bounded=async<T>(run:()=>Promise<T>)=>{
  if(active>=8)await new Promise<void>(resolve=>waiters.push(resolve));else active++
  try{signal?.throwIfAborted();return await run()}finally{const next=waiters.shift();if(next)next();else active--}
 }
 const load=async(path:string,length:number)=>readRecoveryBytes(await fetcher(new URL(path,base),{credentials:'omit',signal:signal??null}),length,signal)
 const manifest=()=>{
  if(!manifestTask){
   const task=bounded(async()=>decodeRecoveryManifest(await load('manifest.json',config.manifest.byteLength),config.manifest,options.digest))
   manifestTask=task;void task.catch(()=>{if(manifestTask===task)manifestTask=undefined})
  }
  return manifestTask
 }
 return {
  async book(bookId:string):Promise<ReadonlyMap<string,RecoveryRow>>{
   if(!/^\d+$/.test(bookId))throw Error('snippet_recovery_book_id')
   signal?.throwIfAborted()
   const cached=cache.get(bookId)
   if(cached){cache.delete(bookId);cache.set(bookId,cached);return cached}
   const existing=pending.get(bookId);if(existing)return existing
   const task=(async()=>{
    const descriptor=(await manifest()).get(bookId)
    if(!descriptor)return new Map<string,RecoveryRow>() // Only a verified manifest can prove no recovery for this book.
    const rows=await bounded(async()=>decodeRecoveredRows(await load(descriptor.path,descriptor.byteLength),descriptor,bookId,config.manifest.sourceManifestSha256,options.digest))
    signal?.throwIfAborted();cache.set(bookId,rows);while(cache.size>16)cache.delete(cache.keys().next().value!)
    return rows
   })()
   pending.set(bookId,task)
   try{return await task}finally{if(pending.get(bookId)===task)pending.delete(bookId)}
  }
 }
}
