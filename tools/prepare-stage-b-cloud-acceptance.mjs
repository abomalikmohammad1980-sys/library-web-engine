// Local preparation only. Fixed isolated bindings; no credentials or remote operations.
import {mkdir,writeFile,copyFile,readFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createRequire} from 'node:module'
const repo=resolve(import.meta.dirname,'..'),output=resolve(repo,'.artifacts/stage-b-cloud-acceptance-20260917')
const require=createRequire(new URL('../alpha-publish/package.json',import.meta.url)),{build}=require('esbuild')
const project='khizana-bok-acceptance-20260917',database='9133fe99-c4e1-4a1e-84f3-127735883279'
const migrations=['0036_public_book_event_outbox.sql','0037_public_book_queue_receipts.sql','0038_public_book_indexnow.sql','0039_public_pdf_classification.sql','0040_public_book_metadata_aliases.sql','0041_public_book_actions_dispatch.sql']
await mkdir(resolve(output,'dist'),{recursive:true})
await writeFile(resolve(output,'wrangler.jsonc'),JSON.stringify({
 name:project,pages_build_output_dir:'./dist',compatibility_date:'2026-09-17',
 vars:{PUBLIC_BOOK_INGESTION_ENABLED:'true',PUBLIC_BOOK_SEARCH_ENABLED:'true',PUBLIC_BOOK_TARGETED_ONLY:'true',PUBLIC_BOOK_INDEX_EVENTS_ENABLED:'true',BOOK_INDEX_QUEUE_ENABLED:'true',INDEXNOW_ENABLED:'false',INDEXNOW_SUBMISSION_APPROVED:'false'},
 d1_databases:[{binding:'VISITORS_DB',database_name:project,database_id:database}],
 r2_buckets:[{binding:'LIBRARY_R2',bucket_name:'khizana-ingestion-acceptance-20260917'}],
 services:[{binding:'BOOK_INDEX_WAKE',service:'khizana-book-index-jobs-preview'}]
},null,2))
const input=`import {onRequest as gateway} from './alpha-publish/functions/api/internal/public-book-index.js';
import {onRequest as search} from './alpha-publish/functions/api/search/public-books.js';
import {onRequest as seo} from './alpha-publish/functions/_middleware.js';
import {onRequest as admin} from './alpha-publish/functions/api/admin/book-indexing.js';
import {onRequestPatch as review} from './alpha-publish/functions/api/admin/book-submissions/[bookId].js';
import {onRequestPatch,onRequestDelete} from './alpha-publish/functions/api/account/books/[bookId].js';
export default {async fetch(request,env,ctx){
 const path=new URL(request.url).pathname;
 const context={request,env,waitUntil:p=>ctx.waitUntil(p),next:()=>new Response('',{status:404})};
 let response;const owner=/^\\/api\\/account\\/books\\/([A-Za-z0-9_-]{1,200})$/.exec(path),submission=/^\\/api\\/admin\\/book-submissions\\/([A-Za-z0-9_-]{1,200})$/.exec(path);
 if(path==='/api/internal/public-book-index')response=await gateway(context);
 else if(path==='/api/search/public-books')response=await search(context);
 else if(path==='/api/admin/book-indexing')response=await admin(context);
 else if(submission&&request.method==='PATCH')response=await review({...context,params:{bookId:submission[1]}});
 else if(owner&&['PATCH','DELETE'].includes(request.method))response=await (request.method==='PATCH'?onRequestPatch:onRequestDelete)({...context,params:{bookId:owner[1]}});
 else if(/^\\/books\\/public\\/[A-Za-z0-9_-]{1,200}$/.test(path)||path==='/sitemap-public.xml')response=await seo(context);
 else response=new Response('Isolated Stage B acceptance. No production bindings.',{headers:{'content-type':'text/plain'}});
 const headers=new Headers(response.headers);headers.set('x-robots-tag','noindex');headers.set('cache-control','no-store');
 return new Response(response.body,{status:response.status,headers});
}}`
await build({stdin:{contents:input,resolveDir:repo,sourcefile:'isolated-stage-b-entry.js'},outfile:resolve(output,'dist/_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'})
await writeFile(resolve(output,'dist/index.html'),'<!doctype html><html lang="ar" dir="rtl"><head><meta name="robots" content="noindex"><title>Isolated acceptance</title></head><body><div id="app"></div></body></html>')
await writeFile(resolve(output,'dist/_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}))
for(const file of migrations){
 const tracked=await readFile(resolve(repo,'deployment/cloudflare/migrations',file)),mirror=await readFile(resolve(repo,'alpha-publish/migrations',file))
 if(!tracked.equals(mirror))throw Error('migration_mirror_mismatch:'+file)
 await copyFile(resolve(repo,'deployment/cloudflare/migrations',file),resolve(output,file))
}
// Advance the previously ready synthetic fixture using the normal metadata trigger.
// This is a file for explicit operator review/application, never executed here.
await writeFile(resolve(output,'requeue-synthetic.sql'),`-- ISOLATED database ${database} ONLY. No production application.\nUPDATE user_books SET title=CASE WHEN title='Isolated Stage B acceptance' THEN 'Isolated ingestion acceptance' ELSE 'Isolated Stage B acceptance' END,updated_at=CURRENT_TIMESTAMP WHERE id='00000000-codex-ingestion-acceptance' AND owner_subject='codex-ingestion-acceptance' AND object_key='ingestion-acceptance/source.txt' AND visibility='public' AND review_status='approved' AND deleted_at IS NULL RETURNING id;\nSELECT book_id,content_version,index_generation,visibility FROM public_book_event_state WHERE book_id='00000000-codex-ingestion-acceptance';\n`)
console.log(JSON.stringify({prepared:true,output,project,database,migrations,productionBindings:false,secretsWritten:false,previousAcceptanceUntouched:true}))
