// Verify delivery through the reader's public route; never send cloud credentials.
export async function readPublicFieldObject(key,size,{prefix,signal,fetchImpl=fetch,avoidNegativeCache=false}={}){
 if(!key.startsWith(prefix+'/')||! /^(books\/\d+\.json(?:\.gz)?|manifest\.json)$/.test(key.slice(prefix.length+1))||!Number.isSafeInteger(size)||size<1||size>16*1024**2)throw Error('public_verify_key')
 try{
  // Upload probes may precede object creation. Isolate their CDN negative cache
  // entries; acceptance/fresh verification always reads the canonical URL.
  const suffix=avoidNegativeCache?'?upload_probe='+crypto.randomUUID():''
  const ranged=size>1024**2,parts=[]
  for(let start=0;start<size;start+=ranged?512*1024:size){
  const end=Math.min(size-1,start+512*1024-1),expected=ranged?end-start+1:size
  const response=await fetchImpl('https://khzanah.com/'+key+suffix,{redirect:'error',cache:'no-store',...(ranged?{headers:{Range:`bytes=${start}-${end}`}}:{}),signal:AbortSignal.any([signal,AbortSignal.timeout(30000)].filter(Boolean))})
  if(response.status===404){await response.body?.cancel();return null}
  if(response.status!==(ranged?206:200)){await response.body?.cancel();throw Object.assign(Error('public_http_'+response.status),{transient:response.status===429||response.status>=500})}
  if(ranged&&response.headers.get('content-range')!==`bytes ${start}-${end}/${size}`){await response.body?.cancel();throw Error('public_verify_range')}
  const reader=response.body.getReader(),chunks=[];let length=0
  try{for(;;){const next=await reader.read();if(next.done)break;length+=next.value.length;if(length>expected){await reader.cancel();throw Error('public_verify_size')}chunks.push(next.value)}}finally{reader.releaseLock()}
  if(length!==expected)throw Error('public_verify_size')
  parts.push(Buffer.concat(chunks,length))
  }
  return Buffer.concat(parts,size)
 }catch(error){
  if(!signal?.aborted&&(error.name==='TimeoutError'||error instanceof TypeError||error.cause?.code?.startsWith('UND_ERR_')))error.transient=true
  throw error
 }
}
