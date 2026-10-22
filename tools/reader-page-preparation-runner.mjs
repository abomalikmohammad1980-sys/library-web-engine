import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import {createHash,randomUUID} from 'node:crypto'
import {spawn} from 'node:child_process'
import {fileURLToPath,pathToFileURL} from 'node:url'
const HASH=/^[a-f0-9]{64}$/,ID=/^src-[a-f0-9]{32,64}$/
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms))
export function readerRunnerConfig(env){
 if(env.PUBLIC_BOOK_INGESTION_ENABLED!=='true'||env.PUBLIC_BOOK_INGESTION_ACCEPTED!=='true')throw Error('reader_ingestion_not_accepted')
 if(!/^[A-Za-z0-9_-]{32,128}$/.test(env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN??''))throw Error('reader_credentials_missing')
 if(env.PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN!=='https://khzanah.com')throw Error('reader_origin_forbidden')
 if(!ID.test(env.READER_TARGET_BOOK_ID??'')||!HASH.test(env.READER_TARGET_BINDING??''))throw Error('invalid_reader_target')
 return{origin:env.PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN,token:env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN,bookId:env.READER_TARGET_BOOK_ID,binding:env.READER_TARGET_BINDING}
}
export function readerGateway(config,fetcher=fetch){
 return async(op,{method='POST',lease,body,headers={},binary=false}={})=>{
  const url=new URL('/api/internal/reader-page-prepare',config.origin);url.searchParams.set('bookId',config.bookId);url.searchParams.set('binding',config.binding);url.searchParams.set('op',op);if(lease)url.searchParams.set('lease',lease)
  if(headers.part){url.searchParams.set('part',headers.part);headers={...headers};delete headers.part}
  let error
  for(let attempt=0;attempt<5;attempt++){
   try{const response=await fetcher(url,{method,redirect:'error',signal:AbortSignal.timeout(180000),headers:{authorization:'Bearer '+config.token,...(body&&!(body instanceof Uint8Array)?{'content-type':'application/json'}:{}),...headers},...(body?{body:body instanceof Uint8Array?body:JSON.stringify(body)}:{})})
    if(response.status>=500||response.status===429){await response.body?.cancel();throw Error('reader_gateway_unavailable')}
    if(!response.ok){const payload=await response.json().catch(()=>null);throw Object.assign(Error(/^[a-z][a-z0-9_]{0,79}$/.test(payload?.error??'')?payload.error:'reader_gateway_rejected'),{terminal:true})}
    return binary?response:await response.json()
   }catch(cause){if(cause.terminal)throw cause;error=cause;await sleep(Math.min(10000,1000*2**attempt))}
  }
  throw Error('reader_gateway_unavailable',{cause:error})
 }
}
export async function buildReaderChild(dir,builder){
 const proof=JSON.parse(await fs.readFile(path.join(dir,'proof.json'),'utf8'))
 const {buildReaderPagePack}=await import(pathToFileURL(builder));const read=async name=>new Uint8Array(await fs.readFile(path.join(dir,name)))
 const result=await buildReaderPagePack(await read('source.bin'),await read('pdf.bin'),await read('map.bin'),proof)
 if(result.manifest.packBytes!==result.pack.length||sha(result.pack)!==result.manifest.packSha256)throw Error('reader_pack_integrity')
 for(const part of [...result.manifest.pages,...Object.values(result.manifest.assets)])if(sha(result.pack.subarray(part.offset,part.offset+part.length))!==part.sha256)throw Error('reader_page_integrity')
 await fs.writeFile(path.join(dir,'pages.bin'),result.pack);await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(result.manifest))
}
export async function runReaderPreparation(config,{gateway=readerGateway(config),builders=new URL('./reader-builders/',import.meta.url),runChild}={}){
 const claimId=randomUUID(),claimed=await gateway('claim',{headers:{'x-reader-claim-id':claimId}})
 if(claimed.ready)return{ready:true,alreadyReady:true}
 if(claimed.busy)return{ready:false,busy:true}
 const job=claimed.job
 if(!job||job.bookId!==config.bookId||job.binding!==config.binding||!HASH.test(job.compilerSHA256??'')||typeof job.lease!=='string')throw Error('reader_claim_invalid')
 const builder=fileURLToPath(new URL(job.compilerSHA256+'.mjs',builders));if(sha(await fs.readFile(builder))!==job.compilerSHA256)throw Error('reader_compiler_integrity')
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'khzanah-reader-')),lease=job.lease
 let progress={phase:'sources',current:0,total:Object.values(job.sources).reduce((n,s)=>n+s.bytes,0)},heartbeatFailure
 const beat=()=>gateway('heartbeat',{lease,body:progress}).then(()=>{heartbeatFailure=undefined}).catch(error=>{heartbeatFailure=error})
 let beating=false;const timer=setInterval(()=>{if(beating)return;beating=true;void beat().finally(()=>{beating=false})},15000)
 try{
  await fs.writeFile(path.join(dir,'proof.json'),JSON.stringify(job.proof))
  for(const name of ['source','pdf','map']){
   const source=job.sources[name];if(!source||!HASH.test(source.sha256??'')||!Number.isSafeInteger(source.bytes)||source.bytes<1||name==='map'&&source.bytes>200*1024*1024)throw Error('reader_source_invalid')
   const response=await gateway(name,{lease,method:'GET',binary:true});if(response.headers.get('x-source-sha256')!==source.sha256)throw Error('reader_source_integrity')
   const handle=await fs.open(path.join(dir,name+'.bin'),'wx'),hash=createHash('sha256');let bytes=0
   try{for await(const chunk of response.body){bytes+=chunk.length;if(bytes>source.bytes)throw Error('reader_source_integrity');hash.update(chunk);let offset=0;while(offset<chunk.length){const written=await handle.write(chunk,offset,chunk.length-offset);if(written.bytesWritten<1)throw Error('reader_source_write_failed');offset+=written.bytesWritten}progress.current+=chunk.length}}
   finally{await handle.close();await response.body?.cancel().catch(()=>{})}
   if(bytes!==source.bytes||hash.digest('hex')!==source.sha256)throw Error('reader_source_integrity')
  }
  progress={phase:'reader-pages',current:0,total:job.proof.totalPages};await beat()
  if(runChild)await runChild(dir,builder)
  else await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['--max-old-space-size=2048',fileURLToPath(import.meta.url),'--build-child',dir,builder],{windowsHide:true,stdio:['ignore','ignore','pipe']});let error='';child.stderr.on('data',b=>{if(error.length<8192)error+=b.toString()});const deadline=setTimeout(()=>{child.kill();reject(Error('reader_build_timeout'))},8*60*1000);child.once('error',e=>{clearTimeout(deadline);reject(e)});child.once('exit',code=>{clearTimeout(deadline);if(code===0)resolve();else reject(Error(/reader_source_integrity|reader_page_integrity|reader_pack_integrity/.exec(error)?.[0]??(error.includes('heap out of memory')?'reader_resource_limit':'reader_build_failed')))})})
  if(heartbeatFailure)throw heartbeatFailure
  const manifest=JSON.parse(await fs.readFile(path.join(dir,'manifest.json'),'utf8')),begin=await gateway('begin',{lease,body:manifest})
  if(begin.partBytes!==5*1024*1024||!Array.isArray(begin.received))throw Error('reader_upload_invalid')
  progress={phase:'pack-upload',current:begin.received.reduce((n,p)=>n+p.bytes,0),total:manifest.packBytes}
  const received=new Map(begin.received.map(p=>[p.partNumber,p])),handle=await fs.open(path.join(dir,'pages.bin'),'r')
  try{for(let offset=0,number=1;offset<manifest.packBytes;offset+=begin.partBytes,number++){
   const bytes=Buffer.alloc(Math.min(begin.partBytes,manifest.packBytes-offset));const read=await handle.read(bytes,0,bytes.length,offset);if(read.bytesRead!==bytes.length)throw Error('reader_pack_integrity')
   const digest=sha(bytes),prior=received.get(number);if(prior){if(prior.sha256!==digest||prior.bytes!==bytes.length)throw Error('reader_part_changed');continue}
   await gateway('part',{method:'PUT',lease,body:bytes,headers:{part:String(number),'x-reader-part-sha256':digest}});progress.current+=bytes.length
  }}finally{await handle.close()}
  progress={phase:'activating',current:manifest.packBytes,total:manifest.packBytes};await beat();const done=await gateway('finish',{lease,body:manifest});if(done.ready!==true)throw Error('reader_activation_failed');return{ready:true,pages:manifest.totalPages,packBytes:manifest.packBytes}
 }catch(error){
  if(['reader_source_integrity','reader_page_integrity','reader_pack_integrity','reader_source_invalid','reader_compiler_integrity','reader_build_failed','reader_resource_limit'].includes(error.message))await gateway('fail',{lease,body:{error:error.message}}).catch(()=>{})
  // A lost executor/network leaves the fenced lease and confirmed parts intact.
  throw error
 }finally{clearInterval(timer);await fs.rm(dir,{recursive:true,force:true})}
}
if(process.argv[2]==='--build-child')buildReaderChild(process.argv[3],process.argv[4]).catch(error=>{console.error(/^[a-z][a-z0-9_]{0,79}$/.test(error.message)?error.message:'reader_build_failed');process.exitCode=1})
else if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))runReaderPreparation(readerRunnerConfig(process.env)).then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error(/^[a-z][a-z0-9_]{0,79}$/.test(error.message)?error.message:'reader_preparation_failed');process.exitCode=1})
