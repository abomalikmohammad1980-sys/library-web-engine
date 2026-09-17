const HOST='khzanah.com',ENDPOINT='https://api.indexnow.org/indexnow'
const keyValid=value=>typeof value==='string'&&/^[a-f0-9]{32,128}$/.test(value)
const enabled=env=>env.INDEXNOW_ENABLED==='true'&&env.INDEXNOW_SUBMISSION_APPROVED==='true'&&keyValid(env.INDEXNOW_KEY)
export function indexNowKeyResponse(request,env){
 const url=new URL(request.url)
 if(!enabled(env)||url.hostname!==HOST||url.pathname!==`/${env.INDEXNOW_KEY}.txt`||url.search)return null
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405})
 return new Response(request.method==='HEAD'?null:env.INDEXNOW_KEY,{headers:{'content-type':'text/plain; charset=utf-8','cache-control':'public, max-age=300','x-content-type-options':'nosniff','x-robots-tag':'noindex'}})
}
const eligible=`EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=?1 AND s.content_version=?2
 AND ((?3='remove' AND s.visibility='removed') OR (?3='upsert' AND s.visibility='public'
 AND EXISTS(SELECT 1 FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=s.book_id AND j.generation=s.index_generation AND j.state='ready'))))`
/** At-least-once HTTP delivery. A crash after remote acceptance may resend the
 * same URL; no protocol receipt can make that network boundary exactly-once. */
export async function notifyPublicBookIndexNow(env,event,{fetcher=fetch,now=()=>Math.floor(Date.now()/1000),token=()=>crypto.randomUUID()}={}){
 if(!enabled(env))return{status:'disabled'}
 const {bookId,contentVersion,action}=event??{}
 if(typeof bookId!=='string'||!/^[-_A-Za-z0-9]{1,200}$/.test(bookId)||!Number.isSafeInteger(contentVersion)||contentVersion<1||!['upsert','remove'].includes(action))throw Error('indexnow_invalid_event')
 const db=env.VISITORS_DB?.withSession?.('first-primary')??env.VISITORS_DB
 if(!db)throw Error('indexnow_database')
 const time=now(),lease=token();if(!Number.isSafeInteger(time)||time<0||!/^[-_A-Za-z0-9]{16,128}$/.test(lease))throw Error('indexnow_clock')
 if(!await db.prepare(`SELECT 1 AS eligible WHERE ${eligible}`).bind(bookId,contentVersion,action).first())return{status:'ignored'}
 await db.prepare("UPDATE public_book_indexnow SET state='failed',lease_token=NULL,lease_until=0,updated_at=?3 WHERE book_id=?1 AND content_version=?2 AND state='sending' AND attempts>=5 AND lease_until<=?3").bind(bookId,contentVersion,time).run()
 await db.prepare(`INSERT INTO public_book_indexnow(book_id,content_version,action,state,updated_at) SELECT ?1,?2,?3,'queued',?4 WHERE ${eligible} ON CONFLICT(book_id,content_version) DO NOTHING`).bind(bookId,contentVersion,action,time).run()
 const row=await db.prepare(`UPDATE public_book_indexnow SET state='sending',attempts=attempts+1,lease_token=?4,lease_until=?5+30,updated_at=?5 WHERE book_id=?1 AND content_version=?2 AND action=?3 AND attempts<5 AND ((state='queued' AND retry_at<=?5) OR (state='sending' AND lease_until<=?5)) AND ${eligible} RETURNING *`).bind(bookId,contentVersion,action,lease,time).first()
 if(!row){const previous=await db.prepare('SELECT state,retry_at,lease_until FROM public_book_indexnow WHERE book_id=?1 AND content_version=?2').bind(bookId,contentVersion).first();return{status:previous?.state==='accepted'?'accepted':previous?.state==='failed'?'failed':previous&&previous.state!=='superseded'?'pending':'ignored',...(previous&&['queued','sending'].includes(previous.state)?{retryAt:Math.max(previous.retry_at,previous.lease_until,time+1)}:{})}}
 const fresh=await db.prepare(`SELECT 1 AS eligible WHERE ${eligible}`).bind(bookId,contentVersion,action).first()
 if(!fresh){await db.prepare("UPDATE public_book_indexnow SET state='superseded',lease_token=NULL,lease_until=0 WHERE book_id=?1 AND content_version=?2 AND lease_token=?3").bind(bookId,contentVersion,lease).run();return{status:'ignored'}}
 let status=0
 try{const response=await fetcher(ENDPOINT,{method:'POST',redirect:'error',signal:AbortSignal.timeout(10000),headers:{'content-type':'application/json; charset=utf-8'},body:JSON.stringify({host:HOST,key:env.INDEXNOW_KEY,keyLocation:`https://${HOST}/${env.INDEXNOW_KEY}.txt`,urlList:[`https://${HOST}/books/public/${encodeURIComponent(bookId)}`]})});status=response.status;await response.body?.cancel().catch(()=>{})}catch{/* No raw network errors, keys or bodies are logged. */}
 const accepted=status===200||status===202,retryable=status===0||status===429||status>=500&&status<=599
 const final=accepted?'accepted':retryable&&row.attempts<5?'queued':'failed',retryAt=now()+[60,300,1800,7200,43200][Math.min(row.attempts-1,4)]
 await db.prepare('UPDATE public_book_indexnow SET state=?1,retry_at=?2,http_status=?3,lease_token=NULL,lease_until=0,updated_at=?4 WHERE book_id=?5 AND content_version=?6 AND lease_token=?7').bind(final,final==='queued'?retryAt:0,status||null,now(),bookId,contentVersion,lease).run()
 return{status:final==='queued'?'pending':final,...(final==='queued'?{retryAt}:{})}
}
