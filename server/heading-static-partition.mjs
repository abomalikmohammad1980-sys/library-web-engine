const SHA=/^[a-f0-9]{64}$/
const failure=status=>new Response('Heading partition unavailable',{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff'}})
/** Return only the verified dictionary shard, even when ASSETS ignores Range. */
export async function serveHeadingPartition(request,assets,descriptor){
 const url=new URL(request.url)
 if(request.method!=='GET')return failure(405)
 if(url.search||request.headers.get('origin')&&request.headers.get('origin')!==url.origin||request.headers.get('sec-fetch-site')==='cross-site')return failure(400)
 const match=/^\/api\/search\/heading-partitions\/([a-f0-9]{64})\/([a-f0-9]{64})\.bin$/.exec(url.pathname)
 if(!match||match[1]!==descriptor.parts.sourceManifestSha256)return failure(404)
 const path=`dictionary/${match[2]}.bin`,location=descriptor.locations[path],shard=descriptor.parts.shards.find(row=>row.path===path)
 if(!location||!shard||!SHA.test(shard.gzipSha256)||!/^([a-f0-9]{64})\.bin$/.test(location.path))return failure(404)
 const {offset,bytes,packBytes}=location
 if(![offset,bytes,packBytes].every(Number.isSafeInteger)||offset<0||bytes<1||bytes>1048576||bytes!==shard.gzipBytes||packBytes>25*1024*1024||offset+bytes>packBytes)return failure(503)
 const base=descriptor.baseURL.replace(/^\.\//,'/')
 if(!/^\/data\/heading-dictionary\/[a-f0-9]{64}\/packed-v2\/$/.test(base))return failure(503)
 let reader
 try{
  const response=await assets.fetch(new Request(new URL(base+location.path,url.origin),{headers:{Range:`bytes=${offset}-${offset+bytes-1}`},signal:request.signal}))
  if(![200,206].includes(response.status)||!response.body)return failure(502)
  if(response.status===206&&response.headers.get('content-range')!==`bytes ${offset}-${offset+bytes-1}/${packBytes}`){await response.body.cancel();return failure(502)}
  const skip=response.status===206?0:offset,end=skip+bytes,result=new Uint8Array(bytes)
  reader=response.body.getReader();let seen=0,written=0
  while(seen<end){
   request.signal.throwIfAborted()
   const part=await reader.read();if(part.done)break
   const from=Math.max(0,skip-seen),to=Math.min(part.value.length,end-seen)
   if(to>from){result.set(part.value.subarray(from,to),written);written+=to-from}
   seen+=part.value.length
   if(seen>(response.status===206?bytes:packBytes))throw Error('pack_size')
  }
  await reader.cancel();reader.releaseLock();reader=undefined
  if(written!==bytes)return failure(502)
  const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',result))].map(n=>n.toString(16).padStart(2,'0')).join('')
  if(digest!==shard.gzipSha256)return failure(502)
  return new Response(result,{headers:{'content-type':'application/octet-stream','content-length':String(bytes),'cache-control':'public, max-age=31536000, immutable','etag':`"${digest}"`,'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','x-robots-tag':'noindex'}})
 }catch{return failure(502)}finally{if(reader){await reader.cancel().catch(()=>undefined);reader.releaseLock()}}
}
