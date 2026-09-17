import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync,readdirSync} from 'node:fs'
import {claimPublicBookEvent as claim,finishPublicBookEvent as finish,publicBookEventMessage as message,attestPublicBookExtraction as attest,retryFailedPublicBookIndex as retry} from '../deployment/cloudflare/functions/api/_public-book-event-outbox.js'
import {claimPublicBookIndex,checkpointPublicBookIndex,activatePublicBookIndex,failPublicBookIndex} from '../deployment/cloudflare/functions/api/_public-book-index-jobs.js'
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 const directory=new URL('../deployment/cloudflare/migrations/',import.meta.url)
 for(const name of readdirSync(directory).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,directory),'utf8'))
 sql.exec("INSERT INTO accounts(subject,email) VALUES('owner','fixture@example.test')")
 const book=(id='book',pub=true)=>sql.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES(?,'owner',?,'author',?,'text/plain',10,?,?)").run(id,id,'private/'+id,pub?'public':'private',pub?'approved':'pending')
 const db={prepare(query){let args=[];return{bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)??null},async run(){return sql.prepare(query).run(...args)}}}}
 return {sql,db,book}
}
const lease={token:'dispatch_token_0001',now:100}
test('all migrations apply; private-only books create no public event; publication is transactional',async()=>{
 const f=fixture();try{
  f.book('private',false);assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM public_book_index_outbox').get().n,0)
  f.sql.exec('BEGIN');f.book('rollback');f.sql.exec('ROLLBACK');assert.equal(await claim(f.db,lease),null)
  f.book();const event=await claim(f.db,lease);assert.deepEqual(message(event),{bookId:'book',action:'upsert',contentVersion:1})
  assert(!JSON.stringify(message(event)).includes('private/'))
  assert.equal(await claim(f.db,{...lease,token:'dispatch_token_0002'}),null)
 }finally{f.sql.close()}
})
test('metadata changes supersede old leases; soft and hard deletion persist removal; recreation does not reuse version',async()=>{
 const f=fixture();try{
  f.book();const first=await claim(f.db,lease)
  f.sql.exec("UPDATE user_books SET title='new' WHERE id='book'")
  assert.equal(await finish(f.db,first,101),false)
  const edited=await claim(f.db,{...lease,now:102});assert.equal(edited.content_version,2)
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='book'")
  const removed=await claim(f.db,{...lease,now:103});assert.equal(removed.action,'remove');assert.equal(removed.content_version,3)
  f.sql.exec("DELETE FROM user_books WHERE id='book'")
  const hard=await claim(f.db,{...lease,now:104});assert.equal(hard.action,'remove');assert.equal(hard.content_version,4)
  f.book();const recreated=await claim(f.db,{...lease,now:105});assert.equal(recreated.content_version,5);assert.equal(recreated.action,'upsert')
 }finally{f.sql.close()}
})
test('dispatch retries are bounded and unsafe error text rejected; duplicate acknowledgement fenced',async()=>{
 const f=fixture();try{
  f.book();let now=100
  for(let attempt=1;attempt<=5;attempt++){
   const event=await claim(f.db,{...lease,now});assert.equal(event.attempts,attempt)
   await assert.rejects(finish(f.db,event,now+1,{errorCode:'SQL secret token!'}),/invalid_event_error/)
   assert.equal(await finish(f.db,event,now+1,{errorCode:'queue_unavailable'}),true)
   assert.equal(await finish(f.db,event,now+1),false)
   assert.equal(await claim(f.db,{...lease,now:now+2}),null)
   now+=1+[60,300,1800,7200,43200][attempt-1]
  }
  assert.equal(await claim(f.db,{...lease,now}),null)
  assert.equal(f.sql.prepare('SELECT state FROM public_book_index_outbox').get().state,'failed')
 }finally{f.sql.close()}
})
test('expired delivery lease permits takeover but fences former dispatcher',async()=>{
 const f=fixture();try{f.book();const a=await claim(f.db,lease),b=await claim(f.db,{now:160,token:'dispatch_token_0002'});assert.equal(await finish(f.db,a,161),false);assert.equal(await finish(f.db,b,161),true);assert.equal(await claim(f.db,{...lease,now:200}),null)}finally{f.sql.close()}
})
test('materialized admin states follow real lifecycle, verified TOC, activation time and source revision',async()=>{
 const f=fixture();try{
  f.book('private',false);f.book();const state=()=>f.sql.prepare("SELECT * FROM books_index_state WHERE book_id='book'").get()
  assert.equal(f.sql.prepare("SELECT type FROM sqlite_master WHERE name='books_index_state'").get().type,'table')
  assert.equal(f.sql.prepare("SELECT visibility FROM books_index_state WHERE book_id='private'").get().visibility,'private')
  assert.equal(state().status,'queued');assert.equal(state().indexed_at,null)
  const job=await claimPublicBookIndex(f.db,lease);assert.equal(state().status,'extracting')
  assert.equal(await attest(f.db,job,101,{tocSource:'native'}),true)
  await checkpointPublicBookIndex(f.db,job,102,1);assert.equal(state().status,'indexing')
  assert.equal(await activatePublicBookIndex(f.db,job,103,{manifestSha256:'a'.repeat(64),sourceSha256:'b'.repeat(64),artifactKey:`public-book-index/v1/${'a'.repeat(64)}.json`,parserVersion:'v1',coverageMode:'text-and-headings',complete:true,checkpoint:1}),true)
  assert.equal(state().status,'ready');assert.equal(state().toc_source,'native');assert(state().indexed_at>0)
  f.sql.exec("UPDATE user_books SET title='revision' WHERE id='book'")
  assert.equal(state().status,'queued');assert.equal(state().toc_source,'none');assert.equal(state().indexed_at,null)
  assert.equal(await attest(f.db,job,104,{tocSource:'native'}),false)
  f.sql.exec("DELETE FROM user_books WHERE id='book'");assert.equal(state().status,'removed')
 }finally{f.sql.close()}
})
test('administrator retry is failed-only, version-fenced, transactional and no private resurrection',async()=>{
 const f=fixture();try{
  f.book();assert.equal(await retry(f.db,{bookId:'book',contentVersion:1}),false)
  const job=await claimPublicBookIndex(f.db,lease);await failPublicBookIndex(f.db,job,101,'parse_failed',{permanent:true})
  assert.equal(await retry(f.db,{bookId:'book',contentVersion:99}),false)
  assert.equal(await retry(f.db,{bookId:'book',contentVersion:1}),true)
  assert.equal(await retry(f.db,{bookId:'book',contentVersion:1}),false)
  assert.equal(f.sql.prepare("SELECT status FROM books_index_state WHERE book_id='book'").get().status,'queued')
  const event=await claim(f.db,lease);assert.equal(event.content_version,2)
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='book'")
  assert.equal(await retry(f.db,{bookId:'book',contentVersion:3}),false)
 }finally{f.sql.close()}
})
test('eligible metadata uses latest canonical alias and category-only changes queue a new revision',()=>{
 const f=fixture();try{
  f.sql.exec("UPDATE accounts SET role='super-admin' WHERE subject='owner'")
  f.book()
  const put=f.sql.prepare("INSERT INTO central_book_overrides(book_id,title,author,category,visibility,updated_by,revision) VALUES(?,?,?,?,'public','owner',?)")
  put.run('book','raw title','raw author','raw category',1)
  put.run('central-submission:book','published title','published author','published category',3)
  put.run('account-book:book','older title','older author','older category',2)
  const row=()=>f.sql.prepare("SELECT * FROM public_book_index_eligible WHERE id='book'").get()
  assert.equal(row().title,'published title');assert.equal(row().author,'published author');assert.equal(row().category,'published category')
  const generation=row().generation
  f.sql.exec("UPDATE central_book_overrides SET category=NULL,revision=revision+1 WHERE book_id='central-submission:book'")
  assert.equal(row().generation,generation+1);assert.equal(row().category,'')
  f.sql.exec("UPDATE central_book_overrides SET visibility='hidden' WHERE book_id='account-book:book'")
  assert.equal(row(),undefined)
 }finally{f.sql.close()}
})
