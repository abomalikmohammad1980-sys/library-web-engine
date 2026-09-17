// Cache only anonymous, canonical HTML. Visibility is checked before EACH hit;
// this is deliberately not a CDN/browser cache of the public request URL.
const PUBLIC_PATH=/^(?:\/(?:features|quran|sunnah|authors|browse|new-books)?|\/authors\/\d{6}|\/books\/(?:[1-9]\d{0,11}|public\/[A-Za-z0-9_-]{1,200}))$/
const NO_STORE='private, no-store'
export function publicHtmlCacheRequest(request){
 const url=new URL(request.url)
 if(!['GET','HEAD'].includes(request.method)||url.protocol!=='https:'||!PUBLIC_PATH.test(url.pathname))return false
 if(['authorization','cookie','range'].some(name=>request.headers.has(name)))return false
 if(/no-cache|no-store/i.test(request.headers.get('cache-control')??''))return false
 for(const [key,value] of url.searchParams){
  if(!['page','tocPage'].includes(key)||!/^([1-9]\d{0,5})$/.test(value)||url.searchParams.getAll(key).length!==1)return false
 }
 return true
}
function canonicalValue(value){
 if(value===null||typeof value!=='object')return value
 if(Array.isArray(value))return value.map(canonicalValue)
 return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonicalValue(value[key])]))
}
export async function publicHtmlCacheKey(request,deploymentVersion,snapshot){
 // versionMaterial must include every rendered dependency: current public record,
 // TOC pointer/hash, related records/list pages and their visibility/revisions.
 if(snapshot?.public!==true||!snapshot.versionMaterial||!deploymentVersion)return undefined
 const material=JSON.stringify(canonicalValue({deploymentVersion,content:snapshot.versionMaterial}))
 if(material.length>262144)return undefined
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(material))
 const sha=Array.from(new Uint8Array(digest),n=>n.toString(16).padStart(2,'0')).join('')
 const url=new URL(request.url);url.hash='';url.searchParams.sort();url.searchParams.set('__seo_v',sha)
 return new Request(url,{method:'GET'})
}
function externalResponse(response,request){
 const headers=new Headers(response.headers)
 headers.set('cache-control',NO_STORE)
 headers.delete('cdn-cache-control');headers.delete('cloudflare-cdn-cache-control')
 headers.delete('age');headers.delete('etag');headers.delete('last-modified')
 if(new URL(request.url).hostname!=='khzanah.com')headers.set('x-robots-tag','noindex, follow')
 return new Response(request.method==='HEAD'?null:response.body,{status:response.status,statusText:response.statusText,headers})
}
function mayStore(response,request){
 return response.status===200&&/^text\/html(?:;|$)/i.test(response.headers.get('content-type')??'')
  &&!response.headers.has('set-cookie')&&!response.headers.has('vary')
  &&(new URL(request.url).hostname!=='khzanah.com'||!response.headers.get('x-robots-tag')?.includes('noindex'))
}
function unavailable(){return new Response('تعذّر تحميل الصفحة مؤقتًا',{status:503,headers:{'content-type':'text/plain; charset=utf-8','x-robots-tag':'noindex'}})}
/**
 * loadSnapshot MUST read current authoritative visibility on every call (D1
 * first-primary session), not cached metadata. Return null for withdrawn/missing.
 * render(snapshot) renders the exact snapshot (null => existing 404 response).
 * No stale response is returned if visibility cannot be verified. Cache failures
 * only disable the optimization; metadata/visibility failures fail closed.
 */
export async function serveVersionedPublicHtml({request,cache,deploymentVersion,loadSnapshot,render,waitUntil}){
 try{
  const readPublic=async()=>{const value=await loadSnapshot();return value?.public===true?value:null}
  const snapshot=await readPublic()
  const enabled=cache&&publicHtmlCacheRequest(request)
  const key=enabled?await publicHtmlCacheKey(request,deploymentVersion,snapshot):undefined
  if(key){
   let cached
   try{cached=await cache.match(key)}catch{/* A cache outage never authorizes stale access. */}
   if(cached){
    const current=await readPublic()
    const currentKey=await publicHtmlCacheKey(request,deploymentVersion,current)
    if(currentKey?.url===key.url)return externalResponse(cached,request)
    // Re-render the current state after a deletion/edit racing the cache read.
    return externalResponse(await render(current),request)
   }
  }
  const response=await render(snapshot)
  if(key&&request.method==='GET'&&mayStore(response,request)){
   const current=await readPublic()
   const currentKey=await publicHtmlCacheKey(request,deploymentVersion,current)
   if(currentKey?.url!==key.url)return externalResponse(await render(current),request)
   const stored=response.clone(),headers=new Headers(stored.headers)
   headers.set('cache-control','public, max-age=86400')
   headers.delete('cdn-cache-control');headers.delete('cloudflare-cdn-cache-control')
   const put=cache.put(key,new Response(stored.body,{status:200,headers})).catch(()=>{})
   if(waitUntil)waitUntil(put);else await put
  }
  return externalResponse(response,request)
 }catch{return externalResponse(unavailable(),request)}
}
