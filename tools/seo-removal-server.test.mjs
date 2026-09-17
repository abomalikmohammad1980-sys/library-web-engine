import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {resolve} from 'node:path'
const require=createRequire(new URL('../alpha-publish/package.json',import.meta.url))
const {Miniflare}=require('miniflare'),{build}=require('esbuild')
test('real server returns410 only for previously public removals, private-only404 and exact IndexNow key',async()=>{
 const key='c'.repeat(64)
 const compiled=await build({stdin:{contents:`import {onRequest} from './alpha-publish/functions/_middleware.js';export default {fetch(request,env){
 env.VISITORS_DB={withSession(){return this},prepare(sql){return{bind(id){return{async first(){return sql.includes('public_book_event_state')&&id==='removed'?{visibility:'removed'}:null}}}}}};
 return onRequest({request,env,next:()=>new Response('passthrough',{status:404})})}}`,resolveDir:resolve(import.meta.dirname,'..')},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
 const mf=new Miniflare({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-05-22',bindings:{PUBLIC_BOOK_INDEX_EVENTS_ENABLED:'true',INDEXNOW_ENABLED:'true',INDEXNOW_SUBMISSION_APPROVED:'true',INDEXNOW_KEY:key},serviceBindings:{ASSETS:async()=>new Response('<html><head><title>x</title></head><body><div id="app"></div></body></html>',{headers:{'content-type':'text/html'}})}})
 try{
  for(const [id,status] of [['removed',410],['private-only',404],['unknown',404]]){
   const response=await mf.dispatchFetch('https://khzanah.com/books/public/'+id),html=await response.text()
   assert.equal(response.status,status);assert.match(html,/noindex/);assert.doesNotMatch(html,/rel="canonical"|application\/ld\+json/)
   assert.equal((html.match(/<h1>/g)??[]).length,1)
  }
  const response=await mf.dispatchFetch('https://khzanah.com/'+key+'.txt')
  assert.equal(response.status,200);assert.equal(await response.text(),key)
  assert.equal((await mf.dispatchFetch('https://preview.pages.dev/'+key+'.txt')).status,404)
  assert.equal((await mf.dispatchFetch('https://khzanah.com/'+key+'.txt?x=1')).status,404)
 }finally{await mf.dispose()}
})
