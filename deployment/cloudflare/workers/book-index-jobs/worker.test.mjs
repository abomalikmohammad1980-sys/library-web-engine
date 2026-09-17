import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync,readdirSync} from 'node:fs'
import worker,{dispatchEvents,consumeMessage,reconcileEvents} from './worker.js'
import {claimPublicBookIndex,checkpointPublicBookIndex,activatePublicBookIndex} from '../../functions/api/_public-book-index-jobs.js'
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 const directory=new URL('../../migrations/',import.meta.url)
 for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,directory),'utf8'))
 sql.exec("INSERT INTO accounts(subject,email) VALUES('owner','fixture@example.test');INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('book','owner','title','author','secret/source','text/plain',10,'public','approved')")
 const db={prepare(query){let args=[];return{bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)??null},async run(){return sql.prepare(query).run(...args)},async all(){return{results:sql.prepare(query).all(...args)}}}}}
 const sent=[],dead=[]
 const env={BOOK_INDEX_QUEUE_ENABLED:'true',VISITORS_DB:db,BOOK_INDEX_JOBS:{send:async(...args)=>sent.push(args)},BOOK_INDEX_DLQ:{send:async m=>dead.push(m)}}
 const msg=(version=1,action='upsert')=>({body:{bookId:'book',action,contentVersion:version},acks:0,retries:[],ack(){this.acks++},retry(options){this.retries.push(options)}})
 return {sql,db,env,sent,dead,msg}
}
test('disabled gate and external fetch cannot schedule work; enabled dispatch emits exact public schema',async()=>{
 const f=fixture();try{
  assert.equal((await worker.fetch(new Request('https://public.test/wake',{method:'POST'}),f.env)).status,404)
  assert.deepEqual(await dispatchEvents({...f.env,BOOK_INDEX_QUEUE_ENABLED:'false'}),{dispatched:0,failed:0})
  assert.equal((await dispatchEvents(f.env)).dispatched,1)
  assert.deepEqual(f.sent[0][0],{bookId:'book',action:'upsert',contentVersion:1});assert(!JSON.stringify(f.sent).includes('secret'))
 }finally{f.sql.close()}
})
test('missing extractor fails honestly after five processing failures and persists DLQ receipt',async()=>{
 const f=fixture();try{
  for(let n=0;n<5;n++){const m=f.msg();await consumeMessage(m,f.env);assert.equal(m.acks,1)}
  const receipt=f.sql.prepare('SELECT * FROM public_book_queue_receipts').get()
  assert.equal(receipt.state,'failed');assert.equal(receipt.attempts,5);assert.equal(f.dead.length,1)
  assert.equal(f.sql.prepare('SELECT state FROM public_book_index_jobs').get().state,'failed')
  assert.equal(f.sql.prepare('SELECT status FROM books_index_state').get().status,'failed')
  assert.deepEqual(f.sent.map(v=>v[1].delaySeconds),[60,300,1800,7200])
 }finally{f.sql.close()}
})
test('trusted service adapter must activate matching job and FTS receipts; duplicate does not extract again',async()=>{
 const f=fixture();try{
  let calls=0
  f.env.EXTRACTOR={fetch:async(url,init)=>{
   calls++;assert.equal(new URL(url).pathname,'/internal/public-book-extract');assert.equal(JSON.parse(init.body).bookId,'book')
   const now=Math.floor(Date.now()/1000),job=await claimPublicBookIndex(f.db,{now,token:'service_token_0001'})
   await checkpointPublicBookIndex(f.db,job,now,1)
   const sha='a'.repeat(64)
   f.sql.prepare('INSERT INTO public_book_search_receipts VALUES(?,?,?,?)').run('book',job.generation,sha,1)
   await activatePublicBookIndex(f.db,job,now,{manifestSha256:sha,sourceSha256:'b'.repeat(64),artifactKey:`public-book-index/v1/${sha}.json`,parserVersion:'verified-adapter',coverageMode:'text-and-headings',complete:true,checkpoint:1})
   return new Response(null,{status:204})
  }}
  const first=f.msg();await consumeMessage(first,f.env);assert.equal(first.acks,1)
  const second=f.msg();await consumeMessage(second,f.env);assert.equal(second.acks,1);assert.equal(calls,1)
  assert.equal(f.sql.prepare('SELECT state FROM public_book_queue_receipts').get().state,'ready')
  f.sql.exec('DELETE FROM public_book_search_receipts')
  await consumeMessage(f.msg(),f.env)
  assert.equal(f.sql.prepare('SELECT generation FROM public_book_index_jobs').get().generation,2)
  assert.equal(f.sql.prepare('SELECT state FROM public_book_index_jobs').get().state,'queued')
  await consumeMessage(f.msg(2),f.env);assert.equal(calls,2)
  f.sql.exec('DELETE FROM public_book_search_receipts')
  await reconcileEvents(f.env)
  assert.equal(f.sql.prepare('SELECT generation FROM public_book_index_jobs').get().generation,3)
  assert.equal(f.sql.prepare('SELECT status FROM books_index_state').get().status,'queued')
 }finally{f.sql.close()}
})
test('pre-Stage-B ready jobs with valid FTS but no activation timestamp are rebuilt, not timestamped',async()=>{
 for(const missing of ['row','timestamp']){
  const f=fixture();try{
   const sha='a'.repeat(64)
   f.sql.prepare("UPDATE public_book_index_jobs SET state='ready',manifest_sha256=?1,source_sha256=?1,artifact_key='fixture',parser_version='fixture',coverage_mode='text-and-headings' WHERE book_id='book'").run(sha)
   f.sql.prepare("INSERT INTO public_book_search_receipts VALUES('book',1,?,1)").run(sha)
   if(missing==='row')f.sql.exec("DELETE FROM public_book_index_facts WHERE book_id='book'")
   else f.sql.exec("UPDATE public_book_index_facts SET indexed_at=NULL WHERE book_id='book'")
   await reconcileEvents(f.env)
   assert.equal(f.sql.prepare('SELECT generation FROM public_book_index_jobs').get().generation,2)
   assert.equal(f.sql.prepare('SELECT state FROM public_book_index_jobs').get().state,'queued')
   assert.equal(f.sql.prepare('SELECT indexed_at FROM books_index_state').get().indexed_at,null)
   await reconcileEvents(f.env)
   assert.equal(f.sql.prepare('SELECT generation FROM public_book_index_jobs').get().generation,2,'queued recovery must not churn revisions')
  }finally{f.sql.close()}
 }
})

