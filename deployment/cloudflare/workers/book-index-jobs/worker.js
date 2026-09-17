import {claimPublicBookEvent,finishPublicBookEvent,publicBookEventMessage,PUBLIC_BOOK_EVENT_RETRY_SECONDS} from '../../functions/api/_public-book-event-outbox.js'
import {notifyPublicBookIndexNow} from '../../functions/api/_public-book-indexnow.js'
import {reconcileEvents} from './reconcile.js'
const clock=()=>Math.floor(Date.now()/1000)
const token=()=>crypto.randomUUID().replaceAll('-','')
const current="EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=?1 AND s.content_version=?2)"
function body(value){
 if(!value||Object.keys(value).sort().join(',')!=='action,bookId,contentVersion'||typeof value.bookId!=='string'||!/^[A-Za-z0-9_-]{1,200}$/.test(value.bookId)||!['upsert','remove'].includes(value.action)||!Number.isSafeInteger(value.contentVersion)||value.contentVersion<1)throw Error('invalid_message')
 return value
}
function primary(db){return typeof db.withSession==='function'?db.withSession('first-primary'):db}
async function state(db,m){return primary(db).prepare('SELECT * FROM public_book_event_state WHERE book_id=?1 AND content_version=?2').bind(m.bookId,m.contentVersion).first()}
async function acknowledgeTerminal(message,env,m){
 const notification=await notifyPublicBookIndexNow(env,m)
 if(notification.status==='pending')await env.BOOK_INDEX_JOBS.send(m,{delaySeconds:Math.min(43200,Math.max(1,(notification.retryAt??clock()+60)-clock()))})
 message.ack()
}
export async function dispatchEvents(env,{limit=20,now=clock()}={}){
 if(env.BOOK_INDEX_QUEUE_ENABLED!=='true')return {dispatched:0,failed:0}
 if(!env.BOOK_INDEX_JOBS?.send)throw Error('queue_unavailable')
 if(!Number.isInteger(limit)||limit<1||limit>50)throw Error('dispatch_limit')
 let dispatched=0,failed=0
 for(let i=0;i<limit;i++){
  const event=await claimPublicBookEvent(env.VISITORS_DB,{now,token:token()});if(!event)break
  try{await env.BOOK_INDEX_JOBS.send(publicBookEventMessage(event));await finishPublicBookEvent(env.VISITORS_DB,event,clock());dispatched++}
  catch{await finishPublicBookEvent(env.VISITORS_DB,event,clock(),{errorCode:'queue_unavailable'});failed++}
 }
 return {dispatched,failed}
}
async function ready(db,m){
 return primary(db).prepare(`SELECT j.book_id FROM public_book_index_jobs j JOIN public_book_event_state s ON s.book_id=j.book_id AND s.index_generation=j.generation
 JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation
 JOIN public_book_search_receipts r ON r.book_id=j.book_id AND r.generation=j.generation AND r.manifest_sha256=j.manifest_sha256
 WHERE j.book_id=?1 AND s.content_version=?2 AND s.visibility='public' AND j.state='ready'`).bind(m.bookId,m.contentVersion).first()
}
async function remove(db,m){
 // Each delete is independently fenced; republishing during cleanup stops it.
 const fence="EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=?1 AND s.content_version=?2 AND s.visibility='removed')"
 for(const table of ['public_book_search_rows','public_book_search_staging','public_book_search_receipts']){
  const bounded=table==='public_book_search_rows'?' AND row_id IN (SELECT row_id FROM public_book_search_rows WHERE book_id=?1 LIMIT 1000)':''
  await db.prepare(`DELETE FROM ${table} WHERE book_id=?1 AND ${fence}${bounded}`).bind(m.bookId,m.contentVersion).run()
 }
 return !(await db.prepare('SELECT 1 AS present FROM public_book_search_rows WHERE book_id=?1 LIMIT 1').bind(m.bookId).first())
}
async function receipt(db,m,lease,next,now,error=null){
 return db.prepare(`UPDATE public_book_queue_receipts SET state=?3,error_code=?4,lease_token=NULL,lease_until=0,updated_at=?5
 WHERE book_id=?1 AND content_version=?2 AND state='running' AND lease_token=?6 AND lease_until>?5 AND ${current} RETURNING book_id`)
 .bind(m.bookId,m.contentVersion,next,error,now,lease).first()
}
export async function consumeMessage(message,env){
 if(env.BOOK_INDEX_QUEUE_ENABLED!=='true'){message.retry({delaySeconds:300});return}
 let m
 try{m=body(message.body)}catch{message.ack();return}
 const db=env.VISITORS_DB,s=await state(db,m)
 if(!s||m.action!==(s.visibility==='public'?'upsert':'remove')){message.ack();return}
 const now=clock(),lease=token()
 await db.prepare("INSERT INTO public_book_queue_receipts(book_id,content_version,state,updated_at) VALUES(?1,?2,'queued',?3) ON CONFLICT DO NOTHING").bind(m.bookId,m.contentVersion,now).run()
 const previous=await db.prepare('SELECT * FROM public_book_queue_receipts WHERE book_id=?1 AND content_version=?2').bind(m.bookId,m.contentVersion).first()
 if(previous.state==='removed'){await acknowledgeTerminal(message,env,m);return}
 if(previous.state==='ready'){
  if(await ready(db,m)){await acknowledgeTerminal(message,env,m);return}
  // A delivery receipt alone cannot certify a lost/stale search generation.
  await db.prepare("UPDATE public_book_index_revisions SET generation=generation+1 WHERE book_id=?1 AND EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=?1 AND s.content_version=?2 AND s.visibility='public') RETURNING book_id").bind(m.bookId,m.contentVersion).first()
  message.ack();return
 }
 if(previous.state==='failed'){await env.BOOK_INDEX_DLQ.send(m);message.ack();return}
 const claimed=await db.prepare(`UPDATE public_book_queue_receipts SET state='running',lease_token=?3,lease_until=?4,updated_at=?5
 WHERE book_id=?1 AND content_version=?2 AND attempts<5 AND (state='queued' OR (state='running' AND lease_until<=?5)) AND ${current} RETURNING book_id`).bind(m.bookId,m.contentVersion,lease,now+60,now).first()
 if(!claimed){message.retry({delaySeconds:60});return}
 let failure='extractor_unavailable',pending=false
 try{
  if(m.action==='remove'){pending=!(await remove(db,m))}
  else if(!await ready(db,m)){
   if(!env.EXTRACTOR?.fetch)throw Error('extractor_unavailable')
   const response=await env.EXTRACTOR.fetch('https://extractor.internal/internal/public-book-extract',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(m),signal:AbortSignal.timeout(25000)})
   if(response.body)await response.body.cancel()
   if(response.status===202)pending=true
   else if(!response.ok){failure='extractor_failed';throw Error(failure)}
   else if(!await ready(db,m)){failure='verified_receipt_missing';throw Error(failure)}
  }
  const latest=await state(db,m)
  if(!latest){message.ack();return}
  if(pending){
   await receipt(db,m,lease,'queued',clock())
   // Continuations are not parser failures. Persisted receipt makes send/ack duplicates harmless.
   await env.BOOK_INDEX_JOBS.send(m,{delaySeconds:60});message.ack();return
  }
  if(await receipt(db,m,lease,m.action==='remove'?'removed':'ready',clock()))await acknowledgeTerminal(message,env,m)
  else message.retry({delaySeconds:60})
 }catch{
  const failed=await db.prepare(`UPDATE public_book_queue_receipts SET attempts=attempts+1,state=CASE WHEN attempts+1>=5 THEN 'failed' ELSE 'queued' END,error_code=?3,lease_token=NULL,lease_until=0,updated_at=?4 WHERE book_id=?1 AND content_version=?2 AND state='running' AND lease_token=?5 AND ${current} RETURNING attempts,state`).bind(m.bookId,m.contentVersion,failure,clock(),lease).first()
  if(!failed){message.retry({delaySeconds:60});return}
  if(failed.state==='failed'){
   await db.prepare(`UPDATE public_book_index_jobs SET state='failed',attempts=MAX(attempts,5),error_code=?3,lease_token=NULL,lease_until=0
   WHERE book_id=?1 AND generation=(SELECT index_generation FROM public_book_event_state WHERE book_id=?1 AND content_version=?2)
   AND (state='queued' OR (state='running' AND lease_until<=?4))`).bind(m.bookId,m.contentVersion,failure,clock()).run()
   // No source/lease data in DLQ. D1 retains failure beyond Queue retention.
   await env.BOOK_INDEX_DLQ.send(m)
  }else await env.BOOK_INDEX_JOBS.send(m,{delaySeconds:PUBLIC_BOOK_EVENT_RETRY_SECONDS[failed.attempts-1]})
  message.ack()
 }
}
export {reconcileEvents} from './reconcile.js'
export default {
 // Service-binding wake only. No public request can mutate the scheduler.
 async fetch(request,env){
  const url=new URL(request.url)
  if(request.method!=='POST'||url.hostname!=='book-index.internal'||url.pathname!=='/wake')return new Response('not found',{status:404})
  return Response.json(await dispatchEvents(env))
 },
 async queue(batch,env){for(const message of batch.messages)await consumeMessage(message,env)},
 async scheduled(event,env){const report=await reconcileEvents(env,{start:event.cron==='0 */6 * * *'});const dispatch=await dispatchEvents(env);console.log(JSON.stringify({event:'book_index_reconcile',...report,...dispatch}))},
}
