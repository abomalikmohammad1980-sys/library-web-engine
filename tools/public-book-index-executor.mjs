// Bounded Node extraction shared by isolated tests and the dedicated-token runner.
import {Worker} from 'node:worker_threads'
import {fork} from 'node:child_process'
import {createHash} from 'node:crypto'
import {checkpointPublicBookIndex,activatePublicBookIndex,failPublicBookIndex} from '../alpha-publish/functions/api/_public-book-index-jobs.js'
import {validatePdfClassification,attestPdfClassification} from '../alpha-publish/functions/api/_public-book-pdf-policy.js'
import {preparePublicBookSearch} from '../alpha-publish/functions/api/_public-book-search.js'
import {attestPublicBookExtraction} from '../alpha-publish/functions/api/_public-book-event-outbox.js'
const digest=bytes=>createHash('sha256').update(bytes).digest('hex')
async function readBounded(r2,key,limit){
 let object
 try{object=await r2.get(key)}catch{throw Error('source_unavailable')}
 if(!object?.body)throw Error('source_unavailable')
 if(!Number.isSafeInteger(object.size)||object.size<1||object.size>limit)throw Error('source_size_bound')
 const reader=object.body.getReader(),chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit||size>object.size)throw Error('source_size_bound');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 if(size!==object.size)throw Error('source_size_mismatch')
 return Buffer.concat(chunks,size)
}
/** Search needs only the source-bound paragraph/page correspondence. Keep the
 * full reader map in storage, and do not clone native font/layout evidence into
 * the 256 MiB extraction worker. The accepted input cap is 200 MiB. */
