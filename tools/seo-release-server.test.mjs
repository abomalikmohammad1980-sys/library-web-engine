import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {buildSeoIdentities} from './build-seo-identities.mjs'
import {buildSeoListings} from './build-seo-listings.mjs'
const require=createRequire(new URL('../alpha-publish/package.json',import.meta.url))
const {Miniflare}=require('miniflare'),{build}=require('esbuild')
test('release-bound real HTML: complete pagination, related links, privacy veto and no legacy shard reads',async()=>{
 const input={generatedAt:'2026-09-17T00:00:00Z',authors:[{id:'000020',name:'المؤلف'}],books:Array.from({length:251},(_,i)=>({id:String(i+1),title:'عنوان '+(i+1),author:'المؤلف',authorId:'000020',category:'قسم'}))}
 const identities=buildSeoIdentities(input),listings=buildSeoListings(input)
 const descriptor=Buffer.from(JSON.stringify({contract:'seo-data-release/1',identities:identities.descriptor,listings:{releaseId:listings.report.releaseId}}))
 const sha=createHash('sha256').update(descriptor).digest('hex')
 const compiled=await build({stdin:{contents:`import {onRequest} from './alpha-publish/functions/_middleware.js';export default {fetch(request,env){
 env.VISITORS_DB={prepare(){return{bind(...ids){return{first:async()=>{const state=await(await env.STATE.fetch('https://state.test')).json();if(ids.includes('1')&&(state.hidden||state.title))return{visibility:state.hidden?'private':'public',title:state.title,category:'قسم',updated_at:state.title};return null},all:async()=>({results:[{book_id:'shamela-2'}]})}}}}};
 return onRequest({request,env,next:()=>new Response('passthrough')})}}`,resolveDir:resolve(import.meta.dirname,'..')},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
 const reads=[];let state={hidden:false,title:null},primaryReads=0
 const mf=new Miniflare({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-05-22',bindings:{SEO_DATA_RELEASE_SHA256:sha,SEO_HTML_CACHE_VERSION:'a'.repeat(40)},r2Buckets:['LIBRARY_R2'],serviceBindings:{STATE:async()=>{primaryReads++;return Response.json(state)},ASSETS:async request=>{
  const path=new URL(request.url).pathname;reads.push(path)
  if(path==='/data/seo/release.json')return new Response(descriptor)
  if(path==='/index.html')return new Response('<html><head><title>x</title></head><body><div id="app"></div></body></html>',{headers:{'content-type':'text/html'}})
  return new Response('missing',{status:404})
 }}})
 try{
  const bucket=await mf.getR2Bucket('LIBRARY_R2')
  for(const [key,bytes] of identities.objects)await bucket.put(key,bytes)
  for(const [name,bytes] of listings.files)await bucket.put(`seo/listings/${listings.report.releaseId}/${name}`,bytes)
  for(const path of ['/browse','/new-books','/authors/000020','/categories/'+encodeURIComponent('قسم')]){
   const ids=[]
   for(let page=1;page<=3;page++){
    const suffix=page===1?'':`?page=${page}`,response=await mf.dispatchFetch('https://khzanah.com'+path+suffix),html=await response.text()
    assert.equal(response.status,200);assert.equal((html.match(/<h1>/g)??[]).length,1)
    assert(html.includes(`rel="canonical" href="https://khzanah.com${path+suffix}"`))
    ids.push(...[...html.matchAll(/href="\/books\/(\d+)"/g)].map(m=>m[1]))
    if(page<3)assert(html.includes(`${path}?page=${page+1}`))
   }
   assert.equal(ids.length,250);assert.equal(new Set(ids).size,250);assert(!ids.includes('2'))
   for(const suffix of ['?page=4','?page=0','?page=x','?page=1&page=2']){
    const response=await mf.dispatchFetch('https://khzanah.com'+path+suffix),html=await response.text()
    assert.equal(response.status,404);assert.doesNotMatch(html,/rel="canonical"|href="\/books\//)
   }
  }
  const html=await(await mf.dispatchFetch('https://khzanah.com/books/1')).text()
  assert.match(html,/كتب أخرى للمؤلف/);assert.match(html,/من القسم نفسه/)
  assert.equal([...html.matchAll(/href="\/books\/\d+"/g)].length,24)
  assert.doesNotMatch(html,/href="\/books\/(1|2)"/)
  const categoryResponse=await mf.dispatchFetch('https://khzanah.com/categories'),categoryHtml=await categoryResponse.text()
  assert.equal(categoryResponse.status,200);assert.match(categoryHtml,/href="\/categories\/%/)
  const missingCategory=await mf.dispatchFetch('https://khzanah.com/categories/missing')
  assert.equal(missingCategory.status,404);assert.doesNotMatch(await missingCategory.text(),/rel="canonical"/)
  const before=reads.filter(p=>p==='/index.html').length,primaryBefore=primaryReads
  const warm=await mf.dispatchFetch('https://khzanah.com/books/1')
  assert.match(warm.headers.get('cache-control'),/private, no-store/)
  assert.equal(await warm.text(),html)
  assert.equal(reads.filter(p=>p==='/index.html').length,before,'warm cache must skip HTML rendering')
  assert.equal(primaryReads-primaryBefore,2,'one initial primary record check plus one post-cache fence, not a redundant third check')
  state={hidden:false,title:'عنوان معدل'}
  assert.match(await(await mf.dispatchFetch('https://khzanah.com/books/1')).text(),/عنوان معدل/)
  state={hidden:true,title:null}
  const removed=await mf.dispatchFetch('https://khzanah.com/books/1'),removedHtml=await removed.text()
  assert.equal(removed.status,404);assert.doesNotMatch(removedHtml,/عنوان معدل|rel="canonical"/)
  state={hidden:false,title:null}
  const preview=await mf.dispatchFetch('https://preview.pages.dev/authors?page=1')
  assert.equal(preview.status,200);assert.match(preview.headers.get('x-robots-tag'),/noindex/)
  assert(reads.every(path=>['/data/seo/release.json','/index.html'].includes(path)))
  await bucket.delete(identities.descriptor.index.objectKey)
  // Warm immutable metadata remains valid during an R2 outage; a genuinely
  // cold identity must fail closed instead of silently using another catalog.
  assert.equal((await mf.dispatchFetch('https://khzanah.com/books/1')).status,200)
  assert.equal((await mf.dispatchFetch('https://khzanah.com/books/251')).status,503)
  // A data release outage must not prevent private/search SPA boot.
  const privateResponse=await mf.dispatchFetch('https://khzanah.com/search?q=x')
  assert.equal(privateResponse.status,200);assert.match(await privateResponse.text(),/noindex/)
 }finally{await mf.dispose()}
})
