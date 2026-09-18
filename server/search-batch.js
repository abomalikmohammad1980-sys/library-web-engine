// Public search objects only. No account keys, arbitrary URLs, or writes.
const CAP=16*1024*1024,PART=2*1024*1024
export async function onRequest({request,env}){
 const fail=(status)=>new Response('Search batch unavailable',{status,headers:{'cache-control':'no-store'}})
 if(request.method!=='POST')return fail(405)
 if(request.headers.get('origin')&&request.headers.get('origin')!==new URL(request.url).origin)return fail(403)
 let input
 try{if(!request.body)return fail(400);const reader=request.body.getReader(),chunks=[];let size=0;try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>12000)return fail(413);chunks.push(value)}}finally{await reader.cancel();reader.releaseLock()}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length}input=JSON.parse(new TextDecoder().decode(bytes))}catch{return fail(400)}
 if(!Array.isArray(input)||!input.length||input.length>24)return fail(400)
 const jobs=[]
 for(const row of input){
  if(!row||typeof row.path!=='string'||Object.keys(row).some(k=>!['path','range'].includes(k)))return fail(400)
  const control=/^\/r2\/(khezana-search-v2-0[0-7]\/control\/(?:manifest\.json|(?:indexes|term-indexes)\/\d{4}\.json))$/.exec(row.path)
  const archive=/^\/r2\/(khezana-search-v2-0[0-7]\/archives\/\d{6}\.bin)$/.exec(row.path)
  if(control&&row.range===undefined)jobs.push({key:control[1]})
  else if(archive&&typeof row.range==='string'){
   const m=/^bytes=(\d+)-(\d+)$/.exec(row.range);if(!m)return fail(400)
   const offset=Number(m[1]),end=Number(m[2]),length=end-offset+1
   if(!Number.isSafeInteger(offset)||!Number.isSafeInteger(end)||offset<0||length<1||length>PART)return fail(400)
   jobs.push({key:archive[1],offset,length})
  }else return fail(400)
 }
 const bucket=env.PUBLIC_LIBRARY_R2??env.LIBRARY_R2,rows=new Array(jobs.length);let cursor=0,total=0
 try{
  await Promise.all(Array.from({length:Math.min(6,jobs.length)},async()=>{while(cursor<jobs.length){const i=cursor++,job=jobs[i],object=await bucket.get(job.key,job.length?{range:{offset:job.offset,length:job.length}}:undefined)
   if(!object){rows[i]={status:404,headers:{},bytes:new Uint8Array()};continue}
   const length=job.length??object.size;total+=length
   if(!Number.isSafeInteger(length)||length>PART||total>CAP||job.length&&(object.range?.offset!==job.offset||object.range?.length!==job.length||job.offset+job.length>object.size)){await object.body?.cancel();throw Error('batch_size')}
   const bytes=new Uint8Array(await object.arrayBuffer());if(bytes.length!==length)throw Error('batch_length')
   rows[i]={status:job.length?206:200,headers:{'content-length':String(length),'content-type':job.length?'application/octet-stream':'application/json',...(job.length?{'content-range':`bytes ${job.offset}-${job.offset+length-1}/${object.size}`}:{})},bytes}
  }}))
  const meta=new TextEncoder().encode(JSON.stringify(rows.map(({status,headers,bytes})=>({status,headers,length:bytes.length}))))
  const frame=new Uint8Array(4+meta.length+total);new DataView(frame.buffer).setUint32(0,meta.length);frame.set(meta,4);let offset=4+meta.length
  for(const row of rows){frame.set(row.bytes,offset);offset+=row.bytes.length}
  return new Response(new Blob([frame]).stream().pipeThrough(new CompressionStream('gzip')),{headers:{'content-type':'application/octet-stream','content-encoding':'gzip','cache-control':'no-store','x-search-batch':'1','x-content-type-options':'nosniff'},encodeBody:'manual'})
 }catch{return fail(503)}
}
