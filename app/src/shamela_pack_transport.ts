export class ShamelaPackSeedError extends Error {
 constructor(readonly code:string,cause?:unknown){super(code,{cause});this.name='ShamelaPackSeedError'}
}

/** Two complete attempts at most. A manifest proof permits one cache-isolated
 * recovery of stale bytes; no unverified payload is returned or stored. */
export async function fetchShamelaPackBytes(url:string,expectedBytes:number,fetcher:typeof fetch=fetch,timeoutMs=20000,expectedSha256?:string):Promise<Uint8Array>{
 if(!Number.isSafeInteger(expectedBytes)||expectedBytes<1)throw new ShamelaPackSeedError('shamela_pack_book_size_invalid')
 if(expectedSha256!==undefined&&!/^[a-f0-9]{64}$/.test(expectedSha256))throw new ShamelaPackSeedError('shamela_pack_book_checksum_invalid')
 for(let attempt=0;attempt<2;attempt++){
  const controller=new AbortController()
  // A large verified BOK pack can take longer than 20 seconds on a phone even
  // while bytes keep arriving. Timeout stalled progress, not the whole body;
  // keep a separate finite ceiling so a trickling response cannot run forever.
  let idleTimer:ReturnType<typeof setTimeout>|undefined
  const refreshIdle=()=>{if(idleTimer)clearTimeout(idleTimer);idleTimer=setTimeout(()=>controller.abort(),timeoutMs)}
  refreshIdle()
  const maximumMs=Math.max(timeoutMs*3,Math.min(300_000,Math.ceil(expectedBytes/65_536)*1000))
  const totalTimer=setTimeout(()=>controller.abort(),maximumMs)
  let reader:ReadableStreamDefaultReader<Uint8Array>|undefined
  const cancel=()=>{void reader?.cancel().catch(()=>undefined)}
  controller.signal.addEventListener('abort',cancel,{once:true})
  try{
   // A content-addressed request avoids the stale service-worker route on the
   // first try. On the observed cold 907 open, that route idled for 20s before
   // the checksum URL returned the complete verified body. Fall back to the
   // canonical URL only if this isolated request fails; SHA is checked either way.
   const isolatedUrl=expectedSha256?`${url}${url.includes('?')?'&':'?'}shamela_sha256=${expectedSha256}`:url
   const requestUrl=expectedSha256&&attempt===0?isolatedUrl:url
   const response=await fetcher(requestUrl,{cache:expectedSha256?(attempt?'reload':'no-store'):(attempt?'no-store':'reload'),credentials:'same-origin',signal:controller.signal})
   refreshIdle()
   if(!response.ok){await response.body?.cancel();if(!attempt&&(Boolean(expectedSha256)||[408,429,500,502,503,504].includes(response.status)))continue;throw new ShamelaPackSeedError(`shamela_pack_book_http_${response.status}`)}
   if(response.headers.get('content-type')?.toLowerCase().includes('text/html')){await response.body?.cancel();throw new ShamelaPackSeedError('shamela_pack_book_spa_fallback')}
   if(!response.body)throw new TypeError('missing_response_body')
   reader=response.body.getReader()
   const bytes=new Uint8Array(expectedBytes);let length=0
   for(;;){controller.signal.throwIfAborted();const {done,value}=await reader.read();controller.signal.throwIfAborted();if(done)break;if(length+value.byteLength>expectedBytes)throw new ShamelaPackSeedError('shamela_pack_book_size_mismatch');bytes.set(value,length);length+=value.byteLength;if(value.byteLength)refreshIdle()}
   if(length!==expectedBytes)throw new ShamelaPackSeedError('shamela_pack_book_size_mismatch')
   // No network is idle after the final byte; the finite overall deadline
   // still bounds checksum work on a weak device.
   if(idleTimer){clearTimeout(idleTimer);idleTimer=undefined}
   if(expectedSha256){const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes.buffer))].map(n=>n.toString(16).padStart(2,'0')).join('');if(sha!==expectedSha256)throw new ShamelaPackSeedError('shamela_pack_book_checksum_mismatch')}
   return bytes
  }catch(error){
   await reader?.cancel().catch(()=>undefined)
   if(error instanceof ShamelaPackSeedError){
    if(!attempt&&expectedSha256&&['shamela_pack_book_size_mismatch','shamela_pack_book_checksum_mismatch','shamela_pack_book_spa_fallback'].includes(error.code))continue
    throw error
   }
   if(attempt)throw new ShamelaPackSeedError(controller.signal.aborted?'shamela_pack_book_download_timeout':'shamela_pack_book_download_failed',error)
  }finally{if(idleTimer)clearTimeout(idleTimer);clearTimeout(totalTimer);controller.signal.removeEventListener('abort',cancel);reader?.releaseLock()}
 }
 throw new ShamelaPackSeedError('shamela_pack_book_download_failed')
}
