import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {onRequest} from '../functions/api/library/book-editions.js'
const subject=email=>createHash('sha256').update('khizana-test:'+email).digest('hex')
function fixture(){
 const db=new DatabaseSync(':memory:')
 for(const name of ['0002_accounts_and_private_books','0004_central_book_overrides','0012_account_blocks','0031_independent_pdf_editions'])db.exec(readFileSync(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'))
 db.exec('ALTER TABLE user_books ADD COLUMN deleted_at TEXT;CREATE TABLE user_book_metadata(book_id TEXT PRIMARY KEY,metadata_json TEXT)')
 for(const email of ['a@test.test','b@test.test'])db.prepare('INSERT INTO accounts(subject,email) VALUES(?,?)').run(subject(email),email)
 const env={ACCOUNT_TEST_MODE:'true',VISITORS_DB:{prepare(sql){let args=[];const stmt=db.prepare(sql);return{bind(...v){args=v;return this},async first(){return stmt.get(...args)??null},async all(){return{results:stmt.all(...args)}},async run(){return{meta:{changes:Number(stmt.run(...args).changes)}}}}}}}
 function book(id,owner='a@test.test',pub=false,mime='application/pdf'){db.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES(?,?,?,'مؤلف',?,?,10,?,?)").run(id,subject(owner),id,'private/'+id,mime,pub?'public':'private',pub?'approved':'pending');db.prepare('INSERT INTO user_book_metadata VALUES(?,?)').run(id,JSON.stringify({schemaVersion:1,edition:'طبعة ثانية',publisher:'ناشر'}))}
 const call=(id,email,body)=>onRequest({env,request:new Request('https://site.test/api/library/book-editions?id='+id,{method:body?'POST':'GET',headers:{...(email?{'x-khizana-test-email':email}:{}),'x-alkhizana-request':'account-ui',...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})})
 return{db,env,book,call}
}
test('independent PDF relation is idempotent, owner-only and does not alter source content',async()=>{
 const f=fixture();try{f.book('parent','a@test.test',false,'text/plain');f.book('pdf');f.book('foreign','b@test.test')
 assert.equal((await f.call('', 'b@test.test',{bookId:'pdf',parentId:'foreign'})).status,404)
 assert.equal((await f.call('', 'a@test.test',{bookId:'pdf',parentId:'foreign'})).status,404)
 for(let i=0;i<2;i++)assert.equal((await f.call('', 'a@test.test',{bookId:'pdf',parentId:'parent'})).status,200)
 const value=await(await f.call('parent','a@test.test')).json();assert.equal(value.editions[0].edition,'طبعة ثانية');assert.equal(value.parent.id,'parent')
 assert.equal((await f.call('parent','b@test.test')).status,404)
 assert.equal(f.db.prepare('SELECT COUNT(*) n FROM independent_pdf_editions').get().n,1)
 assert.equal(f.db.prepare("SELECT object_key FROM user_books WHERE id='parent'").get().object_key,'private/parent')
 }finally{f.db.close()}
})
test('publishing child never exposes a private parent and withdrawal removes related entries',async()=>{
 const f=fixture();try{f.book('private-parent');f.book('public-pdf');await f.call('','a@test.test',{bookId:'public-pdf',parentId:'private-parent'});f.db.exec("UPDATE user_books SET visibility='public',review_status='approved' WHERE id='public-pdf'")
 const anon=await(await f.call('public-pdf')).json();assert.deepEqual(anon.editions,[]);assert.equal(anon.parent,undefined);assert.ok(!JSON.stringify(anon).includes('private-parent'))
 f.db.exec("UPDATE user_books SET visibility='public',review_status='approved' WHERE id='private-parent'")
 assert.equal((await(await f.call('private-parent')).json()).editions.length,1)
 f.db.prepare("INSERT INTO central_book_overrides(book_id,visibility,updated_by) VALUES('public-pdf','hidden',?)").run(subject('a@test.test'))
 assert.equal((await(await f.call('private-parent')).json()).editions.length,0)
 assert.equal((await f.call('public-pdf')).status,404)
 }finally{f.db.close()}
})
test('private siblings never appear to another account or anonymous viewers',async()=>{
 const f=fixture();try{f.book('parent','a@test.test',true);f.book('pdf');await f.call('','a@test.test',{bookId:'pdf',parentId:'parent'})
 for(const email of [undefined,'b@test.test'])assert.equal((await(await f.call('parent',email)).json()).editions.length,0)
 assert.equal((await(await f.call('parent','a@test.test')).json()).editions.length,1)
 assert.equal((await f.call('','a@test.test',{bookId:'parent',parentId:'parent'})).status,400)
 }finally{f.db.close()}
})
test('account block prevents creating a relation',async()=>{
 const f=fixture();try{f.book('parent');f.book('pdf');f.db.prepare("INSERT INTO account_blocks(subject,blocked,updated_by,reason,version,last_operation) VALUES(?,1,?,'test',1,'block-test')").run(subject('a@test.test'),subject('b@test.test'))
 assert.equal((await f.call('','a@test.test',{bookId:'pdf',parentId:'parent'})).status,401)
 }finally{f.db.close()}
})
test('packaged parent must exist and edition pagination does not silently truncate',async()=>{
 const f=fixture();try{
  f.env.ASSETS={async fetch(url){assert.equal(new URL(url).pathname,'/data/seo/books-01.json');return Response.json({records:{'1':{title:'packaged'}}})}}
  for(let i=0;i<51;i++){const id='pdf-'+String(i).padStart(2,'0');f.book(id);assert.equal((await f.call('','a@test.test',{bookId:id,parentId:'410000001'})).status,200)}
  f.db.exec("UPDATE user_books SET visibility='public',review_status='approved'")
  const first=await(await f.call('410000001')).json();assert.equal(first.editions.length,50);assert.equal(first.hasMore,true);assert.equal(first.parent.packaged,true)
  const second=await onRequest({env:f.env,request:new Request('https://site.test/api/library/book-editions?id=410000001&page=1')});const data=await second.json();assert.equal(data.editions.length,1);assert.equal(data.hasMore,false)
 }finally{f.db.close()}
})
test('ordinary owner cannot edit a published PDF relationship outside editorial review',async()=>{
 const f=fixture();try{f.book('parent','a@test.test',true);f.book('pdf','a@test.test',true);assert.equal((await f.call('','a@test.test',{bookId:'pdf',parentId:'parent'})).status,403)}finally{f.db.close()}
})

test('edition lookup uses the current SEO partition for 151179 and its reader ID',async()=>{
 const f=fixture();try{
  const paths=[]
  f.env.ASSETS={async fetch(url){paths.push(new URL(url).pathname);return Response.json({records:{'151179':{title:'التفسير والبيان'}}})}}
  for(const id of ['151179','410151179']){
   const response=await f.call(id);assert.equal(response.status,200)
   assert.equal((await response.json()).parent.title,'التفسير والبيان')
  }
  assert.ok(paths.length>0);assert.ok(paths.every(path=>path==='/data/seo/books-03.json'))
  f.book('new-pdf');assert.equal((await f.call('','a@test.test',{bookId:'new-pdf',parentId:'410151179'})).status,200)
  f.db.prepare("INSERT INTO central_book_overrides(book_id,visibility,updated_by) VALUES('shamela-151179','hidden',?)").run(subject('a@test.test'))
  assert.equal((await f.call('410151179')).status,404)
 }finally{f.db.close()}
})
