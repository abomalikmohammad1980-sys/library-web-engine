import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {createBookIndexingHandler,onRequest} from '../deployment/cloudflare/functions/api/admin/book-indexing.js'
function context(method='GET',path='',body,db){return{request:new Request('https://preview.test/api/admin/book-indexing'+path,{method,headers:method==='POST'?{'x-alkhizana-request':'account-ui','content-type':'application/json'}:{},...(body===undefined?{}:{body:JSON.stringify(body)})}),env:{PUBLIC_BOOK_INGESTION_ENABLED:'true',VISITORS_DB:db}}}
function fixture(){const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE user_books(id TEXT,title TEXT); CREATE TABLE books_index_state(book_id TEXT,status TEXT,content_version INTEGER,updated_at INTEGER,indexed_at INTEGER,toc_source TEXT,ocr INTEGER,last_error TEXT)');for(let n=0;n<205;n++){sql.prepare('INSERT INTO user_books VALUES(?,?)').run(String(n),'عنوان '+n);sql.prepare('INSERT INTO books_index_state VALUES(?,?,?,?,?,?,?,?)').run(String(n),n===0?'failed':'ready',1,n,null,'none',0,'SECRET_STORAGE_KEY')}
 const db={
  withSession(mode){assert.equal(mode,'first-primary');return db},
  prepare(query){return {first:async()=>sql.prepare(query).get(),bind:(...args)=>({all:async()=>({results:sql.prepare(query).all(...args)})})}}
 };return{db,sql}}
test('true server roles required; local spoof headers have no authority; disabled gate is unavailable',async()=>{
 assert.equal((await onRequest(context())).status,403)
 for(const role of ['user','editor'])assert.equal((await createBookIndexingHandler(async()=>({role}))(context())).status,403)
 const c=context();c.env.PUBLIC_BOOK_INGESTION_ENABLED='false';assert.equal((await createBookIndexingHandler(async()=>({role:'admin'}))(c)).status,503)
})
test('real SQLite pagination100 and safe projection omits private infrastructure fields',async()=>{
 const f=fixture(),handler=createBookIndexingHandler(async()=>({role:'super-admin'}))
 const response=await handler(context('GET','?page=2',undefined,f.db)),body=await response.json()
 assert.equal(response.status,200);assert.equal(body.rows.length,100);assert.equal(body.pages,3);assert.equal(body.counts.ready,204);assert.equal(body.counts.failed,1);assert(!JSON.stringify(body).includes('SECRET'));assert.equal(response.headers.get('cache-control'),'private, no-store')
 assert.equal((await handler(context('GET','?page=3',undefined,f.db))).status,200)
 assert.equal((await handler(context('GET','?page=0',undefined,f.db))).status,400);f.sql.close()
})
test('scanned metadata has its own count and is neither failed nor processing',async()=>{
 const f=fixture();f.sql.exec("UPDATE books_index_state SET status='ocr_pending',indexed_at=123,toc_source='pdf_bookmarks',ocr=0 WHERE book_id='204'")
 const body=await(await createBookIndexingHandler(async()=>({role:'admin'}))(context('GET','',undefined,f.db))).json()
 assert.equal(body.counts.ocrPending,1);assert.equal(body.counts.failed,1);assert.equal(body.counts.processing,0);assert.equal(body.counts.ready,203)
 assert.equal(body.rows[0].status,'ocr_pending');assert.equal(body.rows[0].indexedAt,123);assert.equal(body.rows[0].ocr,false);f.sql.close()
})
test('retry requires trusted mutation, bounded input, failed-version helper success; conflicts stay409',async()=>{
 const f=fixture();let calls=0
 const handler=createBookIndexingHandler(async()=>({role:'admin'}),async(_db,b)=>{calls++;return b.bookId==='0'&&b.contentVersion===1})
 assert.equal((await handler(context('POST','',{bookId:'0',contentVersion:1},f.db))).status,202)
 assert.equal((await handler(context('POST','',{bookId:'0',contentVersion:2},f.db))).status,409)
 assert.equal((await handler(context('POST','',{bookId:'x'.repeat(5000),contentVersion:1},f.db))).status,400)
 const bad=context('POST','',{bookId:'0',contentVersion:1},f.db);bad.request.headers.set('origin','https://evil.test')
 assert.equal((await handler(bad)).status,403);assert.equal(calls,2);f.sql.close()
})
