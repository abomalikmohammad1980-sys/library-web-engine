import test from 'node:test'
import assert from 'node:assert/strict'
import {publicHtmlCacheRequest,publicHtmlCacheKey,serveVersionedPublicHtml} from '../deployment/cloudflare/functions/_seo-edge-cache.js'
const request=(path='/books/21633',init)=>new Request('https://khzanah.com'+path,init)
const snapshot=(title='كتاب',revision=1)=>({public:true,versionMaterial:{title,revision,toc:{sha:'abc'}},title})
const html=s=>new Response(s?`<h1>${s.title}</h1>`:'missing',{status:s?200:404,headers:{'content-type':'text/html',...(!s?{'x-robots-tag':'noindex'}:{})}})
function fixture(){
 const rows=new Map();let value=snapshot(),reads=0,renders=0,matches=0
 const cache={async match(key){matches++;return rows.get(key.url)?.clone()},async put(key,response){rows.set(key.url,response)}}
 return {cache,rows,set:v=>{value=v},stats:()=>({reads,renders,matches}),async serve(req=request(),extra={}){return serveVersionedPublicHtml({request:req,cache,deploymentVersion:'batch34-seo-a1',loadSnapshot:async()=>{reads++;return value},render:async s=>{renders++;return html(s)},...extra})}}
}
test('anonymous canonical requests only; no auth, cookies, private paths or unknown query',()=>{
 for(const path of ['/books/21633','/authors/000020','/authors?page=2','/books/21633?tocPage=2'])assert(publicHtmlCacheRequest(request(path)))
 for(const path of ['/books/local/1','/settings','/search?q=x','/authors/20','/books/21633?create=1','/authors?page=1&page=2'])assert(!publicHtmlCacheRequest(request(path)))
 for(const headers of [{authorization:'Bearer x'},{cookie:'session=x'},{range:'bytes=0-1'},{'cache-control':'no-cache'}])assert(!publicHtmlCacheRequest(request('/books/21633',{headers})))
 assert(!publicHtmlCacheRequest(request('/books/21633',{method:'POST'})))
})
test('version keys include content, TOC, deployment, hostname and pagination',async()=>{
 const key=await publicHtmlCacheKey(request(),'r1',snapshot())
 assert.match(key.url,/__seo_v=[a-f0-9]{64}$/)
 assert.equal(key.url,(await publicHtmlCacheKey(request(),'r1',{public:true,versionMaterial:{toc:{sha:'abc'},revision:1,title:'كتاب'}})).url)
 for(const [req,version,s] of [[request(),'r2',snapshot()],[request(),'r1',snapshot('معدل')],[request('?'),'r1',snapshot('كتاب',2)],[request('/books/21633?tocPage=2'),'r1',snapshot()],[new Request('https://preview.pages.dev/books/21633'),'r1',snapshot()],[request(),'r1',{...snapshot(),versionMaterial:{toc:{sha:'changed'}}}]])assert.notEqual(key.url,(await publicHtmlCacheKey(req,version,s)).url)
 assert.equal(await publicHtmlCacheKey(request(),'r1',null),undefined)
})
test('warm hit skips rendering but always verifies current visibility; browser cache disabled',async()=>{
 const f=fixture();const first=await f.serve();assert.equal(first.headers.get('cache-control'),'private, no-store')
 assert.equal((await f.serve()).status,200);assert.deepEqual(f.stats(),{reads:4,renders:1,matches:2})
 assert.equal([...f.rows.values()][0].headers.get('cache-control'),'public, max-age=86400')
})
test('withdrawal/private/delete after warm cache never returns former public HTML',async()=>{
 for(const state of [null,{public:false,versionMaterial:{}}]){
  const f=fixture();await f.serve();f.set(state)
  const response=await f.serve()
  assert.equal(response.status,404);assert.doesNotMatch(await response.text(),/كتاب/);assert.equal(f.stats().matches,1)
 }
})
test('changed revision invalidates without purge and race during match is fenced',async()=>{
 const f=fixture();await f.serve();f.set(snapshot('الجديد',2));assert.match(await (await f.serve()).text(),/الجديد/)
 const original=f.cache.match;f.cache.match=async key=>{const hit=await original(key);f.set(null);return hit}
 assert.equal((await f.serve()).status,404)
})
test('visibility failure fails closed and cache outage still renders current metadata',async()=>{
 const f=fixture();await f.serve()
 assert.equal((await f.serve(undefined,{loadSnapshot:async()=>{throw Error('db down')}})).status,503)
 f.cache.match=async()=>{throw Error('cache down')};f.cache.put=async()=>{throw Error('cache down')}
 assert.equal((await f.serve()).status,200)
})
test('D1 row quota exhaustion reaches the middleware recovery path',async()=>{
 const f=fixture()
 await assert.rejects(()=>f.serve(undefined,{loadSnapshot:async()=>{throw Error("D1_ERROR: Your account has exceeded D1's free tier daily row read limit.")}}),/daily row read limit/)
})
test('HEAD never poisons GET cache with empty body; set-cookie responses never stored',async()=>{
 const f=fixture();assert.equal(await (await f.serve(request('/books/21633',{method:'HEAD'}))).text(),'');assert.equal(f.rows.size,0)
 await f.serve(undefined,{render:async()=>new Response('personal',{headers:{'content-type':'text/html','set-cookie':'x=y'}})})
 assert.equal(f.rows.size,0)
})
test('preview cache is host-isolated and keeps noindex on warm HTML',async()=>{
 const f=fixture(),req=new Request('https://seo-indexing-preview.khezana.pages.dev/books/21633')
 const render=async s=>{const response=html(s);response.headers.set('x-robots-tag','noindex');return response}
 await f.serve(req,{render});const warm=await f.serve(req,{render})
 assert.equal(f.rows.size,1);assert.match(warm.headers.get('x-robots-tag'),/noindex/)
 assert.match([...f.rows.keys()][0],/^https:\/\/seo-indexing-preview\.khezana\.pages\.dev\//)
})
