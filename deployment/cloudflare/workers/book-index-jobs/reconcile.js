// Set-based bounded pages: no per-book network query loop.
export async function reconcileEvents(env,{limit=500,start=true,now=Math.floor(Date.now()/1000),token=crypto.randomUUID()}={}){
 if(env.BOOK_INDEX_QUEUE_ENABLED!=='true')return {examined:0,requeued:0}
 if(!Number.isInteger(limit)||limit<1||limit>1000||!Number.isSafeInteger(now))throw Error('reconcile_limit')
 const db=env.VISITORS_DB
 if(start)await db.prepare(`UPDATE public_book_queue_reconcile_cursor SET active=1,book_id='',upper_book_id=COALESCE((SELECT MAX(id) FROM (SELECT id FROM user_books UNION SELECT book_id AS id FROM public_book_event_state UNION SELECT book_id AS id FROM public_book_index_outbox)),''),cycle_started_at=?1 WHERE id=1 AND active=0`).bind(now).run()
 const cursor=await db.prepare("UPDATE public_book_queue_reconcile_cursor SET lease_token=?1,lease_until=?2 WHERE id=1 AND active=1 AND lease_until<=?3 RETURNING *").bind(token,now+120,now).first()
 if(!cursor)return {examined:0,requeued:0}
 const result=await db.prepare('SELECT id FROM (SELECT id FROM user_books UNION SELECT book_id AS id FROM public_book_event_state UNION SELECT book_id AS id FROM public_book_index_outbox) WHERE id>?1 AND id<=?2 ORDER BY id LIMIT ?3').bind(cursor.book_id,cursor.upper_book_id,limit).all()
 const ids=JSON.stringify(result.results.map(row=>row.id)),inPage="IN (SELECT value FROM json_each(?1))"
 const visible="b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL))"
 // Recover lost history ABOVE retained event versions, never reuse an old
 // message identity. Outbox-only deleted identities remain in the scan domain.
 await db.prepare(`INSERT INTO public_book_event_state(book_id,content_version,index_generation,visibility)
 SELECT p.value,COALESCE((SELECT MAX(content_version) FROM public_book_index_outbox o WHERE o.book_id=p.value),0)+1,COALESCE(j.generation,1),CASE WHEN ${visible} THEN 'public' ELSE 'removed' END
 FROM json_each(?1) p LEFT JOIN user_books b ON b.id=p.value LEFT JOIN public_book_index_jobs j ON j.book_id=p.value
 WHERE NOT EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=p.value)
 AND ((${visible}) OR EXISTS(SELECT 1 FROM public_book_index_outbox o WHERE o.book_id=p.value))`).bind(ids).run()
 await db.prepare(`INSERT INTO public_book_index_revisions(book_id,generation) SELECT id,1 FROM user_books WHERE id ${inPage} ON CONFLICT(book_id) DO NOTHING`).bind(ids).run()
 // A missing job or source/history generation mismatch is repaired through the
 // original revision triggers, never by manufacturing a ready receipt.
 await db.prepare(`UPDATE public_book_index_revisions SET generation=MAX(generation,COALESCE((SELECT generation FROM public_book_index_jobs j WHERE j.book_id=public_book_index_revisions.book_id),0))+1 WHERE book_id ${inPage} AND (
 NOT EXISTS(SELECT 1 FROM public_book_index_jobs j WHERE j.book_id=public_book_index_revisions.book_id AND j.generation=public_book_index_revisions.generation)
 OR EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=public_book_index_revisions.book_id AND s.index_generation<>public_book_index_revisions.generation)
 OR EXISTS(SELECT 1 FROM user_books b WHERE b.id=public_book_index_revisions.book_id AND
 (b.visibility='public' AND b.review_status='approved' AND b.deleted_at IS NULL
 AND NOT EXISTS(SELECT 1 FROM central_book_overrides c WHERE c.book_id IN (b.id,'central-submission:'||b.id,'account-book:'||b.id) AND (c.visibility<>'public' OR c.logically_deleted_at IS NOT NULL)))
 <> COALESCE((SELECT visibility='public' FROM public_book_event_state s WHERE s.book_id=b.id),0))
 )`).bind(ids).run()
 await db.prepare(`UPDATE public_book_event_state SET visibility='removed',content_version=content_version+1,updated_at=?2 WHERE book_id ${inPage} AND visibility='public' AND NOT EXISTS(SELECT 1 FROM user_books b WHERE b.id=public_book_event_state.book_id)`).bind(ids,now).run()
 await db.prepare(`UPDATE public_book_index_jobs SET state='queued',lease_token=NULL,lease_until=0,retry_at=0,error_code='stale_work_requeued' WHERE book_id ${inPage} AND state='running' AND lease_until<=?2 AND EXISTS(SELECT 1 FROM public_book_index_facts f WHERE f.book_id=public_book_index_jobs.book_id AND f.updated_at<=?2-7200)`).bind(ids,now).run()
 // Rebuild when FTS proof or genuine activation facts are missing (including
 // pre-Stage-B ready jobs). Never invent indexed_at or let a terminal delivery
 // receipt permanently suppress recovery into the ready-only sitemap.
 await db.prepare(`UPDATE public_book_index_revisions SET generation=generation+1 WHERE book_id ${inPage}
 AND EXISTS(SELECT 1 FROM public_book_index_jobs j JOIN public_book_index_eligible e ON e.id=j.book_id AND e.generation=j.generation WHERE j.book_id=public_book_index_revisions.book_id AND j.state='ready'
 AND (NOT EXISTS(SELECT 1 FROM public_book_search_receipts r WHERE r.book_id=j.book_id AND r.generation=j.generation AND r.manifest_sha256=j.manifest_sha256)
 OR NOT EXISTS(SELECT 1 FROM public_book_index_facts f WHERE f.book_id=j.book_id AND f.generation=j.generation AND f.indexed_at IS NOT NULL AND f.indexed_at>0)))`).bind(ids).run()
 await db.prepare(`INSERT INTO public_book_index_outbox(book_id,content_version,action) SELECT book_id,content_version,CASE visibility WHEN 'public' THEN 'upsert' ELSE 'remove' END FROM public_book_event_state WHERE book_id ${inPage} ON CONFLICT(book_id,content_version) DO NOTHING`).bind(ids).run()
 const changed=await db.prepare(`UPDATE public_book_index_outbox SET state='queued',retry_at=0,attempts=0,lease_token=NULL,lease_until=0 WHERE book_id ${inPage} AND state='delivered'
 AND EXISTS(SELECT 1 FROM public_book_event_state s WHERE s.book_id=public_book_index_outbox.book_id AND s.content_version=public_book_index_outbox.content_version)
 AND NOT EXISTS(SELECT 1 FROM public_book_queue_receipts r WHERE r.book_id=public_book_index_outbox.book_id AND r.content_version=public_book_index_outbox.content_version AND (r.state IN ('ready','removed','failed') OR r.updated_at>?2-7200)) RETURNING event_id`).bind(ids,now).all()
 const done=result.results.length<limit||result.results.at(-1)?.id===cursor.upper_book_id
 const advanced=await db.prepare('UPDATE public_book_queue_reconcile_cursor SET book_id=?1,active=?2,completed_at=CASE WHEN ?2=0 THEN ?3 ELSE completed_at END,lease_token=NULL,lease_until=0 WHERE id=1 AND lease_token=?4 RETURNING id').bind(done?'':result.results.at(-1).id,done?0:1,now,token).first()
 return {examined:result.results.length,requeued:changed.results.length,complete:done&&Boolean(advanced)}
}
