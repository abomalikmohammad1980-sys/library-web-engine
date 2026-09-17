import test from 'node:test'
import assert from 'node:assert/strict'
import {createRequire} from 'node:module'
import {readFile,mkdtemp,cp,mkdir,rm} from 'node:fs/promises'
import {resolve} from 'node:path'
import {tmpdir} from 'node:os'
import {buildSeoIndex} from './build-seo-index.mjs'
const require=createRequire(new URL('../alpha-publish/package.json',import.meta.url))
const {Miniflare}=require('miniflare'),{build}=require('esbuild')
const root=resolve(import.meta.dirname,'..')
test('real HTMLRewriter: public identity, canonical, private and missing routes, sitemap counts',async()=>{
 const output=await mkdtemp(resolve(tmpdir(),'khizana-seo-test-'))
 let mf
 try{
  await mkdir(resolve(output,'data'))
  for(const name of ['shamela-author-index.json','shamela-catalog.snapshot.json'])await cp(resolve(root,'app/public/data',name),resolve(output,'data',name))
  await cp(resolve(root,'app/public/robots.txt'),resolve(output,'robots.txt'))
  const report=await buildSeoIndex(output,{...(process.env.SEO_TOC_DIR?{tocDirectory:resolve(process.env.SEO_TOC_DIR),requireToc:true}:{})})
  const shell=await readFile(resolve(root,'app/index.html'),'utf8')
  const compiled=await build({stdin:{contents:"import {onRequest} from './alpha-publish/functions/_middleware.js';export default {fetch(request,env){return onRequest({request,env,next:()=>new Response('api passthrough')})}}",resolveDir:root},bundle:true,write:false,format:'esm',platform:'browser',target:'es2022'})
  // The installed local workerd supports May 22; preview validates the deployment date separately.
  mf=new Miniflare({modules:true,script:compiled.outputFiles[0].text,compatibilityDate:'2026-05-22',serviceBindings:{ASSETS:async request=>{
   const path=new URL(request.url).pathname
   if(path==='/index.html')return new Response(shell, {headers:{'content-type':'text/html'}})
   if(/^\/data\/seo\/toc-\d{3}\.bin$/.test(path)){
    const data=await readFile(resolve(output,'.'+path)),range=/^bytes=(\d+)-(\d+)$/.exec(request.headers.get('range')??'');assert(range)
    const start=Number(range[1]),end=Number(range[2]);return new Response(data.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${data.length}`}})
   }
   if(!/^\/data\/seo\/(authors|books)-\d{2}\.json$/.test(path))return new Response('missing',{status:404})
   return new Response(await readFile(resolve(output,'.'+path)),{headers:{'content-type':'application/json'}})
  }}})
  const titles=new Set()
  for(const path of ['/','/features','/authors','/authors/000020','/books/21633']){
   const response=await mf.dispatchFetch('https://khzanah.com'+path),html=await response.text()
   assert.equal(response.status,200,path);assert.equal((html.match(/<h1(?:\s|>)/g)??[]).length,1,path)
   assert.ok(html.includes(`href="https://khzanah.com${path}"`),path)
   assert.match(html,/<meta name="description" content="[^"]+"/)
   assert.match(html,/<meta name="robots" content="index, follow"/)
   const title=html.match(/<title>(.*?)<\/title>/s)?.[1];assert.ok(title);titles.add(title)
   assert.match(html,/<style id="seo-presentation">/)
   assert.match(html,/class="seo-page/)
   if(path==='/'){
    assert.equal(title,'الخزانة: المكتبة الإسلامية الذكية')
    assert.match(html,/<h1>الخزانة: المكتبة الإسلامية الذكية<\/h1>/)
    assert.match(html,/"@type":"WebSite","name":"الخزانة"/)
    assert.doesNotMatch(html,/مرحبًا بك|display\s*:\s*none|visibility\s*:\s*hidden/)
    assert.match(html,/<a href="\/browse">تصفح الكتب<\/a>/)
   }
   if(path==='/authors/000020')assert.match(title,/الشافعي/)
   if(path==='/books/21633')assert.match(title,/أبو موسى المديني/)
   if(path==='/books/21633'&&process.env.SEO_TOC_DIR){assert.match(html,/فهرس المحتويات/);assert.match(html,/pageIndex=\d+/)}
  }
  assert.equal(titles.size,5)
  for(const [path,status] of [['/books/999999999',404],['/settings',200],['/search?q=x',200]]){
   const response=await mf.dispatchFetch('https://khzanah.com'+path),html=await response.text()
   assert.equal(response.status,status);assert.match(html,/noindex, follow/);assert.doesNotMatch(html,/rel="canonical"/)
  }
  const preview=await mf.dispatchFetch('https://seo-paths-preview.khezana.pages.dev/authors/000020',{method:'HEAD'})
  assert.equal(preview.status,200);assert.match(preview.headers.get('x-robots-tag'),/noindex/);assert.equal(await preview.text(),'')
  const redirect=await mf.dispatchFetch('https://www.khzanah.com/books/21633?q=x',{redirect:'manual'})
  assert.equal(redirect.status,301);assert.equal(redirect.headers.get('location'),'https://khzanah.com/books/21633?q=x')
  for(const [old,next] of [['/authors/20','/authors/000020'],['/books/410021633','/books/21633'],['/books/21633/','/books/21633']]){
   const response=await mf.dispatchFetch('https://khzanah.com'+old+'?pageIndex=4',{redirect:'manual'})
   assert.equal(response.status,301,old);assert.equal(response.headers.get('location'),'https://khzanah.com'+next+'?pageIndex=4')
  }
  const local=await mf.dispatchFetch('https://khzanah.com/books/local/private-id'),localHtml=await local.text()
  assert.equal(local.status,200);assert.match(localHtml,/noindex, follow/);assert.doesNotMatch(localHtml,/rel="canonical"/)
  assert.equal(await (await mf.dispatchFetch('https://khzanah.com/api/test')).text(),'api passthrough')
  assert.equal(await (await mf.dispatchFetch('https://khzanah.com/library/shamela/catalog.json')).text(),'api passthrough')
  const routes=JSON.parse(await readFile(resolve(root,'alpha-publish/scripts/pages-static/_routes.json'),'utf8'))
  assert(!routes.exclude.includes('/library/*'),'R2 library gateway must remain callable')
  let total=0
  for(const name of report.sitemaps){const xml=await readFile(resolve(output,name),'utf8');const urls=[...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map(x=>x[1]);assert.ok(urls.length<=5000);for(const url of urls){assert.match(url,/^https:\/\/khzanah\.com\/(?:$|features$|quran$|sunnah$|browse$|new-books$|authors(?:\/\d+)?$|books\/\d+$)/);assert.ok(!url.includes('#'))}total+=urls.length}
  assert.equal(total,report.counts.books+report.counts.authors+report.counts.staticPages)
 }finally{await mf?.dispose();await rm(output,{recursive:true,force:true})}
})
