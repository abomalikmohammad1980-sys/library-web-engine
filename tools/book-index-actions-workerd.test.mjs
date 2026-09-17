import test from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {createRequire} from 'node:module'
const require=createRequire(new URL('../alpha-publish/package.json',import.meta.url))
const {Miniflare,createFetchMock,fetch:mockFetch}=require('miniflare')
const source=await readFile(new URL('../deployment/cloudflare/workers/book-index-actions/worker.js',import.meta.url),'utf8')
const repository='abomalikmohammad1980-sys/library-web-engine'

test('actual workerd coordinator dispatches and polls without following redirects',{timeout:30000},async()=>{
 const mock=createFetchMock();mock.disableNetConnect()
 const api=mock.get('https://api.github.com')
 const dispatch='/repos/'+repository+'/actions/workflows/public-book-ingestion-targeted.yml/dispatches'
 api.intercept({path:dispatch,method:'POST'}).reply(204)
 api.intercept({path:dispatch,method:'POST'}).reply(302,'',{headers:{location:'https://untrusted.invalid/collect'}})
 api.intercept({path:'/repos/'+repository+'/actions/runs/42',method:'GET'}).reply(200,JSON.stringify({id:42,repository:{full_name:repository},status:'in_progress'}))
 api.intercept({path:'/repos/'+repository+'/actions/runs/42',method:'GET'}).reply(302,'',{headers:{location:'https://untrusted.invalid/collect'}})
 // A trap proves that Location is never requested, not merely that networking failed.
 mock.get('https://untrusted.invalid').intercept({path:'/collect'}).reply(200,'redirect trap')
 const script=source.replace('export default {fetch:createActionsExtractor()}','')+`
 export default {async fetch(request){
  let outbound=0,lastUpdate=null;
  const polling=new URL(request.url).searchParams.has('poll');
  const db={withSession(){return this},prepare(sql){return {bind(...args){return {
   async run(){return {success:true}},
   async first(){
    if(sql.startsWith('SELECT j.state'))return {state:'queued',generation:1,search_ready:0};
    if(sql.startsWith('SELECT * FROM'))return polling?{state:'dispatched',run_id:42,updated_at:99}:null;
    if(sql.includes('RETURNING attempts'))return {attempts:1};
    if(sql.includes('RETURNING book_id')){lastUpdate=args;return {book_id:'synthetic-book'}};
    throw Error('unexpected query');
   }
  }}}}};
  const handler=createActionsExtractor({now:()=>100,nonce:()=> 'synthetic-lease',fetcher:(url,init)=>{outbound++;if(init.redirect!=='manual')throw Error('redirect_not_manual');return fetch(url,init)}});
  const result=await handler(new Request('https://extractor.internal/internal/public-book-extract',{method:'POST',body:JSON.stringify({bookId:'synthetic-book',contentVersion:1,action:'upsert'})}),{BOOK_INDEX_ACTIONS_ENABLED:'true',VISITORS_DB:db,GITHUB_ACTIONS_TOKEN:'github_pat_'+ 'x'.repeat(24)});
  return Response.json({status:result.status,body:await result.json(),outbound,lastUpdate});
 }};
 `
 // Miniflare's default mock bridge itself follows redirects in Node. Preserve
 // upstream 3xx here so workerd, rather than that bridge, owns redirect policy.
 const mf=new Miniflare({modules:true,compatibilityDate:'2026-05-22',script,outboundService:req=>mockFetch(req,{dispatcher:mock,redirect:'manual'})})
 try{
  const call=async(path='')=>(await mf.dispatchFetch('https://local.test/'+path)).json()
  const accepted=await call();assert.equal(accepted.status,202);assert.equal(accepted.outbound,1);assert.equal(accepted.lastUpdate[2],'dispatched')
  const rejected=await call();assert.equal(rejected.status,503);assert.equal(rejected.outbound,1);assert.equal(rejected.lastUpdate[4],'dispatch_http_302')
  for(let i=0;i<2;i++){const polling=await call('?poll');assert.equal(polling.status,202);assert.equal(polling.outbound,1)}
  const pending=mock.pendingInterceptors();assert.equal(pending.length,1);assert.equal(pending[0].origin,'https://untrusted.invalid')
 }finally{await mf.dispose()}
})
