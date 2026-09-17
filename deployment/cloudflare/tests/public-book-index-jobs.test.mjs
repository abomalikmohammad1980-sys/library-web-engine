import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync} from 'node:fs'
import {claimPublicBookIndex as claim,checkpointPublicBookIndex as checkpoint,failPublicBookIndex as fail,activatePublicBookIndex as activate,readPublicBookIndexReceipt as read} from '../functions/api/_public-book-index-jobs.js'
function fixture(){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 for(const name of ['0002_accounts_and_private_books','0004_central_book_overrides','0009_account_book_deletion','0018_central_authors','0019_book_intake_metadata','0027_word_book_bundles','0032_bok_release_pointer'])sql.exec(readFileSync(new URL(`../migrations/${name}.sql`,import.meta.url),'utf8'))
 sql.exec("INSERT INTO accounts(subject,email) VALUES('owner','fixture@example.test')")
 const book=(id='book',pub=true,mime='text/plain')=>sql.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES(?,'owner',?,'author',?,?,10,?,?)").run(id,id,'private/'+id,mime,pub?'public':'private',pub?'approved':'pending')
 book('existing');sql.exec(readFileSync(new URL('../migrations/0033_public_book_index_jobs.sql',import.meta.url),'utf8'))
 const db={prepare(query){let args=[];return{bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)??null},async run(){return{meta:{changes:Number(sql.prepare(query).run(...args).changes)}}}}}}
 const job=()=>sql.prepare("SELECT * FROM public_book_index_jobs WHERE book_id='existing'").get()
 return {sql,db,book,job}
}
const lease={token:'worker_token_0001',now:100,leaseSeconds:60}
const receipt={manifestSha256:'a'.repeat(64),sourceSha256:'b'.repeat(64),artifactKey:`public-book-index/v1/${'a'.repeat(64)}.json`,parserVersion:'verified-test-v1',coverageMode:'text-and-headings',complete:true,checkpoint:2}
test('lifecycle guards prove fenced RETURNING row despite inflated D1 trigger changes',async()=>{
 const f=fixture();try{
  f.sql.exec('CREATE TABLE audit_count(n INTEGER); INSERT INTO audit_count VALUES(0); CREATE TRIGGER count_job_update AFTER UPDATE ON public_book_index_jobs BEGIN UPDATE audit_count SET n=n+1; END;')
  const prepare=f.db.prepare
  f.db.prepare=query=>{const statement=prepare(query),run=statement.run;statement.run=async()=>{const result=await run();result.meta.changes+=100;return result};return statement}
  const j=await claim(f.db,lease);assert.equal(await checkpoint(f.db,j,101,2),true);assert.equal(await activate(f.db,j,102,receipt),true)
  assert.equal(await checkpoint(f.db,j,103,3),false);assert.equal(await fail(f.db,j,103,'stale_worker'),false)
  assert.ok(f.sql.prepare('SELECT n FROM audit_count').get().n>=3)
 }finally{f.sql.close()}
})
test('active edited BOK release excludes original text without churning unrelated books',async()=>{
 const f=fixture();try{
  f.book('unrelated');const j=await claim(f.db,lease);await checkpoint(f.db,j,101,2);await activate(f.db,j,102,receipt)
  f.sql.prepare('INSERT INTO bok_verified_releases(release_id,candidate_sha256,book_id,source_hash,reader_manifest_sha256,search_manifest_sha256,artifact_root,reviews_json,cloud_receipt_sha256) VALUES(?,?,?,?,?,?,?,?,?)').run('release','a'.repeat(64),'central-submission:existing','b'.repeat(64),'c'.repeat(64),'d'.repeat(64),'test','[]','e'.repeat(64))
  f.sql.exec("INSERT INTO bok_release_pointer(scope,release_id,generation,updated_by) VALUES('library','release',1,'owner')")
  assert.equal(await read(f.db,'existing'),null);assert.equal(f.job().state,'cancelled')
  assert.equal(f.sql.prepare("SELECT generation FROM public_book_index_jobs WHERE book_id='unrelated'").get().generation,1)
  f.sql.exec("DELETE FROM bok_release_pointer WHERE scope='library'")
  assert.equal(f.job().state,'queued');assert.equal(await read(f.db,'existing'),null)
 }finally{f.sql.close()}
})
test('actual migration backfills and automatically queues published books, not private/pending',async()=>{
 const f=fixture();try{assert.equal(f.job().state,'queued');f.book('private',false);assert.equal(f.sql.prepare("SELECT state FROM public_book_index_jobs WHERE book_id='private'").get().state,'cancelled');const j=await claim(f.db,lease);assert.equal(j.book_id,'existing');assert.equal(await claim(f.db,{...lease,token:'worker_token_0002'}),null);assert.equal(await read(f.db,'existing'),null)}finally{f.sql.close()}
})
test('expired lease takeover fences previous worker; checkpoints are monotone',async()=>{
 const f=fixture();try{const a=await claim(f.db,lease);assert.equal(await checkpoint(f.db,a,101,1),true);assert.equal(await claim(f.db,{...lease,now:159}),null);const b=await claim(f.db,{...lease,token:'worker_token_0002',now:160});assert.equal(b.checkpoint,1);assert.equal(await checkpoint(f.db,a,161,2),false);assert.equal(await checkpoint(f.db,b,161,0),false);assert.equal(await checkpoint(f.db,b,161,2),true);assert.equal(await activate(f.db,b,162,receipt),true);assert.equal((await read(f.db,'existing')).generation,1)}finally{f.sql.close()}
})
test('retry records error and backoff; permanent failure cannot masquerade as ready',async()=>{
 const f=fixture();try{const j=await claim(f.db,lease);assert.equal(await fail(f.db,j,101,'storage_unavailable'),true);assert.equal(f.job().state,'queued');assert.equal(await claim(f.db,{...lease,now:102}),null);const next=await claim(f.db,{...lease,now:161});assert.equal(next.attempts,2);assert.equal(await fail(f.db,next,162,'unsupported_source',{permanent:true}),true);assert.equal(f.job().state,'failed');assert.equal(await read(f.db,'existing'),null);f.sql.exec("UPDATE user_books SET object_key='private/replaced' WHERE id='existing'");assert.equal(f.job().state,'queued');assert.equal(f.job().attempts,0)}finally{f.sql.close()}
})
for(const mutation of ["visibility='private'","review_status='rejected'","deleted_at='now'","object_key='private/new-source'","title='new-title'"]){
 test(`source/publication change fences pending activation: ${mutation}`,async()=>{
 const f=fixture();try{const j=await claim(f.db,lease);await checkpoint(f.db,j,101,2);f.sql.exec(`UPDATE user_books SET ${mutation} WHERE id='existing'`);assert.equal(await activate(f.db,j,102,receipt),false);assert.equal(await read(f.db,'existing'),null);assert.equal(f.job().generation,2)}finally{f.sql.close()}
 })
}
test('withdrawal immediately hides ready artifact, including central override and restore',async()=>{
 const f=fixture();try{const j=await claim(f.db,lease);await checkpoint(f.db,j,101,2);await activate(f.db,j,102,receipt);assert.ok(await read(f.db,'existing'));f.sql.exec("INSERT INTO central_book_overrides(book_id,visibility,updated_by) VALUES('existing','hidden','owner')");assert.equal(await read(f.db,'existing'),null);assert.equal(f.job().state,'cancelled');f.sql.exec("UPDATE central_book_overrides SET visibility='public' WHERE book_id='existing'");assert.equal(f.job().state,'queued');assert.equal(await read(f.db,'existing'),null)}finally{f.sql.close()}
})
test('irrelevant updates do not churn index generations; source volumes and TOCs do',()=>{
 const f=fixture();try{f.sql.exec("UPDATE user_books SET updated_at='later',review_note='review comment' WHERE id='existing'");assert.equal(f.job().generation,1);f.sql.prepare('INSERT INTO user_book_metadata(book_id,metadata_json,storage_bytes) VALUES(?,?,1)').run('existing','{"schemaVersion":1,"description":"one"}');const n=f.job().generation;f.sql.prepare('UPDATE user_book_metadata SET metadata_json=? WHERE book_id=?').run('{"schemaVersion":1,"description":"two"}','existing');assert.equal(f.job().generation,n);f.sql.prepare('UPDATE user_book_metadata SET metadata_json=? WHERE book_id=?').run('{"schemaVersion":1,"tags":[{"name":"chapter","source":"toc"}]}','existing');assert.equal(f.job().generation,n+1);for(const kind of ['cover','pdf','volume'])f.sql.prepare('INSERT INTO user_book_assets VALUES(?,?,?,?,?,?,?,?,?)').run(kind,'existing',kind,null,'private/'+kind,kind,'text/plain',5,'a'.repeat(64));assert.equal(f.job().generation,n+2)}finally{f.sql.close()}
})
test('PDF receipts accept only bookmark coverage, never OCR/body; safe public projection',async()=>{
 const f=fixture();try{f.sql.exec("UPDATE user_books SET mime_type='application/pdf' WHERE id='existing'");const j=await claim(f.db,lease);assert.equal(j.requiredCoverage,'pdf-bookmarks-only');await checkpoint(f.db,j,101,2);assert.equal(await activate(f.db,j,102,receipt),false);assert.equal(await activate(f.db,j,102,{...receipt,coverageMode:'pdf-bookmarks-only'}),true);const out=await read(f.db,'existing');assert.deepEqual(Object.keys(out).sort(),['artifact_key','coverage_mode','generation','manifest_sha256','parser_version']);assert.ok(!JSON.stringify(out).includes('private/'))}finally{f.sql.close()}
})
test('partial or malformed receipt rejected; hard deletion cascades',async()=>{
 const f=fixture();try{const j=await claim(f.db,lease);await assert.rejects(()=>activate(f.db,j,101,{...receipt,complete:false}),/invalid_index_receipt/);assert.equal(await activate(f.db,j,101,receipt),false);f.sql.exec("DELETE FROM user_books WHERE id='existing'");assert.equal(f.job(),undefined);assert.equal(await read(f.db,'existing'),null)}finally{f.sql.close()}
})
test('crashed final lease becomes explicit failed instead of running forever',async()=>{
 const f=fixture();try{await claim(f.db,lease);f.sql.exec("UPDATE public_book_index_jobs SET attempts=8 WHERE book_id='existing'");assert.equal(await claim(f.db,{...lease,now:160}),null);assert.equal(f.job().state,'failed');assert.equal(f.job().error_code,'lease_retries_exhausted');assert.throws(()=>f.sql.exec("UPDATE public_book_index_jobs SET state='ready',artifact_key='x',parser_version='x',coverage_mode='text-and-headings' WHERE book_id='existing'"),/CHECK constraint/)}finally{f.sql.close()}
})
for(const prefix of ['central-submission:','account-book:'])test('legacy override alias hides canonical ready artifact and fences restore: '+prefix,async()=>{
 const f=fixture();try{const j=await claim(f.db,lease);await checkpoint(f.db,j,101,2);await activate(f.db,j,102,receipt);assert.ok(await read(f.db,'existing'));f.sql.prepare("INSERT INTO central_book_overrides(book_id,visibility,updated_by) VALUES(?,'hidden','owner')").run(prefix+'existing');assert.equal(await read(f.db,'existing'),null);assert.equal(f.job().state,'cancelled');assert.equal(f.job().generation,2);f.sql.prepare("UPDATE central_book_overrides SET visibility='public' WHERE book_id=?").run(prefix+'existing');assert.equal(f.job().generation,3);assert.equal(f.job().state,'queued');assert.equal(await read(f.db,'existing'),null)}finally{f.sql.close()}
})
