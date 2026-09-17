// Verify delivery through the reader's public route; never send cloud credentials.
export async function readPublicFieldObject(key,size,{prefix,signal,fetchImpl=fetch,avoidNegativeCache=false}={}){
 if(!key.startsWith(prefix+'/')||! /^(books\/\d+\.json(?:\.gz)?|manifest\.json)$/.test(key.slice(prefix.length+1))||!Number.isSafeInteger(size)||size<1||size>16*1024**2)throw Error('public_verify_key')
 try{
  // Upload probes may precede object creation. Isolate their CDN negative cache
  // entries; acceptance/fresh verification always reads the canonical URL.
  const suffix=avoidNegativeCache?'?upload_probe='+crypto.randomUUID():''
  const response=await fetchImpl('https://khzanah.com/'+key+suffix,{redirect:'error',cache:'no-store',signal:AbortSignal.any([signal,AbortSignal.timeout(30000)].filter(Boolean))})
  if(response.status===404){await response.body?.cancel();return null}
  if(response.status!==200){await response.body?.cancel();throw Object.assign(Error('public_http_'+response.status),{transient:response.status===429||response.status>=500})}
  const reader=response.body.getReader(),chunks=[];let length=0
  try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>size){await reader.cancel();throw Error('public_verify_size')}chunks.push(next.value)}}finally{reader.releaseLock()}
  if(length!==size)throw Error('public_verify_size')
  return Buffer.concat(chunks,length)
 }catch(error){
  if(!signal?.aborted&&(error.name==='TimeoutError'||error instanceof TypeError||error.cause?.code?.startsWith('UND_ERR_')))error.transient=true
  throw error
 }
}
