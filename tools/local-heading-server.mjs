import {open,readFile,realpath,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {resolve,relative,sep} from 'node:path'
import {createServer} from 'node:http'
const ORIGIN='https://heading.local'

// Local experiment only: no remote fetch, user/private files, or mutable index writes.
export async function localHeadingFetch(directory,binaryDirectory){
 const root=await realpath(directory),manifestBytes=await readFile(resolve(root,'manifest.json')),manifest=JSON.parse(manifestBytes)
 if(manifest.contract!=='khizana-heading-search/2')throw Error('heading_local_requires_v2')
 const listed=new Map([['manifest.json',manifestBytes.length]])
 for(const a of [...manifest.rows,...manifest.postings,...manifest.rowPointers]){if(!/^(rows|postings|pointers)\/[a-f0-9]{64}\.(json|bin)$/.test(a.path)||!Number.isSafeInteger(a.bytes)||a.bytes<1||a.bytes>1048576)throw Error('heading_local_invalid_asset');listed.set(a.path,a.bytes)}
 if(!/^dictionary\/[a-f0-9]{64}\.json\.gz$/.test(manifest.dictionary.path)||!Number.isSafeInteger(manifest.dictionary.gzipBytes)||manifest.dictionary.gzipBytes<1||manifest.dictionary.gzipBytes>32*1024*1024)throw Error('heading_local_invalid_asset');listed.set(manifest.dictionary.path,manifest.dictionary.gzipBytes)
 let binaryRoot,dictionaryBinary;if(binaryDirectory){binaryRoot=await realpath(binaryDirectory);dictionaryBinary=JSON.parse(await readFile(resolve(binaryRoot,'descriptor.json')));if(!/^dictionary\/[a-f0-9]{64}\.compact\.bin\.gz$/.test(dictionaryBinary.path)||!Number.isSafeInteger(dictionaryBinary.gzipBytes)||dictionaryBinary.gzipBytes<1||dictionaryBinary.gzipBytes>32*1024*1024)throw Error('heading_local_invalid_binary_asset');listed.set(dictionaryBinary.path,dictionaryBinary.gzipBytes)}
 const metrics={reads:0,bytes:0}
 const fetcher=async(input,init={})=>{
  init.signal?.throwIfAborted();const url=new URL(String(input)),method=init.method??'GET'
  if(url.origin!==ORIGIN||method!=='GET')return new Response(null,{status:403})
  const key=url.pathname.slice(1),size=listed.get(key);if(size===undefined)return new Response(null,{status:404})
  const range=new Headers(init.headers).get('range'),match=range?.match(/^bytes=(\d+)-(\d+)$/)
  if(range&&!match)return new Response(null,{status:416})
  const start=match?Number(match[1]):0,end=match?Number(match[2]):size-1
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=size)return new Response(null,{status:416})
  const assetRoot=dictionaryBinary?.path===key?binaryRoot:root,path=await realpath(resolve(assetRoot,key)),rel=relative(assetRoot,path)
  if(!rel||rel==='..'||rel.startsWith(`..${sep}`))return new Response(null,{status:403})
  const length=end-start+1,body=Buffer.alloc(length),file=await open(path,'r')
  try{let at=0;while(at<length){init.signal?.throwIfAborted();const {bytesRead}=await file.read(body,at,length-at,start+at);if(!bytesRead)throw Error('heading_local_short_read');at+=bytesRead}}finally{await file.close()}
  metrics.reads++;metrics.bytes+=length
  return new Response(body,{status:range?206:200,headers:{'content-length':String(length),...(range?{'content-range':`bytes ${start}-${end}/${size}`}:{})}})
 }
 return{fetcher,manifest,metrics,dictionaryBinary}
}

