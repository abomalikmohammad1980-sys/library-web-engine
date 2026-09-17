// Generates synthetic fixtures ONLY for the explicitly approved isolated D1/project.
import {mkdir,readFile,writeFile} from 'node:fs/promises'
import {randomBytes,createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {build} from 'esbuild'
const root=resolve('.artifacts/bok-cloud-acceptance-20260917'),sha=x=>createHash('sha256').update(x).digest('hex')
await mkdir(root+'/dist',{recursive:true})
const origin='https://khizana-bok-acceptance-20260917.pages.dev'
const session=randomBytes(32).toString('hex'),device=randomBytes(32).toString('hex')
const state={origin,cookie:`__Host-khizana-access-session=${session}; __Host-khizana-device=${device}`,bookId:'isolated-bok-acceptance',sourceHash:sha('synthetic source'),baseHash:sha('original'),releaseId:sha('synthetic release'),candidateSha256:sha('synthetic candidate')}
let sql=''
for(const name of ['0002_accounts_and_private_books','0010_account_devices','0012_account_blocks','0013_account_access_sessions','0017_account_editor_capability','0029_bok_text_drafts','0032_bok_release_pointer'])sql+=await readFile(`alpha-publish/migrations/${name}.sql`,'utf8')+'\n'
sql+=`INSERT INTO accounts(subject,email,role) VALUES('isolated-editor','isolated-editor@acceptance.invalid','user');
INSERT INTO account_capabilities(subject,editorial) VALUES('isolated-editor',1);
INSERT INTO account_devices(owner_subject,device_id,label,platform) VALUES('isolated-editor','${sha(device)}','isolated','test');
INSERT INTO account_access_sessions(token_hash,subject,device_id,expires_at) VALUES('${sha(session)}','isolated-editor','${sha(device)}',unixepoch()+3600);
INSERT INTO bok_verified_releases(release_id,candidate_sha256,book_id,source_hash,reader_manifest_sha256,search_manifest_sha256,artifact_root,reviews_json,cloud_receipt_sha256)
VALUES('${state.releaseId}','${state.candidateSha256}','${state.bookId}','${state.sourceHash}','${sha('reader')}','${sha('search')}','${origin}/synthetic-release','${JSON.stringify([{pageId:17,revision:1,baseHash:state.baseHash,text:'التصحيح'}])}','${sha('synthetic acceptance fixture, NOT production proof')}');\n`
if(!process.argv.includes('--bundle-only')){
await writeFile(root+'/seed.sql',sql,{flag:'wx'})
await writeFile(root+'/private-session.json',JSON.stringify(state),{flag:'wx'})
await writeFile(root+'/wrangler.jsonc',JSON.stringify({name:'khizana-bok-acceptance-20260917',pages_build_output_dir:'./dist',compatibility_date:'2026-09-17',vars:{BOK_TEXT_EDITING_ENABLED:'1',BOK_RELEASE_ACTIVATION_ENABLED:'1'},d1_databases:[{binding:'VISITORS_DB',database_name:'khizana-bok-acceptance-20260917',database_id:'9133fe99-c4e1-4a1e-84f3-127735883279'}]},null,2),{flag:'wx'})
}
const input=`import {onRequest} from './alpha-publish/functions/api/admin/bok-text.js';
import {activateVerifiedBokRelease,readActiveBokRelease} from './alpha-publish/functions/api/_bok-release-pointer.js';
import {trustedMutation} from './alpha-publish/functions/api/_account-contract.js';
import {boundedDraftBody} from './alpha-publish/functions/api/_bok-text-drafts.js';
import {onRequest as resolveRelease} from './alpha-publish/functions/api/library/bok-release.js';
import {onRequest as publicationJobs} from './alpha-publish/functions/api/admin/bok-publication.js';
import {onRequest as editions} from './alpha-publish/functions/api/library/book-editions.js';
export default {async fetch(request,env){const path=new URL(request.url).pathname;
if(path==='/api/admin/bok-text')return onRequest({request,env});
if(path==='/api/library/bok-release')return resolveRelease({request,env});
if(path==='/api/admin/bok-publication')return publicationJobs({request,env});
if(path==='/api/library/book-editions')return editions({request,env});
if(path==='/isolated/activate'&&request.method==='POST'&&trustedMutation(request)){
const body=await boundedDraftBody(request);if(!body||JSON.stringify(body).length>2048)return new Response('',{status:413});
return Response.json({activated:await activateVerifiedBokRelease({request,env},body)});}
if(path==='/isolated/pointer')return Response.json(await readActiveBokRelease(env.VISITORS_DB));
if(path.startsWith('/fixture/')||path.startsWith('/library/bok-releases/')){
const range=request.headers.get('range');
if(range&&path.endsWith('.bin')){
const match=/^bytes=(\\d+)-(\\d+)$/.exec(range);if(!match)return new Response('',{status:416});
const plain=new Request(request);plain.headers.delete('range');const full=await env.ASSETS.fetch(plain);
if(full.status!==200)return full;
const stream=full.body.getReader(),chunks=[];let length=0;
try{for(;;){const {done,value}=await stream.read();if(done)break;length+=value.length;if(length>2048){await stream.cancel();return new Response('',{status:413});}chunks.push(value);}}finally{stream.releaseLock();}
const start=Number(match[1]),end=Number(match[2]);if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=length)return new Response('',{status:416});
const bytes=new Uint8Array(length);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}
return new Response(bytes.slice(start,end+1),{status:206,headers:{'content-type':'application/octet-stream','content-length':String(end-start+1),'content-range':'bytes '+start+'-'+end+'/'+length,'accept-ranges':'bytes','x-robots-tag':'noindex'}});
}return env.ASSETS.fetch(request);}
return new Response('Isolated BOK acceptance only; no production bindings.',{headers:{'X-Robots-Tag':'noindex','Cache-Control':'no-store'}});}};`
await build({stdin:{contents:input,resolveDir:process.cwd(),sourcefile:'isolated-bok-entry.js'},outfile:root+'/dist/_worker.js',bundle:true,format:'esm',platform:'browser',target:'es2022'})
await writeFile(root+'/dist/index.html','<!doctype html><meta name="robots" content="noindex"><title>Isolated acceptance</title>')
console.log(JSON.stringify({prepared:true,root,databaseId:'9133fe99-c4e1-4a1e-84f3-127735883279',productionBindings:false,accountTestMode:false,sessionExpiresWithinSeconds:3600}))
