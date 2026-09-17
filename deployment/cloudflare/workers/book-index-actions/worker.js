const REPOSITORY='abomalikmohammad1980-sys/library-web-engine'
const WORKFLOW='public-book-ingestion-targeted.yml'
const API='https://api.github.com/repos/'+REPOSITORY
const VERSION='2026-03-10'
const json=(value,status)=>Response.json(value,{status,headers:{'cache-control':'no-store'}})
async function boundedJson(response,maxBytes){
 const reader=response.body?.getReader();if(!reader)throw Error('missing_body')
 const chunks=[];let size=0
 try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>maxBytes)throw Error('body_bound');chunks.push(value)}}finally{await reader.cancel().catch(()=>{});reader.releaseLock()}
 const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.length}
 return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))
}
const primary=db=>db.withSession?.('first-primary')??db
async function eligible(db,event){
 return primary(db).prepare(`SELECT j.state,j.generation,j.manifest_sha256,
 EXISTS(SELECT 1 FROM public_book_search_receipts r WHERE r.book_id=j.book_id AND r.generation=j.generation AND r.manifest_sha256=j.manifest_sha256) AS search_ready
 FROM public_book_index_jobs j JOIN public_book_event_state s ON s.book_id=j.book_id AND s.index_generation=j.generation
 JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation
 WHERE s.book_id=?1 AND s.content_version=?2 AND s.visibility='public'`).bind(event.bookId,event.contentVersion).first()
}
export function createActionsExtractor({fetcher=fetch,now=()=>Math.floor(Date.now()/1000),nonce=()=>crypto.randomUUID()}={}){
 return async(request,env)=>{
  const url=new URL(request.url)
  if(request.method!=='POST'||url.hostname!=='extractor.internal'||url.pathname!=='/internal/public-book-extract')return json({error:'not_found'},404)
  if(env.BOOK_INDEX_ACTIONS_ENABLED!=='true'||!env.VISITORS_DB||!/^github_pat_[A-Za-z0-9_]{20,}$/.test(env.GITHUB_ACTIONS_TOKEN??''))return json({error:'extractor_unavailable'},503)
  let event
  try{event=await boundedJson(request,2048)}catch{return json({error:'invalid_event'},400)}
  if(!event||Object.keys(event).sort().join(',')!=='action,bookId,contentVersion'||event.action!=='upsert'||typeof event.bookId!=='string'||!/^[-_A-Za-z0-9]{1,200}$/.test(event.bookId)||!Number.isSafeInteger(event.contentVersion)||event.contentVersion<1)return json({error:'invalid_event'},400)
  const db=env.VISITORS_DB,time=now(),lease=nonce()
  const headers={'accept':'application/vnd.github+json','authorization':'Bearer '+env.GITHUB_ACTIONS_TOKEN,'x-github-api-version':VERSION,'user-agent':'khizana-public-book-index','content-type':'application/json'}
  try{
   const source=await eligible(db,event);if(!source)return json({error:'stale_event'},409)
   if(source.state==='ready'&&source.search_ready)return new Response(null,{status:204})
   const prior=await db.prepare('SELECT * FROM public_book_actions_dispatches WHERE book_id=?1 AND content_version=?2').bind(event.bookId,event.contentVersion).first()
   if(prior?.state==='dispatching'&&prior.lease_until>time)return json({pending:true},202)
   if(prior?.state==='dispatched'){
    if(time-prior.updated_at>=7200){
     await db.prepare("UPDATE public_book_actions_dispatches SET state='failed',error_code='run_deadline_exceeded',next_attempt_at=?3,updated_at=?3 WHERE book_id=?1 AND content_version=?2 AND state='dispatched'").bind(event.bookId,event.contentVersion,time).run()
     return json({error:'extraction_failed'},502)
    }
    // Old API204 has no run ID: do not start another job every Queue continuation.
    if(!prior.run_id){if(time-prior.updated_at<1800)return json({pending:true},202)}
    else{
     let run
     try{
      const response=await fetcher(API+'/actions/runs/'+prior.run_id,{headers,redirect:'error',signal:AbortSignal.timeout(10000)})
      if(response.status!==200){await response.body?.cancel();return json({pending:true},202)}
      run=await boundedJson(response,65536)
     }catch{return json({pending:true},202)}
     if(run.id!==prior.run_id||run.repository?.full_name!==REPOSITORY)return json({error:'dispatch_identity_invalid'},502)
     if(run.status!=='completed')return json({pending:true},202)
     const current=await eligible(db,event)
     if(!current)return json({error:'stale_event'},409)
     if(current.state==='ready'&&current.search_ready)return new Response(null,{status:204})
    }
    await db.prepare("UPDATE public_book_actions_dispatches SET state='failed',error_code='run_without_ready_receipt',next_attempt_at=?3,updated_at=?3 WHERE book_id=?1 AND content_version=?2 AND state='dispatched'").bind(event.bookId,event.contentVersion,time).run()
    return json({error:'extraction_failed'},502)
   }
   if(prior?.attempts>=5)return json({error:'dispatch_attempts_exhausted'},502)
   if(prior?.next_attempt_at>time)return json({pending:true},202)
   await db.prepare("INSERT INTO public_book_actions_dispatches(book_id,content_version,state,updated_at) VALUES(?1,?2,'failed',?3) ON CONFLICT DO NOTHING").bind(event.bookId,event.contentVersion,time).run()
   const claimed=await db.prepare(`UPDATE public_book_actions_dispatches SET state='dispatching',attempts=attempts+1,lease_token=?3,lease_until=?4,run_id=NULL,error_code=NULL,updated_at=?5
 WHERE book_id=?1 AND content_version=?2 AND attempts<5 AND (state='failed' OR (state='dispatching' AND lease_until<=?5))
 AND EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=?1 AND s.content_version=?2 AND s.visibility='public') RETURNING attempts`).bind(event.bookId,event.contentVersion,lease,time+30,time).first()
   if(!claimed)return json({pending:true},202)
   if(!await eligible(db,event))return json({error:'stale_event'},409)
   let response,runId=null,accepted=false
   try{
    response=await fetcher(API+'/actions/workflows/'+WORKFLOW+'/dispatches',{method:'POST',headers,redirect:'error',signal:AbortSignal.timeout(10000),body:JSON.stringify({ref:'main',inputs:{book_id:event.bookId,content_version:String(event.contentVersion)}})})
    if(response.status===200){const result=await boundedJson(response,16384);if(Number.isSafeInteger(result.workflow_run_id)&&result.workflow_run_id>0){runId=result.workflow_run_id;accepted=true}}
    else if(response.status===204){await response.body?.cancel();accepted=true}
    else await response.body?.cancel()
   }catch{/* Ambiguous network delivery may create a duplicate; target lease fences it. */}
   const updated=await db.prepare("UPDATE public_book_actions_dispatches SET state=?3,run_id=?4,error_code=?5,lease_token=NULL,lease_until=0,next_attempt_at=?6,updated_at=?7 WHERE book_id=?1 AND content_version=?2 AND lease_token=?8 RETURNING book_id").bind(event.bookId,event.contentVersion,accepted?'dispatched':'failed',runId,accepted?null:'dispatch_unavailable',accepted?0:time+60,time,lease).first()
   if(!updated)return json({error:'dispatch_lease_changed'},503)
   return accepted?json({pending:true},202):json({error:'dispatch_unavailable'},503)
  }catch{return json({error:'extractor_unavailable'},503)}
 }
}
export default {fetch:createActionsExtractor()}