export async function startLocalHeadingServer(client){
 let active=false,expectedHost=''
 const server=createServer(async(req,res)=>{
  const reply=(status,payload)=>{if(res.destroyed)return;const body=JSON.stringify(payload);res.writeHead(status,{'content-type':'application/json; charset=utf-8','content-length':Buffer.byteLength(body),'cache-control':'no-store','x-content-type-options':'nosniff'});res.end(body)}
  if(req.headers.host!==expectedHost||req.headers.origin&&req.headers.origin!==`http://${expectedHost}`)return reply(403,{error:'loopback_only'})
  if(req.method!=='GET')return reply(405,{error:'method'})
  let url;try{url=new URL(req.url,'http://127.0.0.1')}catch{return reply(400,{error:'input'})}
  const q=url.searchParams.get('q')??'',offset=Number(url.searchParams.get('offset')??0),limit=Number(url.searchParams.get('limit')??20),bookIds=url.searchParams.getAll('bookId')
  if(url.pathname!=='/search')return reply(404,{error:'route'})
  if(!q.trim()||q.length>300||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(limit)||limit<1||limit>20||bookIds.length>100||bookIds.some(id=>!/^[0-9]{1,20}$/.test(id)))return reply(400,{error:'input'})
  if(active)return reply(429,{error:'busy'})
  active=true;const controller=new AbortController(),onClose=()=>{if(!res.writableEnded)controller.abort()};res.on('close',onClose)
  try{reply(200,await client.search(q,{offset,limit,...(bookIds.length?{bookIds}:{}),signal:controller.signal}))}catch(error){const known=['heading_search_memory_budget','heading_search_integrity','heading_search_range_unavailable'];reply(503,{error:known.includes(error?.message)?error.message:error?.name==='TimeoutError'?'search_deadline':'search_failed'})}finally{active=false;res.off('close',onClose)}
 })
 server.requestTimeout=30000;server.headersTimeout=10000
 await new Promise((ok,fail)=>{server.once('error',fail);server.listen(0,'127.0.0.1',ok)})
 expectedHost=`127.0.0.1:${server.address().port}`
 return{url:`http://${expectedHost}`,close:()=>new Promise((ok,fail)=>{server.close(error=>error?fail(error):ok());server.closeAllConnections()})}
}

export async function auditLocalHeadingServer(Client,directory,output,clientOptions={},auditOptions={}){
 const samples=[],gcExposed=typeof globalThis.gc==='function',manifestBytes=await readFile(resolve(directory,'manifest.json'))
 for(const query of auditOptions.queries??['النسخ','النسخة','النسخ المعتمدة','اختلاف العلماء','باب النسخ','لفظة معدومة يقينا']){
  const adapter=await localHeadingFetch(directory,auditOptions.binaryDirectory);if(gcExposed)globalThis.gc();const baseline=process.memoryUsage()
  const stages=[];let phaseMetrics;let client=new Client({...clientOptions,...(adapter.dictionaryBinary?{dictionaryBinary:adapter.dictionaryBinary}:{}),onStage:name=>stages.push({name,memory:process.memoryUsage()}),onMetrics:metrics=>{phaseMetrics=metrics},baseURL:ORIGIN+'/',fetch:adapter.fetcher}),server=await startLocalHeadingServer(client)
  const sample={query,baseline,afterClient:process.memoryUsage(),stages,phases:[]}
  try{for(const phase of ['cold','warm']){const start=performance.now(),reads=adapter.metrics.reads,bytes=adapter.metrics.bytes,cpu=process.cpuUsage(),response=await fetch(`${server.url}/search?q=${encodeURIComponent(query)}`),body=await response.text(),result=JSON.parse(body),cpuUsed=process.cpuUsage(cpu)
   sample.phases.push({phase,httpRequests:1,status:response.status,ms:Math.round(performance.now()-start),cpuMs:Math.round((cpuUsed.user+cpuUsed.system)/1000),payloadBytes:Buffer.byteLength(body),diskReads:adapter.metrics.reads-reads,diskBytes:adapter.metrics.bytes-bytes,total:result.total,hits:result.hits?.length,totalExact:result.totalExact,coverageComplete:result.coverageComplete,error:result.error,timings:phaseMetrics,memory:process.memoryUsage()})
   if(auditOptions.collectQueryGc&&gcExposed){globalThis.gc();sample.phases.at(-1).memoryAfterGc=process.memoryUsage()}
  }}finally{await server.close();server=null;client=null}
  await new Promise(resolve=>setImmediate(resolve));sample.afterRelease=process.memoryUsage();if(gcExposed)globalThis.gc();sample.afterGc=gcExposed?process.memoryUsage():null;samples.push(sample)
 }
 const report={contract:'khizana/local-heading-server-prototype/1',createdAt:new Date().toISOString(),manifestSha256:createHash('sha256').update(manifestBytes).digest('hex'),source:resolve(directory),gcExposed,notes:['Loopback only, no public deployment. One HTTP request per page; disk reads remain internal.','Cold means new client cache, not cold OS disk cache. Timings include local HTTP and JSON.','Memory is total Node process including imports, transforms, HTTP and test harness, not Worker isolate attribution.','Row cache is 256 entries / 4 MiB encoded bytes; pointer/posting caches each two files. No unlimited result cache.','No assurance of compatibility with 128 MiB Workers; further memory/CPU measurement required.'],samples}
 if(output)await writeFile(output,JSON.stringify(report,null,2));return report
}
