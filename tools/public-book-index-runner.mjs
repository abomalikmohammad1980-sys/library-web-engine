import {pathToFileURL} from 'node:url'
import {createHash} from 'node:crypto'
import {extractPublicBookBounded} from './public-book-index-executor.mjs'
const ORIGINS=new Set(['https://khzanah.com','https://khizana-bok-acceptance-20260917.pages.dev'])
const gatewayErrors=new Set(['not_found','method_not_allowed','invalid_operation','invalid_error','lease_expired','word_map_required','source_changed','search_staging_incomplete','ingestion_operation_failed','ingestion_input_failed','ingestion_claim_failed','ingestion_lease_failed','ingestion_source_failed','ingestion_map_failed','ingestion_validate_failed','ingestion_store_failed','ingestion_verify_failed','ingestion_search_failed','ingestion_checkpoint_failed','ingestion_activate_failed'])
export function ingestionRuntimeConfig(env){
 if(env.PUBLIC_BOOK_INGESTION_ENABLED!=='true'||env.PUBLIC_BOOK_INGESTION_ACCEPTED!=='true')throw Error('ingestion_not_accepted')
 if(!/^[A-Za-z0-9_-]{32,128}$/.test(env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN??''))throw Error('ingestion_credentials_missing')
 const origin=env.PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN??'https://khzanah.com'
 if(!ORIGINS.has(origin))throw Error('ingestion_origin_forbidden')
 return {token:env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN,origin}
}
export function ingestionGateway(config,fetcher=fetch){
 const origin=config.origin??'https://khzanah.com'
 if(!ORIGINS.has(origin))throw Error('ingestion_origin_forbidden')
 return async(input,binary=false)=>{
  const response=await fetcher(`${origin}/api/internal/public-book-index`,{method:'POST',headers:{Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'},body:JSON.stringify(input),redirect:'error',signal:AbortSignal.timeout(45000)})
  if(!response.ok){
   let reason='unknown',size=0;const chunks=[],reader=response.body?.getReader()
   if(reader)try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>2048)break;chunks.push(value)}if(size<=2048){const value=JSON.parse(Buffer.concat(chunks).toString('utf8'));if(gatewayErrors.has(value?.error))reason=value.error}}catch{}finally{await reader.cancel().catch(()=>{})}
   const op=['claim','source','map','complete','fail'].includes(input.op)?input.op:'unknown'
   throw Error(`gateway_${op}_${response.status}_${reason}`)
  }
  const reader=response.body.getReader(),chunks=[];let size=0
  try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>20*1024*1024)throw Error('ingestion_response_bound');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
  const bytes=Buffer.concat(chunks,size)
  return binary?{bytes,sourceSha256:response.headers.get('X-Source-Sha256')}:JSON.parse(bytes.toString('utf8'))
 }
}
export async function drainPublicBookIndex({gateway,maxJobs=5,maxSeconds=240,now=()=>Math.floor(Date.now()/1000),extract=extractPublicBookBounded}){
 if(!Number.isSafeInteger(maxJobs)||maxJobs<1||maxJobs>20||!Number.isSafeInteger(maxSeconds)||maxSeconds<1||maxSeconds>600)throw Error('ingestion_run_bound_invalid')
 const deadline=now()+maxSeconds,summary={claimed:0,ready:0,failed:0}
 while(summary.claimed<maxJobs&&now()<deadline){
  const claimed=await gateway({op:'claim'})
  if(claimed.skipped){summary.claimed++;summary.failed++;continue}
  const job=claimed.job;if(!job)break
  summary.claimed++
  const lease={book_id:job.book_id,generation:job.generation,lease_token:job.lease_token}
  try{
   const source=await gateway({op:'source',lease},true)
   if(createHash('sha256').update(source.bytes).digest('hex')!==source.sourceSha256)throw Error('source_digest_mismatch')
   let map
   if(job.mime==='application/vnd.openxmlformats-officedocument.wordprocessingml.document'){
    const result=await gateway({op:'map',lease},true)
    if(result.sourceSha256!==source.sourceSha256)throw Error('source_changed')
    map=JSON.parse(result.bytes.toString('utf8'))
   }
   const extracted=await extract({mime:job.mime,bytes:new Uint8Array(source.bytes),map})
   let result,stages=0
   do{
    if(now()>=deadline||stages++>=250)throw Error('ingestion_batch_deadline')
    result=await gateway({op:'complete',lease,sourceSha256:source.sourceSha256,extracted})
   }while(result.pending===true)
   if(!result.ok)throw Error('activation_rejected')
   summary.ready++
  }catch(error){
   summary.failed++
   const code=/^[a-z][a-z0-9_]{0,79}$/.test(error?.message??'')?error.message:'extraction_failed'
   await gateway({op:'fail',lease,code}).catch(()=>{})
  }
 }
 return summary
}
export const ingestionExitCode=result=>result.failed>0?2:0
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 Promise.resolve().then(()=>drainPublicBookIndex({gateway:ingestionGateway(ingestionRuntimeConfig(process.env))})).then(result=>{console.log(JSON.stringify(result));process.exitCode=ingestionExitCode(result)}).catch(()=>{console.error('ingestion_run_failed');process.exitCode=1})
}
