import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {activateVerifiedBokRelease,readActiveBokRelease} from '../alpha-publish/functions/api/_bok-release-pointer.js'
const sha=x=>createHash('sha256').update(x).digest('hex')
function setup(){
 const sqlite=new DatabaseSync(':memory:')
 for(const name of ['0002_accounts_and_private_books','0010_account_devices','0012_account_blocks','0013_account_access_sessions','0017_account_editor_capability','0029_bok_text_drafts','0032_bok_release_pointer'])sqlite.exec(readFileSync(new URL(`../alpha-publish/migrations/${name}.sql`,import.meta.url),'utf8'))
 const db={prepare(sql){let args=[];return{bind(...v){args=v;return this},first(){return sqlite.prepare(sql).get(...args)??null},run(){return{meta:{changes:Number(sqlite.prepare(sql).run(...args).changes)}}}}},async batch(rows){sqlite.exec('BEGIN');try{const result=rows.map(x=>x.run());sqlite.exec('COMMIT');return result}catch(e){sqlite.exec('ROLLBACK');throw e}}}
 sqlite.exec("INSERT INTO accounts(subject,email,role) VALUES('editor','editor@test.invalid','user'); INSERT INTO account_capabilities(subject,editorial) VALUES('editor',1)")
 sqlite.prepare("INSERT INTO account_devices(owner_subject,device_id,label,platform) VALUES('editor',?,'test','test')").run(sha('2'.repeat(64)))
 sqlite.prepare("INSERT INTO account_access_sessions(token_hash,subject,device_id,expires_at) VALUES(?,'editor',?,unixepoch()+600)").run(sha('1'.repeat(64)),sha('2'.repeat(64)))
 sqlite.prepare("INSERT INTO bok_text_drafts VALUES('book',?,1,?,'corrected',1,'editor',CURRENT_TIMESTAMP)").run('a'.repeat(64),'b'.repeat(64))
 const reviews=JSON.stringify([{pageId:1,revision:1,baseHash:'b'.repeat(64),text:'corrected'}])
 for(const id of ['c','d'])sqlite.prepare('INSERT INTO bok_verified_releases(release_id,candidate_sha256,book_id,source_hash,reader_manifest_sha256,search_manifest_sha256,artifact_root,reviews_json,cloud_receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?)').run(id.repeat(64),'e'.repeat(64),'book','a'.repeat(64),'f'.repeat(64),'9'.repeat(64),'https://isolated.invalid/release/'+id,reviews,'8'.repeat(64))
 const context={request:new Request('https://isolated.invalid',{headers:{cookie:`__Host-khizana-access-session=${'1'.repeat(64)}; __Host-khizana-device=${'2'.repeat(64)}`}}),env:{VISITORS_DB:db,BOK_RELEASE_ACTIVATION_ENABLED:'1'}}
 const activate=(extra={})=>activateVerifiedBokRelease(context,{releaseId:'c'.repeat(64),candidateSha256:'e'.repeat(64),expectedGeneration:0,expectedReleaseId:null,...extra})
 return{sqlite,db,context,activate}
}
test('one CAS pointer binds reader/search and audit, stale activations cannot overwrite it',async()=>{
 const f=setup();try{
 assert.equal(await f.activate(),true)
 const pointer=await readActiveBokRelease(f.db);assert.equal(pointer.generation,1);assert.equal(pointer.readerManifestSha256,'f'.repeat(64));assert.equal(pointer.searchManifestSha256,'9'.repeat(64))
 assert.equal(await f.activate(),false)
 assert.equal(await f.activate({releaseId:'d'.repeat(64),expectedGeneration:1,expectedReleaseId:'c'.repeat(64)}),true)
 assert.equal(await f.activate({expectedGeneration:2,expectedReleaseId:'d'.repeat(64)}),true)
 assert.equal((await readActiveBokRelease(f.db)).generation,3)
 assert.equal(f.sqlite.prepare('SELECT count(*) n FROM bok_release_activation_events').get().n,3)
 assert.throws(()=>f.sqlite.exec("UPDATE bok_verified_releases SET artifact_root='changed'"),/immutable_bok_release/)
 }finally{f.sqlite.close()}
})
test('draft changes or authority revoked immediately before SQL commit deny activation',async()=>{
 for(const mutation of ["UPDATE bok_text_drafts SET revision=2","UPDATE bok_text_drafts SET text='race'","UPDATE account_devices SET revoked_at=CURRENT_TIMESTAMP","DELETE FROM account_access_sessions","UPDATE account_access_sessions SET expires_at=0","DELETE FROM account_capabilities","UPDATE accounts SET role='admin'","INSERT INTO account_blocks VALUES('editor',1,'test',1,'operation','editor',CURRENT_TIMESTAMP)"]){
 const f=setup();try{f.sqlite.exec(mutation);assert.equal(await f.activate(),false,mutation);assert.equal(await readActiveBokRelease(f.db),null);assert.equal(f.sqlite.prepare('SELECT count(*) n FROM bok_release_activation_events').get().n,0)}finally{f.sqlite.close()}
 }
})
test('audit failure rolls back pointer and disabled feature never writes',async()=>{
 const f=setup();try{
 f.context.env.BOK_RELEASE_ACTIVATION_ENABLED='0';await assert.rejects(f.activate(),/disabled/)
 f.context.env.BOK_RELEASE_ACTIVATION_ENABLED='1';f.sqlite.exec("CREATE TRIGGER fail_event BEFORE INSERT ON bok_release_activation_events BEGIN SELECT RAISE(ABORT,'test_audit_failure'); END")
 await assert.rejects(f.activate(),/test_audit_failure/);assert.equal(await readActiveBokRelease(f.db),null)
 }finally{f.sqlite.close()}
})