test('HTTP200 alone never becomes ready; pending continuation does not consume failure budget',async()=>{
 const f=fixture();try{
  f.env.EXTRACTOR={fetch:async()=>new Response('not a receipt')};await consumeMessage(f.msg(),f.env)
  assert.equal(f.sql.prepare('SELECT error_code FROM public_book_queue_receipts').get().error_code,'verified_receipt_missing')
  f.env.EXTRACTOR={fetch:async()=>new Response(null,{status:202})};await consumeMessage(f.msg(),f.env)
  assert.equal(f.sql.prepare('SELECT attempts FROM public_book_queue_receipts').get().attempts,1)
 }finally{f.sql.close()}
})
test('superseded messages never call extraction; removal cleans search with persistent duplicate-safe receipt',async()=>{
 const f=fixture();try{
  f.env.EXTRACTOR={fetch:async()=>{throw Error('must not call')}}
  f.sql.exec("INSERT INTO public_book_search_rows(book_id,generation,field,ordinal,text,normalized,anchor_json) VALUES('book',1,'body',0,'old','old','{}');UPDATE user_books SET visibility='private' WHERE id='book'")
  const stale=f.msg();await consumeMessage(stale,f.env);assert.equal(stale.acks,1)
  const removal=f.msg(2,'remove');await consumeMessage(removal,f.env);assert.equal(removal.acks,1)
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM public_book_search_rows').get().n,0)
  assert.equal(f.sql.prepare('SELECT state FROM public_book_queue_receipts').get().state,'removed')
  const repeated=f.msg(2,'remove');await consumeMessage(repeated,f.env);assert.equal(repeated.acks,1)
 }finally{f.sql.close()}
})
test('scheduled reconciliation restores lost delivery without resetting genuine failure',async()=>{
 const f=fixture();try{
  await dispatchEvents(f.env);assert.equal((await reconcileEvents(f.env)).requeued,1)
  await dispatchEvents(f.env)
  f.sql.exec("INSERT INTO public_book_queue_receipts(book_id,content_version,state,attempts,updated_at) VALUES('book',1,'failed',5,0)")
  assert.equal((await reconcileEvents(f.env)).requeued,0)
 }finally{f.sql.close()}
})
test('durable bounded sweep continues on minute ticks and six-hour ticks never restart active progress',async()=>{
 const f=fixture();try{
  const insert=f.sql.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES(?1,'owner','t','a','secret/'||?1,'text/plain',10,'public','approved')")
  for(const id of ['a','b','c','d','e'])insert.run(id)
  f.sql.exec('DELETE FROM public_book_index_outbox')
  assert.equal((await reconcileEvents(f.env,{limit:2,start:false,now:100})).examined,0)
  const first=await reconcileEvents(f.env,{limit:2,now:101});assert.equal(first.complete,false)
  const cursor=f.sql.prepare('SELECT book_id FROM public_book_queue_reconcile_cursor').get().book_id
  insert.run('z-new-during-sweep')
  const second=await reconcileEvents(f.env,{limit:2,start:true,now:102});assert.equal(second.complete,false)
  assert(f.sql.prepare('SELECT book_id FROM public_book_queue_reconcile_cursor').get().book_id>cursor)
  const third=await reconcileEvents(f.env,{limit:2,start:false,now:103});assert.equal(third.complete,true)
  assert.equal(first.examined+second.examined+third.examined,6)
  assert.equal(f.sql.prepare('SELECT COUNT(DISTINCT book_id) n FROM public_book_index_outbox').get().n,7)
  assert.equal((await reconcileEvents(f.env,{limit:2,start:false,now:104})).examined,0)
 }finally{f.sql.close()}
})
test('reconciliation repairs missing revisions/jobs/history, detects withdrawal and requeues stale two-hour work',async()=>{
 const f=fixture();try{
  f.sql.exec("DELETE FROM public_book_index_revisions WHERE book_id='book';DELETE FROM public_book_event_state WHERE book_id='book'")
  await reconcileEvents(f.env,{now:100})
  assert(f.sql.prepare("SELECT 1 FROM public_book_index_jobs WHERE book_id='book'").get())
  assert.equal(f.sql.prepare("SELECT visibility FROM public_book_event_state WHERE book_id='book'").get().visibility,'public')
  f.sql.exec("UPDATE public_book_index_jobs SET state='running',lease_token='abandoned_token1',lease_until=100 WHERE book_id='book';UPDATE public_book_index_facts SET updated_at=1 WHERE book_id='book'")
  await reconcileEvents(f.env,{now:8000})
  assert.equal(f.sql.prepare("SELECT state FROM public_book_index_jobs WHERE book_id='book'").get().state,'queued')
  // Simulate a missed old mutation hook, not an ordinary correctly-triggered edit.
  f.sql.exec("DROP TRIGGER public_book_index_book_update;UPDATE user_books SET visibility='private' WHERE id='book'")
  await reconcileEvents(f.env,{now:9000})
  assert.equal(f.sql.prepare("SELECT visibility FROM public_book_event_state WHERE book_id='book'").get().visibility,'removed')
 }finally{f.sql.close()}
})
test('failed page keeps durable cursor; expired scan lease resumes idempotently without skipped events',async()=>{
 const f=fixture();try{
  f.sql.exec('DELETE FROM public_book_index_outbox')
  const original=f.db.prepare;let failed=false
  f.db.prepare=query=>{if(!failed&&query.startsWith('INSERT INTO public_book_index_outbox')){failed=true;throw Error('simulated outage')}return original(query)}
  await assert.rejects(reconcileEvents(f.env,{now:100}),/simulated outage/)
  assert.equal(f.sql.prepare('SELECT book_id FROM public_book_queue_reconcile_cursor').get().book_id,'')
  assert.equal((await reconcileEvents(f.env,{start:false,now:150})).examined,0)
  assert.equal((await reconcileEvents(f.env,{start:false,now:221})).complete,true)
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM public_book_index_outbox').get().n,1)
 }finally{f.sql.close()}
})
