import {claimPublicBookIndex,checkpointPublicBookIndex,activatePublicBookIndex,failPublicBookIndex} from '../_public-book-index-jobs.js'
import {preparePublicBookSearch} from '../_public-book-search.js'
import {validatePdfClassification,attestPdfClassification} from '../_public-book-pdf-policy.js'
import {attestPublicBookExtraction} from '../_public-book-event-outbox.js'

const encoder=new TextEncoder(),LIMIT=16*1024*1024
const json=(body,status=200)=>Response.json(body,{status,headers:{'Cache-Control':'no-store','X-Robots-Tag':'noindex'}})
const sha=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('')
async function authorized(request,secret){
 if(typeof secret!=='string'||! /^[A-Za-z0-9_-]{32,128}$/.test(secret))return false
 const value=request.headers.get('Authorization')??''
 if(!/^Bearer [A-Za-z0-9_-]{32,128}$/.test(value))return false
 // WebCrypto verification avoids a direct secret string comparison.
 const key=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['sign','verify'])
 const supplied=await crypto.subtle.importKey('raw',encoder.encode(value.slice(7)),{name:'HMAC',hash:'SHA-256'},false,['sign'])
 return crypto.subtle.verify('HMAC',key,await crypto.subtle.sign('HMAC',supplied,encoder.encode('public-book-index/1')),encoder.encode('public-book-index/1'))
}
async function bounded(body,limit){
 if(!body)throw Error('invalid_body')
 const reader=body.getReader(),chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>limit)throw Error('body_too_large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}return bytes
}
async function sourceBytes(bucket,source){
 if(!Number.isSafeInteger(source.byte_length)||source.byte_length<1||source.byte_length>20*1024*1024)throw Error('source_size_bound')
 const object=await bucket.get(source.object_key)
 if(!object||object.size!==source.byte_length)throw Error('source_size_mismatch')
 const bytes=await bounded(object.body,source.byte_length)
 if(bytes.length!==source.byte_length)throw Error('source_size_mismatch')
 return bytes
}
async function leased(db,lease,now,target){
 if(!lease||typeof lease.book_id!=='string'||lease.book_id.length>200||!Number.isSafeInteger(lease.generation)||! /^[A-Za-z0-9_-]{16,128}$/.test(lease.lease_token??''))return null
 if(target&&target.bookId!==lease.book_id)return null
 const row=await db.prepare("SELECT j.*,e.object_key,e.byte_length,e.mime_type,e.title,e.author FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=?1 AND j.generation=?2 AND j.lease_token=?3 AND j.state='running' AND j.lease_until>?4 AND (?5 IS NULL OR EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=j.book_id AND s.index_generation=j.generation AND s.content_version=?5 AND s.visibility='public'))").bind(lease.book_id,lease.generation,lease.lease_token,now,target?.contentVersion??null).first()
 return row?{...row,...(target?{target}:{})}:null
}
export function validateExtraction(value,mime,env={}){
 const pdf=mime==='application/pdf'
 if(pdf&&value?.contract)throw Error('invalid_extraction')
 if(!value||value.coverageMode!==(pdf?'pdf-bookmarks-only':'text-and-headings')||!Array.isArray(value.rows)||!Array.isArray(value.headings)||value.rows.length>100000||value.headings.length>100000||(pdf&&value.rows.length))throw Error('invalid_extraction')
 const anchorKeys=['paragraphIndex','pageIndex','volumeIndex','page','part','pageId','id','level','bookmarkId','bookmark','pageLabel','partLabel']
 const clean=(row,heading)=>{
  const key=heading?'value':'text';if(!row||typeof row[key]!=='string'||row[key].length>1000000)throw Error('invalid_extraction')
  const output={[key]:row[key]}
  for(const name of anchorKeys)if(row[name]!==undefined){const v=row[name];if(!(typeof v==='string'&&v.length<=1000)&&!(Number.isSafeInteger(v)&&v>=0))throw Error('invalid_extraction');output[name]=v}
  return output
 }
 return {coverageMode:value.coverageMode,rows:value.rows.map(r=>clean(r,false)),headings:value.headings.map(r=>clean(r,true)),...(pdf&&value.pdfClassification?{pdfClassification:validatePdfClassification(value.pdfClassification,env.sourceSha256)}:{})}
}
export async function onRequest(context){
 const {request,env}=context
 if(env.PUBLIC_BOOK_INGESTION_ENABLED!=='true'||!await authorized(request,env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN))return json({error:'not_found'},404)
 if(request.method!=='POST')return json({error:'method_not_allowed'},405)
 const now=()=>Math.floor(Date.now()/1000),db=env.VISITORS_DB,bucket=env.LIBRARY_R2
 let step='input'
 try{
  const input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await bounded(request.body,LIMIT)))
  if(!input||!['claim','source','map','complete','fail'].includes(input.op))return json({error:'invalid_operation'},400)
  const target=input.target
  if(target!==undefined&&(!target||typeof target.bookId!=='string'||!target.bookId||target.bookId.length>200||!Number.isSafeInteger(target.contentVersion)||target.contentVersion<1||Object.keys(target).some(key=>!['bookId','contentVersion'].includes(key))))return json({error:'invalid_target'},400)
  if(env.PUBLIC_BOOK_TARGETED_ONLY==='true'&&!target)return json({error:'target_required'},400)
  if(input.op==='claim'){
   step='claim'
   if(Object.keys(input).some(key=>!['op','target'].includes(key)))return json({error:'invalid_operation'},400)
   const job=await claimPublicBookIndex(db,{token:crypto.randomUUID(),now:now(),leaseSeconds:300,PDF_TEXT_INDEXING:env.PDF_TEXT_INDEXING,target})
   if(!job)return json({job:null})
   const multipart=await db.prepare("SELECT COUNT(*) n FROM user_book_assets WHERE book_id=?1 AND kind='volume'").bind(job.book_id).first()
   if(Number(multipart?.n)>0){await failPublicBookIndex(db,job,now(),'multipart_adapter_required',{permanent:true});return json({skipped:true})}
   return json({job:{book_id:job.book_id,generation:job.generation,lease_token:job.lease_token,mime:job.source.mime_type,requiredCoverage:job.requiredCoverage,...(target?{target}:{})}})
  }
  step='lease'
  const job=await leased(db,input.lease,now(),target);if(!job)return json({error:'lease_expired'},409)
  if(target){
   if(target.bookId!==job.book_id)return json({error:'lease_expired'},409)
   const current=await db.prepare("SELECT 1 ok FROM public_book_event_state WHERE book_id=?1 AND content_version=?2 AND index_generation=?3 AND visibility='public'").bind(job.book_id,target.contentVersion,job.generation).first()
   if(!current)return json({error:'lease_expired'},409)
  }
  if(input.op==='fail'){
   // No caller-controlled permanent flag: bounded retries remain authoritative.
   if(!/^[a-z][a-z0-9_]{0,79}$/.test(input.code??''))return json({error:'invalid_error'},400)
   return json({ok:await failPublicBookIndex(db,job,now(),input.code,{permanent:!!target})})
  }
  step='source'
  const bytes=await sourceBytes(bucket,job),sourceSha256=await sha(bytes)
  if(input.op==='source'){
   if(!await leased(db,input.lease,now(),target))return json({error:'lease_expired'},409)
   return new Response(bytes,{headers:{'Content-Type':'application/octet-stream','Cache-Control':'no-store','X-Source-Sha256':sourceSha256,'X-Robots-Tag':'noindex'}})
  }
  if(input.op==='map'){
   step='map'
   const bundle=await db.prepare('SELECT manifest_json,object_key,sha256,byte_length FROM user_book_word_bundles WHERE book_id=?1').bind(job.book_id).first()
   if(!bundle)return json({error:'word_map_required'},422)
   const manifest=JSON.parse(bundle.manifest_json)
   if(manifest.contract!=='khizana-word-bundle/1'||manifest.sourceSha256!==sourceSha256||manifest.mapSha256!==bundle.sha256||bundle.byte_length>LIMIT)throw Error('word_bundle_source_mismatch')
   const map=await sourceBytes(bucket,bundle)
   if(await sha(map)!==bundle.sha256||JSON.parse(new TextDecoder().decode(map)).totalPages!==manifest.totalPages)throw Error('word_map_source_mismatch')
   if(!await leased(db,input.lease,now(),target))return json({error:'lease_expired'},409)
   return new Response(map,{headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Source-Sha256':sourceSha256,'X-Robots-Tag':'noindex'}})
  }
  if(input.sourceSha256!==sourceSha256)return json({error:'source_changed'},409)
  step='validate'
  const extracted=validateExtraction(input.extracted,job.mime_type,{...env,sourceSha256})
  const parserVersion='bounded-account-v1'
  const artifact=encoder.encode(JSON.stringify({...extracted,contract:'public-book-index/1',bookId:job.book_id,generation:job.generation,sourceSha256,parserVersion,title:job.title,author:job.author}))
  if(artifact.length>LIMIT)throw Error('body_too_large')
  const manifestSha256=await sha(artifact),artifactKey=`public-book-index/v1/${manifestSha256}.json`
  if(!await leased(db,input.lease,now(),target))return json({error:'lease_expired'},409)
  step='store'
  await bucket.put(artifactKey,artifact,{httpMetadata:{contentType:'application/json'}})
  step='verify'
  const stored=await sourceBytes(bucket,{object_key:artifactKey,byte_length:artifact.length})
  if(await sha(stored)!==manifestSha256||await sha(await sourceBytes(bucket,job))!==sourceSha256)throw Error('artifact_source_changed')
  if(extracted.pdfClassification&&!await attestPdfClassification(db,job,now(),extracted.pdfClassification,sourceSha256))return json({error:'lease_expired'},409)
  if(!await attestPublicBookExtraction(db,job,now(),{tocSource:extracted.headings.length?(job.mime_type==='application/pdf'?'pdf_bookmarks':'native'):'none',ocr:false}))return json({error:'lease_expired'},409)
  step='search'
  const staged=await preparePublicBookSearch(db,job,JSON.parse(new TextDecoder().decode(artifact)),manifestSha256,now(),env)
  if(staged==='pending'){
   const renewed=await db.prepare("UPDATE public_book_index_jobs SET lease_until=?1 WHERE book_id=?2 AND generation=?3 AND lease_token=?4 AND state='running' AND lease_until>?5 AND EXISTS(SELECT 1 FROM public_book_index_eligible e WHERE e.id=?2 AND e.generation=?3) RETURNING book_id").bind(now()+300,job.book_id,job.generation,job.lease_token,now()).first()
   return renewed?.book_id===job.book_id?json({ok:false,pending:true}):json({error:'lease_expired'},409)
  }
  if(!staged)return json({error:'search_staging_incomplete'},409)
  const checkpoint=Math.max(1,job.checkpoint)
  step='checkpoint'
  if(!await checkpointPublicBookIndex(db,job,now(),checkpoint))return json({error:'lease_expired'},409)
  step='activate'
  const ok=await activatePublicBookIndex(db,job,now(),{manifestSha256,sourceSha256,artifactKey,parserVersion,coverageMode:extracted.coverageMode,complete:true,checkpoint},env)
  return json({ok},ok?200:409)
 }catch{return json({error:env.PUBLIC_BOOK_INDEX_DIAGNOSTICS==='true'?`ingestion_${step}_failed`:'ingestion_operation_failed'},422)}
}
