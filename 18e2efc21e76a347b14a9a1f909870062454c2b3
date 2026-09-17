type Pending={input:RequestInfo|URL;init:RequestInit|undefined;url:string;start:number;end:number;key:string;resolve:(value:Response)=>void;reject:(error:unknown)=>void}
/** Coalesce nearby public heading ranges, retaining per-segment SHA checks in
 * the caller. The wire window is at most 64 KiB and never crosses files or
 * cancellation owners. No persistent cache, credentials or private data. */
export function batchHeadingRanges(fetcher:typeof fetch):typeof fetch{
 let queue:Pending[]=[],timer:ReturnType<typeof setTimeout>|undefined
 const dispatch=async(group:Pending[])=>{
  const first=group[0]!
  try{
   first.init?.signal?.throwIfAborted()
   if(group.length===1){first.resolve(await fetcher(first.input,first.init));return}
   const start=first.start,end=Math.max(...group.map(item=>item.end)),headers=new Headers(first.init?.headers)
   headers.set('Range',`bytes=${start}-${end}`)
   const response=await fetcher(first.input,{...first.init,headers})
   if(response.status!==206){
    // Preserve existing full-object fallback/integrity semantics unchanged.
    await response.body?.cancel().catch(()=>undefined)
    await Promise.all(group.map(async item=>{try{item.resolve(await fetcher(item.input,item.init))}catch(error){item.reject(error)}}))
    return
   }
   const match=response.headers.get('content-range')?.match(/^bytes (\d+)-(\d+)\/(\d+)$/)
   if(!match||Number(match[1])!==start||Number(match[2])!==end||Number(match[3])<=end)throw Error('heading_batch_range_mismatch')
   if(!response.body)throw Error('heading_batch_empty')
   const reader=response.body.getReader(),chunks:Uint8Array[]=[];let length=0
   try{for(;;){first.init?.signal?.throwIfAborted();const part=await reader.read();if(part.done)break;length+=part.value.length;if(length>end-start+1)throw Error('heading_batch_size');chunks.push(part.value)}}
   catch(error){await reader.cancel().catch(()=>undefined);throw error}finally{reader.releaseLock()}
   if(length!==end-start+1)throw Error('heading_batch_size')
   first.init?.signal?.throwIfAborted()
   const bytes=new Uint8Array(length);let at=0;for(const part of chunks){bytes.set(part,at);at+=part.length}
   for(const item of group){const headers=new Headers(response.headers);headers.delete('content-encoding');headers.set('content-range',`bytes ${item.start}-${item.end}/${match[3]}`);headers.set('content-length',String(item.end-item.start+1));item.resolve(new Response(bytes.slice(item.start-start,item.end-start+1),{status:206,headers}))}
  }catch(error){for(const item of group)item.reject(error)}
 }
 const flush=()=>{
  timer=undefined;const pending=queue;queue=[]
  const buckets:Pending[][]=[]
  for(const item of pending){const bucket=buckets.find(items=>items[0]!.key===item.key&&items[0]!.init?.signal===item.init?.signal);if(bucket)bucket.push(item);else buckets.push([item])}
  for(const bucket of buckets){
   bucket.sort((a,b)=>a.start-b.start);let group:Pending[]=[],end=0
   for(const item of bucket){
    if(group.length&&(item.start>end+1025||Math.max(end,item.end)-group[0]!.start+1>65536)){void dispatch(group);group=[]}
    group.push(item);end=Math.max(group.length===1?item.end:end,item.end)
   }
   if(group.length)void dispatch(group)
  }
 }
 return (input,init)=>{
  const url=String(input),headers=new Headers(init?.headers),match=headers.get('Range')?.match(/^bytes=(\d+)-(\d+)$/)
  if(!match||input instanceof Request||(init?.method&&init.method!=='GET')||!/(?:\/api\/search\/headings\/|\/data\/heading-)/.test(url))return fetcher(input,init)
  const start=Number(match[1]),end=Number(match[2]);if(!Number.isSafeInteger(end)||start<0||end<start||end-start+1>65536)return fetcher(input,init)
  headers.delete('Range')
  const key=JSON.stringify([url,[...headers],init?.cache,init?.credentials,init?.mode,init?.redirect,init?.integrity])
  return new Promise<Response>((resolve,reject)=>{queue.push({input,init,url,start,end,key,resolve,reject});timer??=setTimeout(flush,2)})
 }
}
