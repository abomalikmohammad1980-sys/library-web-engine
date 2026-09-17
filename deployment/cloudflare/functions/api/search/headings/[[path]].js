const SHA = /^[a-f0-9]{64}$/
const MAX_MANIFEST = 2 * 1024 * 1024
const MAX_ASSET = 16 * 1024 * 1024
const headers = {'x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin'}
const fail = (status, extra={}) => new Response('Heading asset unavailable',{status,headers:{...headers,'cache-control':'no-store',...extra}})
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('')
const validBytes = n => Number.isSafeInteger(n) && n > 0 && n <= MAX_ASSET
// One verified release only, weakly keyed by binding identity. Never cache I/O,
// promises, request headers, streams, or unverified bytes across requests.
let manifestCache = new WeakMap()

function inventory(manifest) {
  if(manifest?.contract!=='khizana-heading-search/2'||!Array.isArray(manifest.rows)||!Array.isArray(manifest.postings)||!Array.isArray(manifest.rowPointers))throw Error('manifest')
  const result = new Map()
  function add(group, entry) {
    const extension=group==='rows'?'json':group==='dictionary'?'json\\.gz':'bin'
    if(!entry||!SHA.test(entry.sha256)||!validBytes(entry.bytes)||!new RegExp(`^${group}/${entry.sha256}\\.${extension}$`).test(entry.path))throw Error('asset')
    const previous=result.get(entry.path)
    if(previous && previous.bytes!==entry.bytes)throw Error('duplicate')
    result.set(entry.path,{bytes:entry.bytes,sha256:entry.sha256})
  }
  if(manifest.rows.length+manifest.postings.length+manifest.rowPointers.length>20000)throw Error('manifest')
  for(const entry of manifest.rows)add('rows',entry)
  for(const entry of manifest.postings)add('postings',entry)
  for(const entry of manifest.rowPointers)add('pointers',entry)
  const d=manifest.dictionary
  add('dictionary',{path:d?.path,bytes:d?.gzipBytes,sha256:d?.gzipSha256})
  return result
}

async function readManifest(bucket,key,release) {
  const cached=manifestCache.get(bucket)
  if(cached?.release===release)return cached.data
  const object=await bucket.get(key)
  if(!object?.body)throw Error('missing')
  if(!Number.isSafeInteger(object.size)||object.size<1||object.size>MAX_MANIFEST){await object.body.cancel();throw Error('size')}
  const bytes=new Uint8Array(object.size),reader=object.body.getReader();let offset=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.byteLength>bytes.length)throw Error('size');bytes.set(value,offset);offset+=value.byteLength}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
  if(offset!==bytes.length||await digest(bytes)!==release)throw Error('sha')
  const entries=inventory(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)))
  const data={bytes,entries}
  manifestCache=new WeakMap()
  manifestCache.set(bucket,{release,data})
  return data
}

export async function onRequest(context) {
  const request=context.request
  if(request.method!=='GET')return fail(405,{allow:'GET'})
  let url;try{url=new URL(request.url)}catch{return fail(400)}
  const origin=request.headers.get('origin')
  if((origin && origin!==url.origin)||request.headers.get('sec-fetch-site')==='cross-site')return fail(403)
  // One fixed transport version bypasses legacy CDN objects without allowing
  // arbitrary cache keys, bucket paths, or encoded separators.
  if((url.search && url.search!=='?transport=range-v2')||/%|\\/.test(url.pathname))return fail(400)
  const match=/^\/api\/search\/headings\/([a-f0-9]{64})\/(manifest\.json|(?:rows|postings|pointers|dictionary)\/[a-f0-9]{64}\.(?:json|bin|json\.gz|compact\.bin\.gz))$/.exec(url.pathname)
  if(!match)return fail(400)
  const [,release,path]=match
  const approved=context.env.HEADING_RELEASE_SHA256
  if(!SHA.test(approved??''))return fail(503)
  if(release!==approved)return fail(404)
  const rawRange=request.headers.get('range')
  let range
  if(rawRange!==null){const m=/^bytes=(\d{1,10})-(\d{1,10})$/.exec(rawRange);if(!m)return fail(416);const start=Number(m[1]),end=Number(m[2]);if(end<start||end-start+1>1048576)return fail(416);range={offset:start,length:end-start+1}}
  // CDN cache fills may strip Range and request the complete immutable object.
  // Accept that request for this one fixed version too; normal release, asset,
  // size and fixed-length streaming checks below still apply.
  const prefix=`heading-search/releases/${release}/`
  try{
    const {bytes,entries}=await readManifest(context.env.LIBRARY_R2,prefix+'manifest.json',release)
    // Optional derived dictionary is independently content-addressed in deployment config.
    const binarySha=context.env.HEADING_DICTIONARY_GZIP_SHA256,binaryBytes=Number(context.env.HEADING_DICTIONARY_GZIP_BYTES)
    const binaryEntry=SHA.test(binarySha??'')&&validBytes(binaryBytes)&&path===`dictionary/${binarySha}.compact.bin.gz`?{bytes:binaryBytes,sha256:binarySha}:undefined
    const entry=path==='manifest.json'?{bytes:bytes.length,sha256:release}:entries.get(path)??binaryEntry
    if(!entry)return fail(404)
    if(range && range.offset+range.length>entry.bytes)return fail(416,{'content-range':`bytes */${entry.bytes}`})
    const length=range?.length??entry.bytes
    const responseHeaders={...headers,'cache-control':'public, max-age=31536000, immutable','content-type':path.endsWith('.json')?'application/json; charset=utf-8':'application/octet-stream','content-length':String(length),'accept-ranges':'bytes',etag:`"${entry.sha256}"`,...(range?{'content-range':`bytes ${range.offset}-${range.offset+range.length-1}/${entry.bytes}`}:{})}
    if(path==='manifest.json')return new Response(range?bytes.slice(range.offset,range.offset+range.length):bytes.slice(),{status:range?206:200,headers:responseHeaders})
    const object=await context.env.LIBRARY_R2.get(prefix+path,range?{range}:undefined)
    if(!object)return fail(404)
    if(!object.body||object.size!==entry.bytes||(range && (object.range?.offset!==range.offset||object.range?.length!==range.length))){await object.body?.cancel();return fail(503)}
    if(range){
      // Cloudflare drops manually supplied Content-Length on generic streams.
      // A range is capped at 1 MiB above: verify it completely, then give the
      // runtime a known-length buffer so HTTP206 retains exact byte framing.
      const bytes=new Uint8Array(length),reader=object.body.getReader();let offset=0
      try{for(;;){const {done,value}=await reader.read();if(done)break;if(offset+value.byteLength>length)throw Error('length');bytes.set(value,offset);offset+=value.byteLength}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
      if(offset!==length)return fail(503)
      return new Response(bytes.buffer,{status:206,headers:responseHeaders})
    }
    // A generic stream loses Content-Length in Workers, so cached whole assets
    // cannot satisfy Range requests. FixedLengthStream preserves framing without
    // buffering the whole asset and rejects truncated/oversized bodies natively.
    // Keep an equivalent byte-count guard for non-Workers test runtimes.
    let received=0
    const framing=typeof FixedLengthStream==='function'?new FixedLengthStream(length):new TransformStream({transform(chunk,controller){received+=chunk.byteLength;if(received>length)throw Error('length');controller.enqueue(chunk)},flush(){if(received!==length)throw Error('length')}})
    const body=object.body.pipeThrough(framing)
    return new Response(body,{status:range?206:200,headers:responseHeaders})
  }catch{return fail(503)}
}
