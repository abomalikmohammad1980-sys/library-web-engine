import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {indexedSitemap,indexedSitemapPages} from '../deployment/cloudflare/functions/_seo-indexed-sitemap.js'
function fixture(){
 const sql=new DatabaseSync(':memory:')
 sql.exec(`CREATE TABLE user_books(id TEXT PRIMARY KEY,visibility TEXT,review_status TEXT,deleted_at TEXT,updated_at TEXT);
 CREATE TABLE books_index_state(book_id TEXT PRIMARY KEY,visibility TEXT,status TEXT,indexed_at INTEGER,content_version INTEGER);
 CREATE TABLE central_book_overrides(book_id TEXT PRIMARY KEY,visibility TEXT,logically_deleted_at TEXT);`)
 const db={withSession(value){assert.equal(value,'first-primary');return this},prepare(query){let args=[];return{bind(...a){args=a;return this},async all(){return{results:sql.prepare(query).all(...args)}},async first(){return sql.prepare(query).get(...args)}}}}
 const book=(id,status='ready')=>{sql.prepare("INSERT INTO user_books VALUES(?,'public','approved',NULL,'2000-01-01')").run(id);sql.prepare("INSERT INTO books_index_state VALUES(?,'public',?,1720000000,1)").run(id,status)}
 return{sql,db,book}
}
const url=page=>new URL('https://preview.khezana.pages.dev/sitemap-public.xml'+(page?'?page='+page:''))
test('ready-only live sitemap uses indexed_at and vetoes every withdrawn alias',async()=>{
 const f=fixture();try{
  for(const id of ['ready','hidden1','hidden2','hidden3'])f.book(id)
  f.book('failed','failed');f.book('queued','queued')
  for(const [id,i] of ['hidden1','central-submission:hidden2','account-book:hidden3'].map((x,i)=>[x,i]))f.sql.prepare('INSERT INTO central_book_overrides VALUES(?,?,?)').run(id,i===2?'public':'private',i===2?'2026-01-01':null)
  const response=await indexedSitemap(f.db,url()),body=await response.text()
  assert.equal((body.match(/<url>/g)??[]).length,1);assert.match(body,/books\/public\/ready/)
  assert.match(body,new RegExp(new Date(1720000000000).toISOString().replaceAll('.','\\.')))
  assert.doesNotMatch(body,/hidden|failed|queued|2000-01-01/);assert.equal(response.headers.get('x-robots-tag'),'noindex')
  assert.equal(await indexedSitemapPages(f.db),1)
 }finally{f.sql.close()}
})
test('one-hour internal cache is versioned and fresh withdrawal fences even a racing cache hit',async()=>{
 const f=fixture(),entries=new Map();try{
  f.book('book');const cache={async match(k){return entries.get(k.url)?.clone()},async put(k,v){entries.set(k.url,v)}}
  const serve=()=>indexedSitemap(f.db,url(),{cache})
  const first=await serve();assert.match(await first.text(),/public\/book/)
  assert.equal(first.headers.get('cache-control'),'private, no-store')
  assert.equal([...entries.values()][0].headers.get('cache-control'),'public, max-age=3600')
  await serve();assert.equal(entries.size,1)
  f.sql.exec('UPDATE books_index_state SET indexed_at=indexed_at+10,content_version=2')
  await serve();assert.equal(entries.size,2)
  const match=cache.match;cache.match=async k=>{const response=await match(k);f.sql.exec("UPDATE user_books SET visibility='private'");return response}
  assert.doesNotMatch(await(await serve()).text(),/public\/book/)
  assert.equal(await indexedSitemapPages(f.db),0)
 }finally{f.sql.close()}
})
test('verified scanned metadata enters sitemap with real indexed_at; unverified and private scanned rows do not',async()=>{
 const f=fixture();try{
  f.book('scanned','ocr_pending');f.book('unfinished','ocr_pending');f.book('private-scan','ocr_pending')
  f.sql.exec("UPDATE books_index_state SET indexed_at=NULL WHERE book_id='unfinished';UPDATE user_books SET visibility='private' WHERE id='private-scan'")
  const xml=await(await indexedSitemap(f.db,url())).text()
  assert.match(xml,/public\/scanned/);assert.doesNotMatch(xml,/unfinished|private-scan/);assert.equal((xml.match(/<url>/g)??[]).length,1)
 }finally{f.sql.close()}
})
test('5000 URLs per file, no duplicates, invalid and missing pages are rejected',async()=>{
 const f=fixture();try{
  f.sql.exec('BEGIN');for(let i=0;i<5001;i++)f.book('book-'+i);f.sql.exec('COMMIT')
  assert.equal(await indexedSitemapPages(f.db),2)
  const a=await(await indexedSitemap(f.db,url())).text(),b=await(await indexedSitemap(f.db,url(2))).text()
  assert.equal((a.match(/<url>/g)??[]).length,5000);assert.equal((b.match(/<url>/g)??[]).length,1)
  const links=[...(a+b).matchAll(/<loc>([^<]+)<\/loc>/g)].map(m=>m[1]);assert.equal(new Set(links).size,5001)
  assert.equal((await indexedSitemap(f.db,url(3))).status,404)
  for(const value of ['0','1&page=2','x','1&private=true'])assert.equal((await indexedSitemap(f.db,url(value))).status,400)
 }finally{f.sql.close()}
})
