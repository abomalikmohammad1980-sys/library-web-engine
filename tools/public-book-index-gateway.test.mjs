import {test} from 'node:test'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {readdirSync,readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {queryPublicBooks} from '../alpha-publish/functions/api/search/public-books.js'
import {onRequest,validateExtraction} from '../alpha-publish/functions/api/internal/public-book-index.js'
import {readVerifiedPublicBookIndex} from '../alpha-publish/functions/api/_public-book-index-read.js'
import {drainPublicBookIndex,ingestionGateway,ingestionRuntimeConfig,ingestionExitCode} from './public-book-index-runner.mjs'
function fixture(mime='text/plain'){
 const sql=new DatabaseSync(':memory:');sql.exec('PRAGMA foreign_keys=ON')
 const dir=new URL('../alpha-publish/migrations/',import.meta.url)
 for(const name of readdirSync(dir).filter(x=>x.endsWith('.sql')).sort())sql.exec(readFileSync(new URL(name,dir),'utf8'))
 sql.exec("INSERT INTO accounts(subject,email,role) VALUES('owner','isolated@example.test','super-admin')")
 const bytes=Buffer.from('عنوان\n\nمتن'),objects=new Map([['private/a',bytes]])
 sql.prepare("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('a','owner','عنوان','مؤلف','private/a',?,?,'public','approved')").run(mime,bytes.length)
 const db={prepare(query){let args=[];return{bind(...v){args=v;return this},async first(){return sql.prepare(query).get(...args)??null},async all(){return{results:sql.prepare(query).all(...args)}},async run(){const before=sql.prepare('SELECT total_changes() n').get().n;sql.prepare(query).run(...args);return{meta:{changes:Number(sql.prepare('SELECT total_changes() n').get().n-before)}}}}}}
 db.batch=async statements=>{sql.exec('BEGIN');try{const results=[];for(const statement of statements)results.push(await statement.run());sql.exec('COMMIT');return results}catch(error){sql.exec('ROLLBACK');throw error}}
 const bucket={get:async key=>{const b=objects.get(key);return b?{size:b.length,body:new Blob([b]).stream()}:null},put:async(key,b)=>objects.set(key,Buffer.from(b))}
 const env={VISITORS_DB:db,LIBRARY_R2:bucket,PUBLIC_BOOK_INGESTION_ENABLED:'true',PUBLIC_BOOK_INDEX_RUNNER_TOKEN:'a'.repeat(48)}
 const fetcher=async(url,init)=>onRequest({env,request:new Request(url,init)})
 const gateway=ingestionGateway({token:env.PUBLIC_BOOK_INDEX_RUNNER_TOKEN},fetcher)
 return {sql,env,objects,bucket,gateway,fetcher}
}

for(const scanned of [true,false])test(`PDF bookmarks only, verified ${scanned?'scanned':'text'} classification, obsolete flag cannot enable body`,async()=>{
 const require=createRequire(new URL('../app/package.json',import.meta.url)),{PDFDocument,PDFName,PDFString}=require('pdf-lib')
 const pdf=await PDFDocument.create(),page=pdf.addPage();if(!scanned)page.drawText('BODY_MUST_NEVER_BE_INDEXED_EVEN_WITH_OLD_FLAG')
 const outline=pdf.context.obj({Type:'Outlines'}),root=pdf.context.register(outline)
 const item=pdf.context.register(pdf.context.obj({Title:PDFString.of('BOOKMARK_SEARCHABLE'),Parent:root,Dest:[page.ref,PDFName.of('Fit')]}))
 outline.set(PDFName.of('First'),item);outline.set(PDFName.of('Last'),item);outline.set(PDFName.of('Count'),pdf.context.obj(1));pdf.catalog.set(PDFName.of('Outlines'),root)
 const bytes=await pdf.save(),f=fixture('application/pdf')
 try{
  f.objects.set('private/a',Buffer.from(bytes));f.sql.prepare("UPDATE user_books SET byte_length=? WHERE id='a'").run(bytes.length);f.env.PDF_TEXT_INDEXING='true'
  assert.deepEqual(await drainPublicBookIndex({gateway:f.gateway}),{claimed:1,ready:1,failed:0})
  const out=await readVerifiedPublicBookIndex(f.env,'a');assert.equal(out.coverageMode,'pdf-bookmarks-only');assert.deepEqual(out.rows,[]);assert.equal(out.pdfClassification.kind,scanned?'scanned':'text')
  const state=f.sql.prepare("SELECT * FROM books_index_state WHERE book_id='a'").get();assert.equal(state.status,scanned?'ocr_pending':'ready');assert.ok(state.indexed_at);assert.equal(state.ocr,0);assert.equal(state.toc_source,'pdf_bookmarks')
  assert.equal(f.sql.prepare("SELECT state FROM public_book_index_jobs WHERE book_id='a'").get().state,'ready')
  assert.equal((await(await queryPublicBooks(f.env.VISITORS_DB,new URLSearchParams({q:'BODY_MUST',field:'body'}),f.env)).json()).totalDocuments,0)
  assert.equal((await(await queryPublicBooks(f.env.VISITORS_DB,new URLSearchParams({q:'BOOKMARK_SEARCHABLE',field:'body'}),f.env)).json()).totalDocuments,1)
  f.sql.exec("UPDATE user_books SET title='updated' WHERE id='a'")
  assert.equal(f.sql.prepare("SELECT status FROM books_index_state WHERE book_id='a'").get().status,'queued');assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
 }finally{f.sql.close()}
})
test('native PDF intermediate remains rejected even with obsolete enable flag',()=>{
 assert.throws(()=>validateExtraction({contract:'public-book-pdf-extraction/2',coverageMode:'pdf-native-text',rows:[{text:'body',pageIndex:0}],headings:[]},'application/pdf',{PDF_TEXT_INDEXING:'true'}),/invalid_extraction/)
})
test('targeted Queue claims never fall back to another book and stop after five extraction attempts',async()=>{
 const f=fixture();f.env.PUBLIC_BOOK_TARGETED_ONLY='true'
 try{
  f.sql.exec("INSERT INTO user_books(id,owner_subject,title,author,object_key,mime_type,byte_length,visibility,review_status) VALUES('b','owner','other','author','private/b','text/plain',1,'public','approved')")
  const version=f.sql.prepare("SELECT content_version FROM public_book_event_state WHERE book_id='a'").get().content_version,target={bookId:'a',contentVersion:version}
  await assert.rejects(()=>f.gateway({op:'claim'}))
  assert.deepEqual(await f.gateway({op:'claim',target:{bookId:'missing',contentVersion:1}}),{job:null})
  assert.deepEqual(await f.gateway({op:'claim',target:{...target,contentVersion:version+1}}),{job:null})
  for(let i=1;i<=5;i++){
   const result=await drainPublicBookIndex({gateway:f.gateway,target,maxJobs:20,extract:async()=>{throw Error('source_parse_failed')}})
   assert.deepEqual(result,{claimed:1,ready:0,failed:1})
   const row=f.sql.prepare("SELECT state,attempts FROM public_book_index_jobs WHERE book_id='a'").get();assert.equal(row.state,'failed');assert.equal(row.attempts,i)
  }
  assert.deepEqual(await drainPublicBookIndex({gateway:f.gateway,target}),{claimed:0,ready:0,failed:0})
  assert.equal(f.sql.prepare("SELECT attempts FROM public_book_index_jobs WHERE book_id='b'").get().attempts,0)
 }finally{f.sql.close()}
})
test('targeted runner completes only the requested version and fences same-generation event supersession',async()=>{
 for(const supersede of [false,true]){
  const f=fixture();f.env.PUBLIC_BOOK_TARGETED_ONLY='true'
  try{
   const target={bookId:'a',contentVersion:f.sql.prepare("SELECT content_version FROM public_book_event_state WHERE book_id='a'").get().content_version}
   if(supersede){const put=f.bucket.put;f.bucket.put=async(...args)=>{await put(...args);f.sql.exec("UPDATE public_book_event_state SET content_version=content_version+1 WHERE book_id='a'")}}
   const result=await drainPublicBookIndex({gateway:f.gateway,target});assert.equal(result.ready,supersede?0:1)
   if(supersede)assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
  }finally{f.sql.close()}
 }
 const base={PUBLIC_BOOK_INGESTION_ENABLED:'true',PUBLIC_BOOK_INGESTION_ACCEPTED:'true',PUBLIC_BOOK_INDEX_RUNNER_TOKEN:'a'.repeat(48)}
 assert.throws(()=>ingestionRuntimeConfig({...base,PUBLIC_BOOK_TARGET_ID:'a'}),/invalid_index_target/)
 assert.deepEqual(ingestionRuntimeConfig({...base,PUBLIC_BOOK_TARGET_ID:'a',PUBLIC_BOOK_TARGET_VERSION:'3'}).target,{bookId:'a',contentVersion:3})
})

test('dedicated gateway token is fail closed and cannot run arbitrary SQL/object reads',async()=>{
 const f=fixture();try{
  for(const token of ['', 'b'.repeat(48)])assert.equal((await f.fetcher('https://khzanah.com/api/internal/public-book-index',{method:'POST',headers:{Authorization:`Bearer ${token}`},body:'{"op":"claim"}'})).status,404)
  await assert.rejects(()=>f.gateway({op:'sql',sql:'DELETE FROM user_books'}))
  await assert.rejects(()=>f.gateway({op:'claim',object_key:'private/secret'}))
  assert.equal(f.sql.prepare('SELECT COUNT(*) n FROM user_books').get().n,1)
  delete f.env.PUBLIC_BOOK_INGESTION_ENABLED
  await assert.rejects(()=>f.gateway({op:'claim'}))
 }finally{f.sql.close()}
})
test('actual Node worker through gateway activates verified text consumed by safe reader',async()=>{
 const f=fixture();try{
  assert.deepEqual(await drainPublicBookIndex({gateway:f.gateway}),{claimed:1,ready:1,failed:0})
  const artifact=await readVerifiedPublicBookIndex(f.env,'a');assert.deepEqual(artifact.rows.map(r=>r.text),['عنوان','متن'])
  const search=f.sql.prepare("SELECT * FROM public_book_search_receipts WHERE book_id='a'").get()
  assert.equal(search.row_count,4);assert.equal(search.manifest_sha256,f.sql.prepare("SELECT manifest_sha256 FROM public_book_index_jobs WHERE book_id='a'").get().manifest_sha256)
  assert.equal(artifact.author,'مؤلف');assert.ok(!JSON.stringify(artifact).includes('private/'))
  f.sql.exec("INSERT INTO central_book_overrides(book_id,visibility,updated_by) VALUES('central-submission:a','hidden','owner')")
  assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
 }finally{f.sql.close()}
})
test('withdrawal and forged leases never expose source or activate stale extraction',async()=>{
 const f=fixture();try{
  const {job}=await f.gateway({op:'claim'});assert.ok(!JSON.stringify(job).includes('private/'))
  await assert.rejects(()=>f.gateway({op:'source',lease:{...job,lease_token:'forged_lease_token'}}))
  f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='a'")
  await assert.rejects(()=>f.gateway({op:'source',lease:job}))
  await assert.rejects(()=>f.gateway({op:'complete',lease:job,extracted:{rows:[],headings:[],coverageMode:'text-and-headings'}}))
 }finally{f.sql.close()}
})
test('PDF schema rejects body text and preserves real Markdown/BOK anchors',()=>{
 assert.throws(()=>validateExtraction({coverageMode:'pdf-bookmarks-only',rows:[{text:'secret'}],headings:[]},'application/pdf'))
 const out=validateExtraction({coverageMode:'text-and-headings',rows:[],headings:[{value:'عنوان',bookmark:'heading-1',pageLabel:'١',partLabel:'أ',pageIndex:0,object_key:'private/x'}]},'text/markdown')
 assert.deepEqual(out.headings,[{value:'عنوان',pageIndex:0,bookmark:'heading-1',pageLabel:'١',partLabel:'أ'}])
})
test('artifact corruption and same-key source change never become reader-visible',async()=>{
 const f=fixture();try{
  const put=f.bucket.put;f.bucket.put=async(...args)=>{await put(...args);f.objects.set('private/a',Buffer.from('tampered'))}
  assert.deepEqual(await drainPublicBookIndex({gateway:f.gateway,maxJobs:1}),{claimed:1,ready:0,failed:1})
  assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
 }finally{f.sql.close()}
})
test('failed search staging cannot activate even when immutable artifact exists',async()=>{
 const f=fixture();try{
  const prepare=f.env.VISITORS_DB.prepare
  f.env.VISITORS_DB.prepare=query=>{if(query.includes('INSERT INTO public_book_search_rows'))throw Error('isolated_search_failure');return prepare(query)}
  assert.deepEqual(await drainPublicBookIndex({gateway:f.gateway,maxJobs:1}),{claimed:1,ready:0,failed:1})
  assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
  assert.equal(f.sql.prepare("SELECT COUNT(*) n FROM public_book_search_receipts WHERE book_id='a'").get().n,0)
 }finally{f.sql.close()}
})
test('large extraction resumes staged search writes without repeating extraction',async()=>{
 const f=fixture();try{
  let extracts=0,completes=0
  const gateway=async(...args)=>{if(args[0].op==='complete')completes++;return f.gateway(...args)}
  const extract=async()=>{extracts++;return{coverageMode:'text-and-headings',headings:[],rows:Array.from({length:1300},(_,paragraphIndex)=>({text:`نص ${paragraphIndex}`,paragraphIndex}))}}
  assert.deepEqual(await drainPublicBookIndex({gateway,extract}),{claimed:1,ready:1,failed:0})
  assert.equal(extracts,1);assert.equal(completes,2)
  assert.equal(f.sql.prepare("SELECT row_count FROM public_book_search_receipts WHERE book_id='a'").get().row_count,1302)
 }finally{f.sql.close()}
})
test('consumer rejects corrupt or pending artifact and rechecks withdrawal during read',async()=>{
 const f=fixture();try{
  assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
  await drainPublicBookIndex({gateway:f.gateway})
  const key=f.sql.prepare("SELECT artifact_key FROM public_book_index_jobs WHERE book_id='a'").get().artifact_key
  const valid=f.objects.get(key);f.objects.set(key,Buffer.from('{}'));assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null);f.objects.set(key,valid)
  const get=f.bucket.get;f.bucket.get=async k=>{const out=await get(k);f.sql.exec("UPDATE user_books SET visibility='private' WHERE id='a'");return out}
  assert.equal(await readVerifiedPublicBookIndex(f.env,'a'),null)
 }finally{f.sql.close()}
})
test('runner requires both acceptance gates and only one secret; maxJobs bounds drain',async()=>{
 assert.equal(ingestionExitCode({failed:1}),2);assert.equal(ingestionExitCode({failed:0}),0)
 assert.throws(()=>ingestionRuntimeConfig({}),/not_accepted/)
 assert.throws(()=>ingestionRuntimeConfig({PUBLIC_BOOK_INGESTION_ENABLED:'true',PUBLIC_BOOK_INGESTION_ACCEPTED:'true'}),/credentials_missing/)
 assert.deepEqual(ingestionRuntimeConfig({PUBLIC_BOOK_INGESTION_ENABLED:'true',PUBLIC_BOOK_INGESTION_ACCEPTED:'true',PUBLIC_BOOK_INDEX_RUNNER_TOKEN:'a'.repeat(48)}),{token:'a'.repeat(48),origin:'https://khzanah.com'})
 assert.throws(()=>ingestionGateway({token:'a'.repeat(48),origin:'https://untrusted.invalid'}),/origin_forbidden/)
 let calls=0;assert.deepEqual(await drainPublicBookIndex({maxJobs:2,gateway:async()=>{calls++;return{skipped:true}}}),{claimed:2,ready:0,failed:2});assert.equal(calls,2)
 await assert.rejects(()=>drainPublicBookIndex({maxJobs:100}),/bound_invalid/)
})
test('gateway diagnostics expose only operation, status and allowlisted code',async()=>{
 for(const [body,expected] of [
  ['{"error":"ingestion_search_failed","sql":"PRIVATE SQL","token":"SECRET"}','gateway_complete_422_ingestion_search_failed'],
  ['{"error":"PRIVATE SQL SECRET"}','gateway_complete_422_unknown'],
  ['x'.repeat(5000),'gateway_complete_422_unknown'],
 ]){
  const gateway=ingestionGateway({token:'a'.repeat(48)},async()=>new Response(body,{status:422}))
  await assert.rejects(()=>gateway({op:'complete'}),error=>error.message===expected)
 }
 const f=fixture();try{
  f.env.PUBLIC_BOOK_INDEX_DIAGNOSTICS='true'
  f.bucket.get=async()=>{throw Error('PRIVATE SQL AND TOKEN')}
  const {job}=await f.gateway({op:'claim'})
  await assert.rejects(()=>f.gateway({op:'source',lease:job}),/gateway_source_422_ingestion_source_failed/)
 }finally{f.sql.close()}
})
