const LIMIT=200000
const digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(x=>x.toString(16).padStart(2,'0')).join('')
async function bounded(response){
 if(!response?.ok||!response.body)throw Error('seo_cache_body')
 const reader=response.body.getReader(),parts=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>=LIMIT)throw Error('seo_cache_size');parts.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const p of parts){bytes.set(p,at);at+=p.length}return bytes
}
/** Only validated immutable packaged-public data. NEVER pass DB projections,
 * account data, live overrides, or visibility decisions to this cache. */
export async function cachedSeoImmutable({cache,release,key,load,origin='https://khzanah.com'}){
 if(!/^[a-f0-9]{64}$/.test(release)||typeof key!=='string'||key.length>300)throw Error('seo_cache_identity')
 const base=new URL(origin)
 if(base.username||base.password||base.pathname!=='/'||base.search||base.hash||!(base.protocol==='https:'||base.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(base.hostname)))throw Error('seo_cache_origin')
 if(!cache)return load()
 const request=new Request(`${base.origin}/__internal/seo-immutable/${release}/${encodeURIComponent(key)}`)
 try{
  const response=await cache.match(request)
  if(response){const bytes=await bounded(response);if(await digest(bytes)!==response.headers.get('x-seo-body-sha256'))throw Error('seo_cache_checksum');return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}
 }catch{try{await cache.delete(request)}catch{}}
 const value=await load();if(value==null)return value
 const bytes=new TextEncoder().encode(JSON.stringify(value));if(bytes.length>=LIMIT)throw Error('seo_cache_size')
 const response=new Response(bytes,{headers:{'content-type':'application/json','cache-control':'public, max-age=86400','x-seo-body-sha256':await digest(bytes)}})
 // Cache availability must not turn valid catalog data into an outage.
 try{await cache.put(request,response)}catch{}
 return JSON.parse(new TextDecoder().decode(bytes))
}
