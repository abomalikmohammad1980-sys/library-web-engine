import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync,readdirSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {onRequestPatch as ownerPatch,onRequestDelete as ownerDelete} from '../deployment/cloudflare/functions/api/account/books/[bookId].js'
import {onRequestPatch as review} from '../deployment/cloudflare/functions/api/admin/book-submissions/[bookId].js'
import {onRequestPatch as central} from '../deployment/cloudflare/functions/api/admin/library-books/[bookId].js'
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 const dir=new URL('../deployment/cloudflare/migrations/',import.meta.url)
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,dir),'utf8'))
 const email='fixture@example.test',subject=createHash('sha256').update('khizana-test:'+email).digest('hex')
 sql.prepare("INSERT INTO accounts(subject,email,role) VALUES(?,?,'super-admin')").run(subject,email)
 sql.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('book',?,'old','old author','fixture/source','text/plain',10,'private','pending')").run(subject)
 let race
 const wrap=query=>{let args=[];return{query,bind(...a){args=a;return this},async first(){if(race&&query.startsWith('UPDATE user_books SET deleted_at')){race();race=null}return sql.prepare(query).get(...args)??null},async all(){return{results:sql.prepare(query).all(...args)}},async run(){const before=sql.prepare('SELECT total_changes() n').get().n;sql.prepare(query).run(...args);return{meta:{changes:sql.prepare('SELECT total_changes() n').get().n-before}}},args:()=>args}}
 const db={prepare:wrap,async batch(statements){sql.exec('BEGIN');try{const results=statements.map(s=>{const before=sql.prepare('SELECT total_changes() n').get().n;const rows=/RETURNING /i.test(s.query)?sql.prepare(s.query).all(...s.args()):(sql.prepare(s.query).run(...s.args()),[]);return{results:rows,meta:{changes:sql.prepare('SELECT total_changes() n').get().n-before}}});sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}}
 let wakes=0,deletes=0;const pending=[]
 const context=(method,body={},id='book')=>({request:new Request('https://khzanah.com/api/books/'+id,{method,headers:{'content-type':'application/json','x-alkhizana-request':'account-ui','x-khizana-test-email':email},...(method==='DELETE'?{}:{body:JSON.stringify(body)})}),params:{bookId:id},env:{ACCOUNT_TEST_MODE:'true',BOOK_INDEX_QUEUE_ENABLED:'true',VISITORS_DB:db,LIBRARY_R2:{delete:async()=>{deletes++}},BOOK_INDEX_WAKE:{fetch:async()=>{wakes++;return new Response(null)}}},waitUntil(p){pending.push(p)}})
 return {sql,db,context,stats:()=>({wakes,deletes}),flush:()=>Promise.all(pending),race(fn){race=fn}}
}
test('owner metadata and deletion succeed despite all lifecycle triggers; stale CAS never wakes',async()=>{
 const f=fixture();try{
  const body={title:'new',author:'new author',category:'category',reviewVersion:0}
  assert.equal((await ownerPatch(f.context('PATCH',body))).status,200);await f.flush();assert.equal(f.stats().wakes,1)
  assert.equal((await ownerPatch(f.context('PATCH',body))).status,409);await f.flush();assert.equal(f.stats().wakes,1)
  assert.equal((await ownerDelete(f.context('DELETE'))).status,200);await f.flush();assert.equal(f.stats().wakes,2);assert.equal(f.stats().deletes,1)
 }finally{f.sql.close()}
})
test('review and central metadata prove intended returning row, not total trigger changes',async()=>{
 const f=fixture();try{
  assert.equal((await review(f.context('PATCH',{decision:'publish',reviewVersion:0}))).status,200);await f.flush()
  assert.equal((await review(f.context('PATCH',{decision:'private',reviewVersion:0}))).status,409)
  assert.equal((await central(f.context('PATCH',{action:'update',expectedVersion:0,title:'central new'},'central-submission:book'))).status,200);await f.flush()
  assert.equal((await central(f.context('PATCH',{action:'update',expectedVersion:0,title:'stale'},'central-submission:book'))).status,409)
  assert.equal(f.stats().wakes,2)
 }finally{f.sql.close()}
})
test('publication winning deletion race prevents R2 removal and wake',async()=>{
 const f=fixture();try{
  f.race(()=>f.sql.exec("UPDATE user_books SET visibility='public',review_status='approved' WHERE id='book'"))
  assert.equal((await ownerDelete(f.context('DELETE'))).status,409);await f.flush();assert.deepEqual(f.stats(),{wakes:0,deletes:0})
 }finally{f.sql.close()}
})
