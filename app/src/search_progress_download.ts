/** Bounded transport: progress renews the idle deadline, never the total deadline. */
export async function searchProgressDownload(fetcher:typeof fetch,url:string,expectedBytes:number,{idleMs=15000,totalMs=60000}:{idleMs?:number;totalMs?:number}={}):Promise<Uint8Array>{
 if(!Number.isSafeInteger(expectedBytes)||expectedBytes<1||expectedBytes>32*1024*1024)throw Error('shamela_search_v2_term_directory_oversized')
 const controller=new AbortController();let idle:ReturnType<typeof setTimeout>|undefined,total:ReturnType<typeof setTimeout>|undefined
 let progress=()=>{}
 const deadline=new Promise<never>((_resolve,reject)=>{
  const abort=()=>{reject(Error('shamela_search_v2_term_network_timeout'));controller.abort()}
  progress=()=>{if(idle)clearTimeout(idle);idle=setTimeout(abort,idleMs)}
  progress();total=setTimeout(abort,totalMs)
 })
 try{return await Promise.race([(async()=>{
  const response=await fetcher(url,{cache:'force-cache',signal:controller.signal})
  if(!response.ok){await response.body?.cancel();throw Error(`shamela_search_v2_term_http_${response.status}`)}
  const reader=response.body?.getReader();if(!reader)throw Error('shamela_search_v2_term_directory_empty')
  const bytes=new Uint8Array(expectedBytes);let length=0;progress()
  const cancel=()=>{void reader.cancel().catch(()=>{})};controller.signal.addEventListener('abort',cancel,{once:true})
  try{
   for(;;){controller.signal.throwIfAborted();const chunk=await reader.read();if(chunk.done)break
    if(length+chunk.value.length>expectedBytes)throw Error('shamela_search_v2_term_directory_oversized')
    bytes.set(chunk.value,length);length+=chunk.value.length;if(chunk.value.length)progress()
   }
   controller.signal.throwIfAborted()
   if(length!==expectedBytes)throw Error('shamela_search_v2_term_directory_integrity')
   return bytes
  }finally{controller.signal.removeEventListener('abort',cancel);await reader.cancel().catch(()=>{});reader.releaseLock()}
 })(),deadline])}finally{if(idle)clearTimeout(idle);if(total)clearTimeout(total)}
}
