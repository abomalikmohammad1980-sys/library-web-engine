// OPERATOR-RUN ONLY: isolated synthetic fixture mutations, real authentication.
// Cookies are random, memory-only, never printed or written. SQL carries hashes only.
import assert from 'node:assert/strict'
import {randomBytes,createHash} from 'node:crypto'
import {spawnSync} from 'node:child_process'
import {readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'..'),alpha=resolve(root,'alpha-publish')
const origin='https://khizana-bok-acceptance-20260917.pages.dev',book='00000000-codex-ingestion-acceptance',owner='codex-ingestion-acceptance'
const config=resolve(root,'.artifacts/stage-b-cloud-acceptance-20260917/wrangler.jsonc')
if(process.argv.length!==3||process.argv[2]!=='--run-isolated-fixture')throw Error('explicit_isolated_fixture_run_required')
if(process.env.PUBLIC_BOOK_INDEX_GATEWAY_ORIGIN!==origin)throw Error('isolated_origin_required')
const cfg=JSON.parse(await readFile(config,'utf8'))
assert.equal(cfg.name,'khizana-bok-acceptance-20260917')
assert.deepEqual(cfg.d1_databases.map(x=>x.database_id),['9133fe99-c4e1-4a1e-84f3-127735883279'])
assert.equal(cfg.vars.INDEXNOW_ENABLED,'false');assert.equal(cfg.vars.PUBLIC_BOOK_TARGETED_ONLY,'true')
function sql(command){
 const run=spawnSync(process.execPath,[resolve(alpha,'node_modules/wrangler/bin/wrangler.js'),'d1','execute','VISITORS_DB','--config',config,'--remote','--command',command,'--json'],{
  cwd:alpha,encoding:'utf8',timeout:60000,maxBuffer:2*1024*1024,
  env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'db956e5187111b69e796e4a8e4c3fe36',WRANGLER_LOG_PATH:'D:/alkhizana/.wrangler-logs'}
 })
 // Do not surface raw CLI logs, SQL, credentials or response bodies on errors.
 if(run.status!==0)throw Error('isolated_database_operation_failed')
 let result;try{result=JSON.parse(run.stdout)}catch{throw Error('isolated_database_response_invalid')}
 if(!Array.isArray(result)||result.some(x=>!x.success))throw Error('isolated_database_operation_rejected')
 return result.at(-1)?.results??[]
}
for(const [table,required] of Object.entries({
 user_books:['id','owner_subject','review_version','author','category','visibility','deleted_at','reviewed_by','review_note'],
 book_review_events:['book_id','reviewer_subject','decision','note','review_version'],
 accounts:['subject','email','display_name','role'],
 account_devices:['owner_subject','device_id','label','platform','revoked_at'],
 account_access_sessions:['token_hash','subject','device_id','expires_at'],
 account_blocks:['subject','blocked'],
 public_book_actions_dispatches:['book_id','content_version','run_id'],
 books_index_state:['book_id','indexed_at','status']
})){
 const columns=new Set(sql(`PRAGMA table_info(${table})`).map(row=>row.name))
 if(required.some(name=>!columns.has(name)))throw Error('isolated_schema_prerequisite_missing:'+table)
}
const initial=sql(`SELECT b.id,b.owner_subject,b.review_version,b.author,b.category,b.visibility,a.role FROM user_books b JOIN accounts a ON a.subject=b.owner_subject WHERE b.id='${book}' AND b.owner_subject='${owner}' AND b.deleted_at IS NULL`)[0]
assert.ok(initial,'synthetic fixture missing');assert.equal(initial.role,'super-admin');assert.equal(initial.visibility,'public')
const token=randomBytes(32).toString('hex'),device=randomBytes(32).toString('hex'),hash=x=>createHash('sha256').update(x).digest('hex')
const tokenHash=hash(token),deviceHash=hash(device),expiry=Math.floor(Date.now()/1000)+1800
const cookie=`__Host-khizana-access-session=${token}; __Host-khizana-device=${device}`
async function request(path,{method='GET',body,authenticated=false,status=200}={}){
 const response=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...(authenticated?{Cookie:cookie,Origin:origin,'x-alkhizana-request':'account-ui'}:{}),...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})})
 assert.equal(response.status,status,`${method} isolated endpoint status`)
 assert.match(response.headers.get('cache-control')??'',/no-store/)
 return response
}
const reviewPath='/api/admin/book-submissions/'+book
async function searchCount(){const value=await(await request('/api/search/public-books?'+new URLSearchParams({q:'acceptance',field:'body',mode:'exact',book,limit:'100'}))).json();assert.equal(value.contract,'public-book-search/1');return value.totalDocuments}
let sessionCreated=false
try{
 sql(`INSERT INTO account_devices(owner_subject,device_id,label,platform) VALUES('${owner}','${deviceHash}','Stage B isolated short-lived verification','test'); INSERT INTO account_access_sessions(token_hash,subject,device_id,expires_at) VALUES('${tokenHash}','${owner}','${deviceHash}',${expiry});`)
 sessionCreated=true
 // This existing admin mutation genuinely commits new public metadata and calls waitUntil wake.
 const title='Isolated Stage B acceptance '+Date.now()
 const edited=await(await request(reviewPath,{method:'PATCH',authenticated:true,body:{decision:'publish',reviewVersion:initial.review_version,metadata:{title,author:initial.author,category:initial.category??''}}})).json()
 assert.equal(edited.visibility,'public');assert.equal(edited.reviewVersion,initial.review_version+1)
 const event=sql(`SELECT content_version,index_generation FROM public_book_event_state WHERE book_id='${book}' AND visibility='public'`)[0]
 assert.ok(event)
 console.log(JSON.stringify({phase:'authenticated-public-edit-committed',book,contentVersion:event.content_version}))
 // Observe exact version only. No CLI/global ingestion and no manual dispatch bypass.
 let proof,deadline=Date.now()+12*60*1000
 while(Date.now()<deadline){
  proof=sql(`SELECT j.state,j.generation,q.state AS queue_state,a.run_id,a.state AS actions_state,r.generation AS search_generation,CASE WHEN r.manifest_sha256=j.manifest_sha256 THEN 1 ELSE 0 END AS matching_sha,p.status,p.indexed_at FROM public_book_event_state s JOIN public_book_index_jobs j ON j.book_id=s.book_id LEFT JOIN public_book_queue_receipts q ON q.book_id=s.book_id AND q.content_version=s.content_version LEFT JOIN public_book_actions_dispatches a ON a.book_id=s.book_id AND a.content_version=s.content_version LEFT JOIN public_book_search_receipts r ON r.book_id=s.book_id LEFT JOIN books_index_state p ON p.book_id=s.book_id WHERE s.book_id='${book}' AND s.content_version=${event.content_version} AND s.visibility='public'`)[0]
  if(proof?.state==='ready'&&proof.queue_state==='ready'&&proof.generation===event.index_generation&&proof.search_generation===proof.generation&&proof.matching_sha===1&&proof.indexed_at&&proof.run_id)break
  if(proof?.queue_state==='failed')throw Error('isolated_queue_failed')
  await new Promise(r=>setTimeout(r,15000))
 }
 assert.equal(proof?.state,'ready');assert.equal(proof?.queue_state,'ready');assert.equal(proof?.generation,event.index_generation);assert.equal(proof?.search_generation,event.index_generation);assert.equal(proof?.matching_sha,1);assert.ok(proof?.run_id);assert.ok(proof?.indexed_at)
 assert.equal(await searchCount(),2)
 const html=await(await request('/books/public/'+book)).text();assert.ok(html.includes(title));assert.equal((html.match(/<h1(?:\s|>)/gi)??[]).length,1)
 assert.ok((await(await request('/sitemap-public.xml')).text()).includes('/books/public/'+book))
 console.log(JSON.stringify({phase:'targeted-actions-and-consumers-ready',book,contentVersion:event.content_version,runId:proof.run_id}))
 // Withdrawal uses the real admin review path, not direct SQL or an auth bypass.
 const withdrawn=await(await request(reviewPath,{method:'PATCH',authenticated:true,body:{decision:'private',reviewVersion:edited.reviewVersion}})).json()
 assert.equal(withdrawn.visibility,'private')
 await request('/books/public/'+book,{status:410})
 assert.equal(await searchCount(),0)
 assert.ok(!(await(await request('/sitemap-public.xml')).text()).includes('/books/public/'+book))
 // Owner editing is allowed only AFTER withdrawal; no R2/source deletion is needed.
 const privateEdit=await(await request('/api/account/books/'+book,{method:'PATCH',authenticated:true,body:{title:'Isolated private acceptance',author:initial.author,category:initial.category??'',reviewVersion:withdrawn.reviewVersion}})).json()
 assert.equal(privateEdit.reviewStatus,'pending')
 await request('/books/public/'+book,{status:410});assert.equal(await searchCount(),0)
 console.log(JSON.stringify({phase:'withdrawal-immediately-private-and-owner-edit-verified',book,finalVisibility:'private',sourceDeleted:false}))
}finally{
 if(sessionCreated)sql(`DELETE FROM account_access_sessions WHERE token_hash='${tokenHash}' AND subject='${owner}'; DELETE FROM account_devices WHERE owner_subject='${owner}' AND device_id='${deviceHash}';`)
}