export function projectPublicWordIndexMap(map){
 if(map===undefined)return map;
 if(Buffer.byteLength(JSON.stringify(map))>200*1024*1024)throw Error('word_map_size_bound');
 if(!map||typeof map!=='object'||!Array.isArray(map.paragraphs))return map;
 const projected={totalPages:map.totalPages,paragraphCount:map.paragraphCount,paragraphs:map.paragraphs.map(p=>p&&typeof p==='object'?{text:p.text,paragraphIndex:p.paragraphIndex,physicalPage:p.physicalPage}:p)};
 if(Buffer.byteLength(JSON.stringify(projected))>16*1024*1024)throw Error('word_map_size_bound');
 return projected;
}
export function extractPublicBookBounded(input,{timeoutMs}={}){
 const wordInput=String(input?.mime).split(';',1)[0].trim().toLowerCase()==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
 timeoutMs??=wordInput?120000:30000
 if(String(input?.mime).split(';',1)[0].trim().toLowerCase()==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'&&input?.map!==undefined)input={...input,map:projectPublicWordIndexMap(input.map)};
 if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>(wordInput?120000:30000))throw Error('invalid_extraction_timeout')
 if(!(input?.bytes instanceof Uint8Array)||!input.bytes.length||!Number.isSafeInteger(input.bytes.length))throw Error('source_size_bound')
 if(input.map!==undefined&&Buffer.byteLength(JSON.stringify(input.map))>16*1024*1024)throw Error('word_map_size_bound')
 return new Promise((resolve,reject)=>{
  // PDF.js may load a native canvas dependency. Isolate it in a process so a
  // native teardown fault cannot kill the scheduler or another book's parser.
  const pdf=String(input.mime).split(';',1)[0].trim().toLowerCase()==='application/pdf'
  const word=String(input.mime).split(';',1)[0].trim().toLowerCase()==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  const isolated=pdf||word
  const worker=isolated?fork(new URL('./public-book-index-extract-worker.mjs',import.meta.url),[],{execArgv:[word?'--max-old-space-size=2048':'--max-old-space-size=256'],env:{},serialization:'advanced',windowsHide:true,stdio:['ignore','ignore','ignore','ipc']}):new Worker(new URL('./public-book-index-extract-worker.mjs',import.meta.url),{workerData:input,execArgv:[],env:{},resourceLimits:{maxOldGenerationSizeMb:256,maxYoungGenerationSizeMb:32}})
  let done=false
  const finish=(error,result)=>{if(done)return;done=true;clearTimeout(timer);if(isolated)worker.kill();else void worker.terminate();error?reject(error):resolve(result)}
  const timer=setTimeout(()=>finish(Error('extraction_timeout')),timeoutMs)
  worker.on('message',message=>{if(isolated&&message.workerReady===true){worker.send(input,error=>{if(error)finish(Error('extraction_worker_failed'))});return}finish(message.error?Error(message.error):null,message.result)})
  worker.once('error',()=>finish(Error('extraction_worker_failed')))
  worker.once('exit',()=>{if(!done)finish(Error('extraction_worker_failed'))})

 })
}
export async function executePublicBookIndex({db,r2,job,env={},now=()=>Math.floor(Date.now()/1000)}){
 const fence=async()=>{if(!await checkpointPublicBookIndex(db,job,now(),job.checkpoint))throw Error('publication_changed')}
 try{
  await fence()
  const assets=await db.prepare("SELECT COUNT(*) n FROM user_book_assets WHERE book_id=?1 AND kind='volume'").bind(job.book_id).first()
  if(Number(assets?.n)>0)throw Error('multipart_adapter_required')
  const bytes=await readBounded(r2,job.source.object_key,Number.MAX_SAFE_INTEGER)
  if(bytes.length!==job.source.byte_length)throw Error('source_size_mismatch')
  const sourceSha256=digest(bytes)
  let map
  if(job.source.mime_type==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
   const bundle=await db.prepare('SELECT manifest_json,object_key,sha256,byte_length FROM user_book_word_bundles WHERE book_id=?1').bind(job.book_id).first()
   if(bundle){
   const manifest=JSON.parse(bundle.manifest_json)
   if(manifest.contract!=='khizana-word-bundle/1'||manifest.sourceSha256!==sourceSha256||manifest.mapSha256!==bundle.sha256)throw Error('word_bundle_source_mismatch')
   const mapBytes=await readBounded(r2,bundle.object_key,200*1024*1024)
   if(mapBytes.length!==bundle.byte_length||digest(mapBytes)!==bundle.sha256)throw Error('word_map_digest_mismatch')
   map=JSON.parse(mapBytes.toString('utf8'))
   if(map.totalPages!==manifest.totalPages)throw Error('word_map_source_mismatch')
   }
  }
  await fence()
  let extracted=await extractPublicBookBounded({mime:job.source.mime_type,bytes:new Uint8Array(bytes),map,PDF_TEXT_INDEXING:env.PDF_TEXT_INDEXING})
  if(extracted.pdfClassification)validatePdfClassification(extracted.pdfClassification,sourceSha256)
  const parserVersion='bounded-account-v1'
  await fence()
  const payload=Buffer.from(JSON.stringify({...extracted,contract:'public-book-index/1',bookId:job.book_id,generation:job.generation,sourceSha256,parserVersion,title:job.source.title,author:job.source.author}))
  if(payload.length>16*1024*1024)throw Error('extraction_output_bound')
  const manifestSha256=digest(payload),artifactKey=`public-book-index/v1/${manifestSha256}.json`
  try{await r2.put(artifactKey,payload,{httpMetadata:{contentType:'application/json'}})}catch{throw Error('storage_unavailable')}
  if(digest(await readBounded(r2,artifactKey,16*1024*1024))!==manifestSha256)throw Error('artifact_digest_mismatch')
  // Detect a same-key replacement, not merely a changed metadata generation.
  if(digest(await readBounded(r2,job.source.object_key,Number.MAX_SAFE_INTEGER))!==sourceSha256)throw Error('source_changed')
  await fence()
  if(extracted.pdfClassification&&!await attestPdfClassification(db,job,now(),extracted.pdfClassification,sourceSha256))throw Error('publication_changed')
  const checkpoint=Math.max(1,job.checkpoint)
  if(!await checkpointPublicBookIndex(db,job,now(),checkpoint))throw Error('publication_changed')
  const receipt={manifestSha256,sourceSha256,artifactKey,parserVersion,coverageMode:extracted.coverageMode,complete:true,checkpoint}
  if(!await activatePublicBookIndex(db,job,now(),receipt,env))throw Error('publication_changed')
  return {ready:true,...receipt}
 }catch(error){
  const code=/^[a-z][a-z0-9_]{0,79}$/.test(error.message)?error.message:'source_parse_failed'
  const transient=['source_unavailable','storage_unavailable','artifact_digest_mismatch','extraction_timeout','extraction_worker_failed','ocr_required'].includes(code)
  await failPublicBookIndex(db,job,now(),code,{permanent:!transient})
  return {ready:false,error:code}
 }
}




