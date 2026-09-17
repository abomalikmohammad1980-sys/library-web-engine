const MAX_PART_BYTES = 8 * 1024 * 1024
const FIELDS = new Set(['project', 'archive', 'offset', 'length', 'v'])
const fail = (status, message, extra={}) => new Response(message, {status, headers:{'cache-control':'no-store','x-content-type-options':'nosniff',...extra}})

// Transport only: the client must verify the decompressed bytes against the
// trusted index SHA. A caller-supplied v is not a server integrity assertion.
export async function onRequest(context) {
  const request=context.request
  if(request.method!=='GET')return fail(405,'Method Not Allowed',{allow:'GET'})
  const params=new URL(request.url).searchParams
  if(request.headers.has('range') || [...params.keys()].some(key=>!FIELDS.has(key)||params.getAll(key).length!==1))return fail(400,'Invalid packed part')
  const project=params.get('project')??'',archive=params.get('archive')??'',rawOffset=params.get('offset')??'',rawLength=params.get('length')??'',version=params.get('v')??''
  if(!/^[0-7]$/.test(project)||!/^\d{6}$/.test(archive)||!/^\d{1,16}$/.test(rawOffset)||!/^\d{1,8}$/.test(rawLength)||! /^[a-zA-Z0-9_-]{1,160}:[a-f0-9]{64}$/.test(version))return fail(400,'Invalid packed part')
  const offset=Number(rawOffset),length=Number(rawLength)
  if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(length)||length<1||length>MAX_PART_BYTES||!Number.isSafeInteger(offset+length))return fail(400,'Invalid packed part')
  // No user-controlled path fragments: private account objects are unreachable.
  const key=`khezana-search-v2-${project.padStart(2,'0')}/archives/${archive}.bin`
  try {
    const object=await context.env.LIBRARY_R2.get(key,{range:{offset,length}})
    if(!object)return fail(404,'Not Found')
    if(!object.body||!Number.isSafeInteger(object.size)||offset+length>object.size||object.range?.offset!==offset||object.range?.length!==length){await object.body?.cancel();return fail(416,'Invalid packed range')}
    let received=0
    const bounded=object.body.pipeThrough(new TransformStream({
      transform(chunk,controller){received+=chunk.byteLength;if(received>length)throw Error('packed_part_size_mismatch');controller.enqueue(chunk)},
      flush(){if(received!==length)throw Error('packed_part_size_mismatch')},
    }))
    return new Response(bounded.pipeThrough(new CompressionStream('gzip')),{
      status:200,
      // Do not label compressed bytes as an HTTP byte-range response. Browsers
      // decode content-encoding before the existing SHA validation runs.
      headers:{'content-type':'application/octet-stream','content-encoding':'gzip','cache-control':'no-store','x-content-type-options':'nosniff','cross-origin-resource-policy':'same-origin','x-packed-offset':String(offset),'x-packed-length':String(length)},
      encodeBody:'manual',
    })
  } catch {return fail(503,'Packed part unavailable')}
}
