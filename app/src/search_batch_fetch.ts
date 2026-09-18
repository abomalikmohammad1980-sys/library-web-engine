/** Transport batching only. Existing callers retain all SHA and range checks. */
export function searchBatchFetch(fetcher:typeof fetch,origin:string):typeof fetch{
 type Job={input:RequestInfo|URL;init:RequestInit|undefined;path:string;range:string|undefined;resolve:(r:Response)=>void;reject:(e:unknown)=>void}
 let queue:Job[]=[],timer:ReturnType<typeof setTimeout>|undefined
 const flush=()=>{timer=undefined;const pending=queue;queue=[];for(let i=0;i<pending.length;i+=24)void send(pending.slice(i,i+24))}
 async function send(jobs:Job[]){
  let responses:Response[]
  try{
   const r=await fetcher(origin+'/api/search/batch',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(jobs.map(({path,range})=>({path,...(range?{range}:{})}))),signal:AbortSignal.timeout(30000)})
   if(!r.ok||r.headers.get('x-search-batch')!=='1'){await r.body?.cancel();throw Error('batch_unavailable')}
   const reader=r.body!.getReader(),chunks:Uint8Array[]=[];let size=0
   try{for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>16*1024*1024+65536)throw Error('batch_size');chunks.push(value)}}finally{await reader.cancel();reader.releaseLock()}
   const bytes=new Uint8Array(size);let cursor=0;for(const chunk of chunks){bytes.set(chunk,cursor);cursor+=chunk.length}
   if(size<4)throw Error('batch_frame');const metaLength=new DataView(bytes.buffer).getUint32(0);if(metaLength>65532||metaLength+4>size)throw Error('batch_meta')
   const rows=JSON.parse(new TextDecoder().decode(bytes.subarray(4,4+metaLength))) as Array<{status:number;headers:Record<string,string>;length:number}>
   if(!Array.isArray(rows)||rows.length!==jobs.length)throw Error('batch_count');cursor=4+metaLength;responses=[]
   for(const row of rows){if(![200,206,404].includes(row.status)||!Number.isSafeInteger(row.length)||row.length<0||row.length>2*1024*1024||cursor+row.length>size)throw Error('batch_row');responses.push(new Response(bytes.slice(cursor,cursor+row.length),{status:row.status,headers:row.headers}));cursor+=row.length}
   if(cursor!==size)throw Error('batch_trailing')
  }catch{
   await Promise.all(jobs.map(async job=>{try{job.resolve(await fetcher(job.input,job.init))}catch(e){job.reject(e)}}));return
  }
  jobs.forEach((job,i)=>{if(job.init?.signal?.aborted)job.reject(job.init.signal.reason);else job.resolve(responses[i]!)})
 }
 return ((input,init)=>{
  const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url,origin),headers=new Headers(init?.headers),range=headers.get('range')??undefined
  const eligible=url.origin===origin&&(!init?.method||init.method==='GET')&&(/^\/r2\/khezana-search-v2-0[0-7]\/control\/(?:manifest\.json|(?:indexes|term-indexes)\/\d{4}\.json)$/.test(url.pathname)||/^\/r2\/khezana-search-v2-0[0-7]\/archives\/\d{6}\.bin$/.test(url.pathname)&&!!range&&Number(range.split('-')[1])-Number(range.slice(6).split('-')[0])+1<=2*1024*1024)
  if(!eligible||init?.signal?.aborted)return fetcher(input,init)
  return new Promise<Response>((resolve,reject)=>{queue.push({input,init,path:url.pathname,range,resolve,reject});timer??=setTimeout(flush,4)})
 }) as typeof fetch
}
