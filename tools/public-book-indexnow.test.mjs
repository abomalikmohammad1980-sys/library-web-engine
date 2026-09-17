import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {DatabaseSync} from 'node:sqlite'
import {notifyPublicBookIndexNow,indexNowKeyResponse} from '../deployment/cloudflare/functions/api/_public-book-indexnow.js'
const migration=await readFile('deployment/cloudflare/migrations/0038_public_book_indexnow.sql','utf8'),key='a'.repeat(64)
function setup(){const sql=new DatabaseSync(':memory:');sql.exec(`CREATE TABLE public_book_event_state(book_id TEXT,content_version INTEGER,index_generation INTEGER,visibility TEXT);CREATE TABLE public_book_index_jobs(book_id TEXT,generation INTEGER,state TEXT);CREATE TABLE public_book_index_eligible(id TEXT,generation INTEGER);${migration}`)
 sql.exec("INSERT INTO public_book_event_state VALUES('book-one',1,1,'public'),('removed',2,1,'removed');INSERT INTO public_book_index_jobs VALUES('book-one',1,'ready');INSERT INTO public_book_index_eligible VALUES('book-one',1)")
 const db={prepare(query){return{bind:(...args)=>({run:async()=>sql.prepare(query).run(...args),first:async()=>sql.prepare(query).get(...args)})}},withSession(mode){assert.equal(mode,'first-primary');return db}}
 return{sql,env:{VISITORS_DB:db,INDEXNOW_ENABLED:'true',INDEXNOW_SUBMISSION_APPROVED:'true',INDEXNOW_KEY:key}}}
const event={bookId:'book-one',contentVersion:1,action:'upsert'},clock={now:()=>100,token:()=> 'safe-lease-token-12345'}
test('redirects are rejected durably without following their Location',async()=>{
 for(const status of [301,302,303,307,308]){
  const f=setup();let calls=0,cancelled=false
  const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://api.indexnow.org/indexnow');assert.equal(init.redirect,'manual');return new Response(new ReadableStream({cancel(){cancelled=true}}),{status,headers:{location:'https://untrusted.invalid/collect'}})}
  assert.equal((await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher})).status,'failed')
  assert.equal((await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher})).status,'failed')
  assert.equal(calls,1);assert.equal(cancelled,true)
  assert.equal(f.sql.prepare('SELECT http_status FROM public_book_indexnow').get().http_status,status);f.sql.close()
 }
})
test('accepted receipt is idempotent, fixed URL only, 202 means accepted not indexed',async()=>{
 const f=setup();let calls=0
 const fetcher=async(url,init)=>{calls++;assert.equal(url,'https://api.indexnow.org/indexnow');assert.equal(init.redirect,'manual');const body=JSON.parse(init.body);assert.deepEqual(body.urlList,['https://khzanah.com/books/public/book-one']);return new Response(null,{status:202})}
 assert.equal((await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher})).status,'accepted')
 assert.equal((await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher})).status,'accepted');assert.equal(calls,1);f.sql.close()
})
test('disabled/private-only/stale/nonready events never submit; historical removals do',async()=>{
 const f=setup();let calls=0;const fetcher=async()=>{calls++;return new Response(null,{status:200})}
 assert.equal((await notifyPublicBookIndexNow({...f.env,INDEXNOW_SUBMISSION_APPROVED:'false'},event,{...clock,fetcher})).status,'disabled')
 for(const e of [{...event,bookId:'private-only'},{...event,contentVersion:2}])assert.equal((await notifyPublicBookIndexNow(f.env,e,{...clock,fetcher})).status,'ignored')
 f.sql.exec("UPDATE public_book_index_jobs SET state='queued'")
 assert.equal((await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher})).status,'ignored');assert.equal(calls,0)
 assert.equal((await notifyPublicBookIndexNow(f.env,{bookId:'removed',contentVersion:2,action:'remove'},{...clock,fetcher})).status,'accepted');assert.equal(calls,1);f.sql.close()
})
test('429/5xx use durable retry delay, permanent failures stop and keys are exact host/path',async()=>{
 const f=setup();let calls=0;const fetcher=async()=>{calls++;return new Response(null,{status:429})}
 let result=await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher});assert.equal(result.status,'pending');assert.equal(result.retryAt,160)
 await notifyPublicBookIndexNow(f.env,event,{...clock,fetcher});assert.equal(calls,1)
 result=await notifyPublicBookIndexNow(f.env,event,{...clock,now:()=>160,fetcher:async()=>new Response(null,{status:503})});assert.equal(result.retryAt,460)
 result=await notifyPublicBookIndexNow(f.env,event,{...clock,now:()=>460,fetcher:async()=>new Response(null,{status:403})});assert.equal(result.status,'failed')
 assert.equal(await indexNowKeyResponse(new Request(`https://khzanah.com/${key}.txt`),f.env).text(),key)
 assert.equal(indexNowKeyResponse(new Request(`https://preview.pages.dev/${key}.txt`),f.env),null)
 assert.equal(indexNowKeyResponse(new Request('https://khzanah.com/other.txt'),f.env),null)
 await assert.rejects(notifyPublicBookIndexNow(f.env,{...event,bookId:'https://evil.test/'},{...clock,fetcher}),/invalid_event/);f.sql.close()
})
