import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {createHash,randomUUID} from 'node:crypto'
import {onRequest} from '../alpha-publish/functions/api/admin/bok-publication.js'
const sha=x=>createHash('sha256').update(x).digest('hex'),origin='https://isolated.invalid'
function fixture(){
 const sqlite=new DatabaseSync(':memory:')
 for(const name of ['0002_accounts_and_private_books','0010_account_devices','0011_native_accounts','0012_account_blocks','0013_account_access_sessions','0017_account_editor_capability','0029_bok_text_drafts','0034_bok_publication_jobs'])sqlite.exec(readFileSync(new URL(`../alpha-publish/migrations/${name}.sql`,import.meta.url),'utf8'))
 let beforeInsert
 const db={prepare(sql){let args=[];return{bind(...v){args=v;return this},first(){return sqlite.prepare(sql).get(...args)??null},run(){if(sql.startsWith('INSERT INTO bok_publication_jobs')&&beforeInsert){const hook=beforeInsert;beforeInsert=null;hook()}return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}}}}
 sqlite.exec("INSERT INTO accounts(subject,email,role) VALUES('editor','editor@isolated.invalid','user'); INSERT INTO account_capabilities(subject,editorial) VALUES('editor',1)")
 sqlite.exec("INSERT INTO account_credentials(subject,password_hash,salt) VALUES('editor','unused','unused')")
 const token='1'.repeat(64),device='2'.repeat(64)
 sqlite.prepare("INSERT INTO account_devices(owner_subject,device_id,label,platform) VALUES('editor',?,'test','test')").run(sha(device))
 for(const table of ['account_access_sessions','account_sessions'])sqlite.prepare(`INSERT INTO ${table}(token_hash,subject,device_id,expires_at) VALUES(?,'editor',?,unixepoch()+600)`).run(sha(token),sha(device))
 sqlite.prepare("INSERT INTO bok_text_drafts VALUES('410000093',?,17,?,'التصحيح',1,'editor',CURRENT_TIMESTAMP)").run('a'.repeat(64),'b'.repeat(64))
 const env={VISITORS_DB:db,BOK_TEXT_EDITING_ENABLED:'1',BOK_PUBLICATION_JOBS_ENABLED:'1'},body=()=>({id:randomUUID(),bookId:'410000093',sourceHash:'a'.repeat(64),reviews:[{pageId:17,revision:1,baseHash:'b'.repeat(64),text:'التصحيح'}]})
 const call=(input,path='',native=false,extra={})=>onRequest({env,request:new Request(origin+'/api/admin/bok-publication'+path,{method:input?'POST':'GET',headers:{origin,'x-alkhizana-request':'account-ui',cookie:`${native?'__Host-khizana-session':'__Host-khizana-access-session'}=${token}; __Host-khizana-device=${device}`,...extra},...(input?{body:JSON.stringify(input)}:{})})})
 return{sqlite,env,body,call,race(fn){beforeInsert=fn}}
}
test('server flags gate editor and durable requests do not claim publication',async()=>{const f=fixture();try{
 let r=await(await f.call()).json();assert.equal(r.editingEnabled,true);assert.equal(r.submissionEnabled,true);assert.equal(r.automaticPublication,false)
 f.env.BOK_TEXT_EDITING_ENABLED='0';r=await(await f.call()).json();assert.equal(r.editingEnabled,false);assert.equal((await f.call(f.body())).status,503)
 }finally{f.sqlite.close()}})
test('reviewed request is durable, idempotent, current revision checked and status retrievable',async()=>{const f=fixture();try{
 const input=f.body();let r=await f.call(input);assert.equal(r.status,202);let data=await r.json();assert.equal(data.published,false);assert.equal(data.job.status,'awaiting_operator')
 assert.equal((await f.call(input)).status,200)
 data=await(await f.call(null,'?bookId=410000093')).json();assert.equal(data.job.id,input.id)
 const changed=f.body();f.sqlite.exec('UPDATE bok_text_drafts SET revision=2');assert.equal((await f.call(changed)).status,409);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM bok_publication_jobs').get().n,1)
 }finally{f.sqlite.close()}})
test('native editorial session supported and cross-site or revoked-before-insert cannot queue',async()=>{const f=fixture();try{
 assert.equal((await f.call(f.body(),'',true)).status,202)
 assert.equal((await f.call(f.body(),'',false,{origin:'https://other.invalid'})).status,403)
 f.race(()=>f.sqlite.exec('DELETE FROM account_capabilities'));assert.equal((await f.call(f.body())).status,409)
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM bok_publication_jobs').get().n,1)
 assert.equal((await f.call()).status,403)
 }finally{f.sqlite.close()}})
