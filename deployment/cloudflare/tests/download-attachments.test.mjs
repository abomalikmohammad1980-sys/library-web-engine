import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {onRequest} from '../functions/api/library/attachments.js'
import {onRequest as download} from '../functions/api/library/attachments/[attachmentId].js'
const id='att-12345678-1234-4234-8234-123456789abc',subject=email=>createHash('sha256').update('khizana-test:'+email).digest('hex')
const original=Uint8Array.from([80,75,3,4,0,255,33])
function fixture(){
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON')
 for(const name of ['0002_accounts_and_private_books','0006_account_storage_quotas','0012_account_blocks','0042_download_attachments'])db.exec(readFileSync(new URL('../migrations/'+name+'.sql',import.meta.url),'utf8'))
 for(const [email,role] of [['owner@test.test','user'],['other@test.test','user'],['admin@test.test','admin']])db.prepare('INSERT INTO accounts(subject,email,role) VALUES(?,?,?)').run(subject(email),email,role)
 const objects=new Map();let puts=0,failPut=false,onGet=()=>{}
 const VISITORS_DB={
  prepare(sql){
   let args=[]
   return {
    bind(...v){args=v;return this},
    async first(){return db.prepare(sql).get(...args)??null},
    async all(){return {results:db.prepare(sql).all(...args)}},
    async run(){return{meta:{changes:Number(db.prepare(sql).run(...args).changes)}}},
   }
  },
  async batch(statements){db.exec('BEGIN');try{const results=[];for(const stmt of statements)results.push(await stmt.run());db.exec('COMMIT');return results}catch(error){db.exec('ROLLBACK');throw error}},
 }
 const env={ACCOUNT_TEST_MODE:'true',VISITORS_DB,LIBRARY_R2:{async put(key,stream){puts++;if(failPut)throw Error('put_failure');objects.set(key,new Uint8Array(await new Response(stream).arrayBuffer()))},async delete(key){objects.delete(key)},async get(key){onGet();const data=objects.get(key);return data?{size:data.length,body:new Response(data).body}:null},async head(key){const data=objects.get(key);return data?{size:data.length}:null}}}
 const headers=email=>({'x-alkhizana-request':'account-ui',...(email?{'x-khizana-test-email':email}:{})})
 const call=(method,email,body,query='')=>onRequest({env,request:new Request('https://site.test/api/library/attachments'+query,{method,headers:headers(email),...(body?{body}: {})})})
 const form=(name='موسوعة.zip',bytes=original)=>{const f=new FormData();f.set('file',new File([bytes],name));f.set('title','مجموعة');f.set('description','أصول للتحميل فقط');f.set('category','الحديث');f.set('uploadId',id);return f}
 const file=(email,method='GET')=>download({env,params:{attachmentId:id},request:new Request('https://site.test/api/library/attachments/'+id,{method,headers:headers(email)})})
 const patch=(state,revision=0,email='admin@test.test')=>call('PATCH',email,JSON.stringify({id,state,revision}))
 return {db,objects,env,call,form,file,patch,puts:()=>puts,fail:()=>{failPut=true},onGet:fn=>{onGet=fn}}
}
test('archives remain pending download-only objects, publish explicitly and withdraw immediately',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('POST','owner@test.test',f.form())).status,201)
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM user_books').get().n,0)
  assert.equal((await f.file()).status,404);assert.equal((await f.file('other@test.test')).status,404)
  const owned=await f.file('owner@test.test');assert.equal(owned.status,200);assert.deepEqual(new Uint8Array(await owned.arrayBuffer()),original);assert.match(owned.headers.get('content-disposition'),/^attachment;/)
  assert.deepEqual((await (await f.call('GET',null,null,'?category='+encodeURIComponent('الحديث'))).json()).attachments,[])
  assert.equal((await f.patch('public',0,'owner@test.test')).status,403)
  assert.equal((await f.patch('public')).status,200)
  assert.equal((await f.file()).status,200)
  const list=await(await f.call('GET',null,null,'?category='+encodeURIComponent('الحديث'))).json();assert.equal(list.attachments.length,1);assert.equal(list.attachments[0].description,'أصول للتحميل فقط');assert(!('object_key'in list.attachments[0]))
  assert.equal((await f.patch('withdrawn',0)).status,409)
  assert.equal((await f.patch('withdrawn',1,'other@test.test')).status,409)
  assert.equal((await f.patch('withdrawn',1,'owner@test.test')).status,200)
  assert.equal((await f.file()).status,404);assert.equal((await f.file('owner@test.test')).status,200)
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM download_attachment_events').get().n,3)
 }finally{f.db.close()}
})
test('idempotent retries do not allocate another object or charge quota twice',async()=>{
 const f=fixture();try{assert.equal((await f.call('POST','owner@test.test',f.form())).status,201);assert.equal((await f.call('POST','owner@test.test',f.form())).status,200);assert.equal(f.puts(),1);assert.equal(f.db.prepare('SELECT used_bytes FROM account_storage_usage').get().used_bytes,original.length)
 const conflict=f.form();conflict.set('title','عنوان آخر');assert.equal((await f.call('POST','owner@test.test',conflict)).status,409)
 }finally{f.db.close()}
})
test('rejects anonymous, cross-site and invalid archive content before object writes',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('POST',null,f.form())).status,401)
  assert.equal((await onRequest({env:f.env,request:new Request('https://site.test/api/library/attachments',{method:'POST',headers:{origin:'https://evil.test'},body:f.form()})})).status,403)
  for(const [name,bytes]of [['fake.rar',original],['fake.zip',new TextEncoder().encode('<html>')],['a.exe',original]])assert.equal((await f.call('POST','owner@test.test',f.form(name,bytes))).status,415)
  assert.equal(f.puts(),0)
 }finally{f.db.close()}
})
test('cleans a failed object attempt and releases only its reserved quota',async()=>{
 const f=fixture();try{f.fail();assert.equal((await f.call('POST','owner@test.test',f.form())).status,503);assert.equal(f.db.prepare('SELECT used_bytes FROM account_storage_usage').get().used_bytes,0);assert.equal(f.objects.size,0)}finally{f.db.close()}
})
test('a withdrawal racing the R2 read prevents returning the body',async()=>{
 const f=fixture();try{await f.call('POST','owner@test.test',f.form());await f.patch('public');f.onGet(()=>f.db.prepare("UPDATE download_attachments SET state='withdrawn',revision=revision+1 WHERE id=?").run(id));assert.equal((await f.file()).status,404)}finally{f.db.close()}
})
test('bounds review bodies and refuses private-list access and oversized quotas',async()=>{
 const f=fixture();try{
  assert.equal((await f.call('PATCH','admin@test.test',' '.repeat(5000))).status,400)
  assert.equal((await f.call('GET',null,null,'?mine=1')).status,401)
  assert.equal((await f.call('GET','owner@test.test',null,'?review=pending')).status,403)
  f.env.ACCOUNT_MAX_STORAGE_BYTES='1';assert.equal((await f.call('POST','owner@test.test',f.form())).status,409);assert.equal(f.puts(),0)
 }finally{f.db.close()}
})
test('RAR files are accepted without extraction, text parsing or book creation',async()=>{
 const f=fixture();try{const bytes=Uint8Array.from([82,97,114,33,26,7,1,0,99]);assert.equal((await f.call('POST','owner@test.test',f.form('أرشيف.rar',bytes))).status,201);const response=await f.file('owner@test.test');assert.equal(response.headers.get('content-type'),'application/vnd.rar');assert.deepEqual(new Uint8Array(await response.arrayBuffer()),bytes);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM user_books').get().n,0)}finally{f.db.close()}
})

test('a lost transaction response never deletes a committed original or releases its quota',async()=>{
 const f=fixture();try{
  const batch=f.env.VISITORS_DB.batch.bind(f.env.VISITORS_DB)
  f.env.VISITORS_DB.batch=async statements=>{const result=await batch(statements);if(f.objects.size)throw Error('response_lost');return result}
  assert.equal((await f.call('POST','owner@test.test',f.form())).status,201)
  assert.equal(f.objects.size,1)
  assert.deepEqual(new Uint8Array(await (await f.file('owner@test.test')).arrayBuffer()),original)
  assert.equal(f.db.prepare('SELECT used_bytes FROM account_storage_usage').get().used_bytes,original.length)
  assert.equal((await f.call('POST','owner@test.test',f.form())).status,200)
  assert.equal(f.puts(),1)
 }finally{f.db.close()}
})

test('an authoritative rollback releases only the failed attempt',async()=>{
 const f=fixture();try{
  const batch=f.env.VISITORS_DB.batch.bind(f.env.VISITORS_DB)
  f.env.VISITORS_DB.batch=async statements=>{if(f.objects.size)throw Error('transaction_rejected');return batch(statements)}
  assert.equal((await f.call('POST','owner@test.test',f.form())).status,503)
  assert.equal(f.objects.size,0)
  assert.equal(f.db.prepare('SELECT used_bytes FROM account_storage_usage').get().used_bytes,0)
 }finally{f.db.close()}
})

test('unknown commit status preserves bytes and quota pending reconciliation',async()=>{
 const f=fixture();try{
  const batch=f.env.VISITORS_DB.batch.bind(f.env.VISITORS_DB)
  f.env.VISITORS_DB.batch=async statements=>{if(f.objects.size)throw Error('transaction_unknown');return batch(statements)}
  const prepare=f.env.VISITORS_DB.prepare.bind(f.env.VISITORS_DB)
  f.env.VISITORS_DB.prepare=sql=>sql.startsWith('SELECT object_key')?{bind(){return this},async first(){throw Error('database_unavailable')}}:prepare(sql)
  const response=await f.call('POST','owner@test.test',f.form())
  assert.equal(response.status,503);assert.equal((await response.json()).error,'attachment_status_uncertain')
  assert.equal(f.objects.size,1)
  assert.equal(f.db.prepare('SELECT used_bytes FROM account_storage_usage').get().used_bytes,original.length)
 }finally{f.db.close()}
})
