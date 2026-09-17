import test from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readFileSync,readdirSync} from 'node:fs'
import {createActionsExtractor} from './worker.js'
function fixture(fetcher){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 const dir=new URL('../../migrations/',import.meta.url)
 for(const name of readdirSync(dir).filter(n=>n.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,dir),'utf8'))
 sql.exec("INSERT INTO accounts(subject,email) VALUES('owner','fixture@example.test');INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('book','owner','title','author','private/source','text/plain',10,'public','approved')")
 const db={prepare(query){let args=[];return{bind(...a){args=a;return this},async first(){return sql.prepare(query).get(...args)??null},async run(){return sql.prepare(query).run(...args)}}}}
 const env={VISITORS_DB:db,BOOK_INDEX_ACTIONS_ENABLED:'true',GITHUB_ACTIONS_TOKEN:'github_pat_'+'x'.repeat(30)}
 let time=100
 const handler=createActionsExtractor({fetcher,now:()=>time,nonce:()=> 'fixture_nonce_00001'})
 const call=(payload={bookId:'book',contentVersion:1,action:'upsert'},settings=env,url='https://extractor.internal/internal/public-book-extract')=>handler(new Request(url,{method:'POST',body:JSON.stringify(payload)}),settings)
 return{sql,env,call,time(value){time=value}}
}
test('disabled/broad-token/invalid/stale/private requests never reach GitHub',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw Error('must not call')});try{
  assert.equal((await f.call(undefined,{...f.env,BOOK_INDEX_ACTIONS_ENABLED:'false'})).status,503)
  assert.equal((await f.call(undefined,{...f.env,GITHUB_ACTIONS_TOKEN:'gho_broad_token'})).status,503)
  assert.equal((await f.call({bookId:'book',contentVersion:1,action:'upsert',repository:'evil'})).status,400)
  assert.equal((await f.call({bookId:'book',contentVersion:99,action:'upsert'})).status,409)
  assert.equal((await f.call(undefined,f.env,'https://public.test/internal/public-book-extract')).status,404)
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='book'")
  assert.equal((await f.call()).status,409);assert.equal(calls,0)
 }finally{f.sql.close()}
})
test('fixed repo/ref/version dispatch200 stores run identity and deduplicates active run',async()=>{
 const calls=[];const f=fixture(async(url,init)=>{
  calls.push({url,init})
  if(url.endsWith('/dispatches'))return Response.json({workflow_run_id:123})
  return Response.json({id:123,repository:{full_name:'abomalikmohammad1980-sys/library-web-engine'},status:'in_progress'})
 });try{
  assert.equal((await f.call()).status,202);assert.equal((await f.call()).status,202)
  assert.equal(calls.filter(c=>c.url.endsWith('/dispatches')).length,1)
  assert.equal(calls[0].url,'https://api.github.com/repos/abomalikmohammad1980-sys/library-web-engine/actions/workflows/public-book-ingestion-targeted.yml/dispatches')
  assert.equal(calls[0].init.headers['x-github-api-version'],'2026-03-10');assert.ok(calls.every(c=>c.init.redirect==='manual'))
  assert.deepEqual(JSON.parse(calls[0].init.body),{ref:'main',inputs:{book_id:'book',content_version:'1'}})
  assert.equal(f.sql.prepare('SELECT run_id FROM public_book_actions_dispatches').get().run_id,123)
 }finally{f.sql.close()}
})
test('legacy204 deduplicates, successful workflow without D1 receipt fails, deadlines are bounded',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;return new Response(null,{status:204})});try{
  assert.equal((await f.call()).status,202);assert.equal((await f.call()).status,202);assert.equal(calls,1)
  f.time(1901);assert.equal((await f.call()).status,502)
  assert.equal(f.sql.prepare('SELECT error_code FROM public_book_actions_dispatches').get().error_code,'run_without_ready_receipt')
  assert.equal((await f.call()).status,202);assert.equal(calls,2)
  f.time(10000);assert.equal((await f.call()).status,502)
  assert.equal(f.sql.prepare('SELECT error_code FROM public_book_actions_dispatches').get().error_code,'run_deadline_exceeded')
 }finally{f.sql.close()}
})
test('five bounded ambiguous network dispatch failures never fabricate ready or leak raw diagnostic',async()=>{
 let calls=0;const f=fixture(async()=>{calls++;throw Error('sensitive token value')});try{
  for(let i=0;i<5;i++){f.time(100+i*60);const r=await f.call();assert.equal(r.status,503);assert.doesNotMatch(await r.text(),/sensitive|github_pat/)}
  f.time(1000);assert.equal((await f.call()).status,502);assert.equal(calls,5)
  assert.equal(f.sql.prepare('SELECT state FROM public_book_index_jobs').get().state,'queued')
 }finally{f.sql.close()}
})
test('dispatch failures retain only numeric HTTP status, never response body or credential',async()=>{
 const f=fixture(async()=>new Response('sensitive token details',{status:403}));try{
  const response=await f.call();assert.equal(response.status,503)
  assert.doesNotMatch(await response.text(),/sensitive|token details/)
  assert.equal(f.sql.prepare('SELECT error_code FROM public_book_actions_dispatches').get().error_code,'dispatch_http_403')
 }finally{f.sql.close()}
})

test('redirect response is rejected without forwarding credentials or accepting a run',async()=>{
 let calls=0;const f=fixture(async(_url,init)=>{calls++;assert.equal(init.redirect,'manual');return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/'}})});try{
  assert.equal((await f.call()).status,503);assert.equal(calls,1)
  const row=f.sql.prepare('SELECT state,run_id,error_code FROM public_book_actions_dispatches').get()
  assert.equal(row.state,'failed');assert.equal(row.run_id,null);assert.equal(row.error_code,'dispatch_http_302')
 }finally{f.sql.close()}
})

test('new target workflow is manual-only, doubly gated, isolated origin and inputs never interpolated into commands',()=>{
 const yaml=readFileSync(new URL('../../../../.github/workflows/public-book-ingestion-targeted.yml',import.meta.url),'utf8')
 assert.match(yaml,/BOOK_INDEX_TARGETED_ACTIONS_ENABLED == 'true'/);assert.match(yaml,/PUBLIC_BOOK_INGESTION_ACCEPTED == 'true'/)
 assert.match(yaml,/PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN: https:\/\/khizana-bok-acceptance-20260917.pages.dev/)
 assert.doesNotMatch(yaml,/schedule:|pull_request|GITHUB_ACTIONS_TOKEN|CLOUDFLARE_API_TOKEN/)
 assert.doesNotMatch(yaml,/run:.*\$\{\{/)
 assert.match(yaml,/PUBLIC_BOOK_TARGET_ID: \$\{\{ inputs.book_id \}\}/)
})
