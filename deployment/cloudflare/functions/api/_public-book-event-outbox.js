// At-least-once dispatch ledger, not a parser, IndexNow client or ready receipt.
// Workers Queue.send may succeed before acknowledgement fails. The consumer
// must fence by (bookId,contentVersion); duplicate messages are intentional.
const current=`EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=public_book_index_outbox.book_id AND s.content_version=public_book_index_outbox.content_version AND action=CASE s.visibility WHEN 'public' THEN 'upsert' ELSE 'remove' END)`
export const PUBLIC_BOOK_EVENT_RETRY_SECONDS=Object.freeze([60,300,1800,7200,43200])
function valid(now,token){if(!Number.isSafeInteger(now)||now<0||!/^[-_A-Za-z0-9]{16,128}$/.test(token??''))throw Error('invalid_event_lease')}
export async function claimPublicBookEvent(db,{now,token,leaseSeconds=60}){
 valid(now,token);if(!Number.isSafeInteger(leaseSeconds)||leaseSeconds<10||leaseSeconds>300)throw Error('invalid_event_lease')
 await db.prepare(`UPDATE public_book_index_outbox SET state='superseded',lease_token=NULL,lease_until=0 WHERE state IN ('queued','leased') AND NOT ${current}`).run()
 await db.prepare("UPDATE public_book_index_outbox SET state='failed',error_code='dispatch_lease_exhausted',lease_token=NULL,lease_until=0 WHERE state='leased' AND lease_until<=?1 AND attempts>=5").bind(now).run()
 return db.prepare(`UPDATE public_book_index_outbox SET state='leased',attempts=attempts+1,lease_token=?1,lease_until=?2 WHERE event_id=(SELECT event_id FROM public_book_index_outbox WHERE attempts<5 AND ${current} AND ((state='queued' AND retry_at<=?3) OR (state='leased' AND lease_until<=?3)) ORDER BY retry_at,event_id LIMIT 1) RETURNING *`).bind(token,now+leaseSeconds,now).first()
}
export async function finishPublicBookEvent(db,event,now,{errorCode}={}){
 valid(now,event?.lease_token)
 if(!Number.isSafeInteger(event.event_id)||event.event_id<1)throw Error('invalid_event_id')
 if(errorCode!==undefined&&!/^[a-z][a-z0-9_]{0,79}$/.test(errorCode))throw Error('invalid_event_error')
 const result=await db.prepare(`UPDATE public_book_index_outbox SET
 state=CASE WHEN ?1 IS NULL THEN 'delivered' WHEN attempts>=5 THEN 'failed' ELSE 'queued' END,
 delivered_at=CASE WHEN ?1 IS NULL THEN ?2 ELSE NULL END,error_code=?1,
 retry_at=CASE attempts WHEN 1 THEN ?2+60 WHEN 2 THEN ?2+300 WHEN 3 THEN ?2+1800 WHEN 4 THEN ?2+7200 ELSE ?2+43200 END,
 lease_token=NULL,lease_until=0 WHERE event_id=?3 AND lease_token=?4 AND state='leased' AND lease_until>?2 AND ${current} RETURNING event_id`)
 .bind(errorCode??null,now,event.event_id,event.lease_token).first()
 return result?.event_id===event.event_id
}
export function publicBookEventMessage(event){
 if(!event||!['upsert','remove'].includes(event.action)||typeof event.book_id!=='string'||!Number.isSafeInteger(event.content_version)||event.content_version<1)throw Error('invalid_book_event')
 return {bookId:event.book_id,action:event.action,contentVersion:event.content_version}
}
// Call only after the trusted executor has verified the actual extracted output.
// Empty PDF outlines must pass 'none', not 'pdf_bookmarks'. No OCR is inferred.
export async function attestPublicBookExtraction(db,job,now,{tocSource,ocr=false}){
 valid(now,job?.lease_token)
 if(!['native','pdf_bookmarks','none'].includes(tocSource)||typeof ocr!=='boolean')throw Error('invalid_extraction_facts')
 const row=await db.prepare(`UPDATE public_book_index_facts SET toc_source=?1,ocr=?2,updated_at=?3 WHERE book_id=?4 AND generation=?5 AND EXISTS(SELECT 1 FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=?4 AND j.generation=?5 AND j.state='running' AND j.lease_token=?6 AND j.lease_until>?3) RETURNING book_id`)
 .bind(tocSource,ocr?1:0,now,job.book_id,job.generation,job.lease_token).first()
 return row?.book_id===job.book_id
}
/** Call behind administrator authorization. A stale UI version cannot retry a newer job. */
export async function retryFailedPublicBookIndex(db,{bookId,contentVersion}){
 if(typeof bookId!=='string'||!bookId||bookId.length>200||!Number.isSafeInteger(contentVersion)||contentVersion<1)throw Error('invalid_index_retry')
 const row=await db.prepare(`UPDATE public_book_index_revisions SET generation=generation+1 WHERE book_id=?1
 AND EXISTS(SELECT 1 FROM books_index_state s JOIN public_book_index_jobs j ON j.book_id=s.book_id JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation
 WHERE s.book_id=?1 AND s.content_version=?2 AND s.status='failed' AND j.state='failed') RETURNING book_id`).bind(bookId,contentVersion).first()
 return row?.book_id===bookId
}
