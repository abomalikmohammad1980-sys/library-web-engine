export async function boundedBytes(stream,limit){
 const reader=stream.getReader(),chunks=[];let size=0
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw Error('seo_toc_budget');chunks.push(value)}}catch(error){await reader.cancel();throw error}finally{reader.releaseLock()}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes
}
export async function readSeoToc(assets,origin,ref,bucket){
 if(!/^toc-\d{3}\.bin$/.test(ref.path)||![ref.offset,ref.bytes,ref.rawBytes,ref.count].every(Number.isSafeInteger)||ref.offset<0||ref.bytes<1||ref.bytes>24*1024*1024||ref.rawBytes<2||ref.rawBytes>16*1024*1024||ref.count<0||!/^[a-f0-9]{64}$/.test(ref.sha256))throw Error('seo_toc_reference')
 let stream
 if(bucket){
  if(!/^seo\/toc\/[a-f0-9]{64}\.bin$/.test(ref.objectKey??''))throw Error('seo_toc_object_key')
  const object=await bucket.get(ref.objectKey,{range:{offset:ref.offset,length:ref.bytes}})
  if(!object?.body)throw Error('seo_toc_object_missing')
  stream=object.body
 }else{
  const response=await assets.fetch(new Request(new URL('/data/seo/'+ref.path,origin),{headers:{Range:`bytes=${ref.offset}-${ref.offset+ref.bytes-1}`}}))
  if(response.status!==206||response.headers.get('content-range')?.split('/')[0]!==`bytes ${ref.offset}-${ref.offset+ref.bytes-1}`)throw Error('seo_toc_range')
  stream=response.body
 }
 const bytes=await boundedBytes(stream,ref.bytes)
 const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join('')
 if(bytes.length!==ref.bytes||sha!==ref.sha256)throw Error('seo_toc_integrity')
 const raw=await boundedBytes(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),ref.rawBytes)
 if(raw.length!==ref.rawBytes)throw Error('seo_toc_size')
 const rows=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw))
 if(!Array.isArray(rows)||rows.length!==ref.count||rows.some(row=>typeof row.title!=='string'||row.pageIndex!==null&&(!Number.isSafeInteger(row.pageIndex)||row.pageIndex<0)))throw Error('seo_toc_rows')
 return rows
}
