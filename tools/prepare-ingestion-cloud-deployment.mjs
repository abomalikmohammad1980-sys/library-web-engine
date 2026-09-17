// Preparation only: no network, credentials, remote writes or production binding.
import {mkdir,readFile,writeFile,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../alpha-publish/package.json',import.meta.url)),{build}=require('esbuild')
const repo=resolve(import.meta.dirname,'..'),output=resolve(repo,'.artifacts/ingestion-cloud-acceptance-20260917')
const project='khizana-bok-acceptance-20260917',database='9133fe99-c4e1-4a1e-84f3-127735883279',bucket='khizana-ingestion-acceptance-20260917'
await mkdir(resolve(output,'dist'),{recursive:true})
const config={name:project,pages_build_output_dir:'./dist',compatibility_date:'2026-09-17',vars:{PUBLIC_BOOK_INGESTION_ENABLED:'true',PUBLIC_BOOK_SEARCH_ENABLED:'true'},d1_databases:[{binding:'VISITORS_DB',database_name:project,database_id:database}],r2_buckets:[{binding:'LIBRARY_R2',bucket_name:bucket}]}
await writeFile(resolve(output,'wrangler.jsonc'),JSON.stringify(config,null,2))
const input=`import {onRequest as gateway} from './alpha-publish/functions/api/internal/public-book-index.js';
import {onRequest as search} from './alpha-publish/functions/api/search/public-books.js';
import {onRequest as seo} from './alpha-publish/functions/_middleware.js';
export default {async fetch(request,env){
 const path=new URL(request.url).pathname;
 let response;
 if(path==='/api/internal/public-book-index')response=await gateway({request,env});
 else if(path==='/api/search/public-books')response=await search({request,env});
 else if(/^\\/books\\/public\\/[A-Za-z0-9_-]{1,200}$/.test(path))response=await seo({request,env,next:()=>new Response('',{status:404})});
 else response=new Response('Isolated ingestion acceptance. No production bindings.',{headers:{'content-type':'text/plain'}});
 const headers=new Headers(response.headers);headers.set('x-robots-tag','noindex');headers.set('cache-control','no-store');
 return new Response(response.body,{status:response.status,headers});
}}`
await build({stdin:{contents:input,resolveDir:repo,sourcefile:'isolated-ingestion-entry.js'},outfile:resolve(output,'dist/_worker.js'),bundle:true,format:'esm',platform:'browser',target:'es2022'})
await writeFile(resolve(output,'dist/index.html'),'<!doctype html><html lang="ar" dir="rtl"><head><meta name="robots" content="noindex"><title>Isolated acceptance</title></head><body><div id="app"></div></body></html>')
await writeFile(resolve(output,'dist/_routes.json'),JSON.stringify({version:1,include:['/*'],exclude:[]}))
for(const name of ['0027_word_book_bundles.sql','0033_public_book_index_jobs.sql','0035_public_book_search.sql'])await copyFile(resolve(repo,'alpha-publish/migrations',name),resolve(output,name))
for(const name of ['seed.sql','source.txt'])await copyFile(resolve(repo,'.artifacts/ingestion-acceptance',name),resolve(output,name))
const source=await readFile(resolve(output,'source.txt'));if(source.length!==48)throw Error('isolated_source_length_changed')
console.log(JSON.stringify({prepared:true,output,project,database,bucket,productionBindings:false,secretsWritten:false,originalBokDistUntouched:true}))
