import {writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const base=process.argv[2],output=process.argv[3];assert(base&&output)
const networkFetch=globalThis.fetch
// Retry transport failures (including interrupted bodies), never assertion failures.
const fetch=async(url,init={})=>{for(let attempt=0;;attempt++)try{const response=await networkFetch(url,{...init,signal:AbortSignal.timeout(20000)});const bytes=await response.arrayBuffer();return new Response(init.method==='HEAD'||[204,205,304].includes(response.status)?null:bytes,{status:response.status,statusText:response.statusText,headers:response.headers})}catch(error){if(attempt===2)throw new Error('HTTP verification transport failed: '+url,{cause:error});console.warn('Retrying transport:',url)}}
const results=[]
for(const [path,status] of [['/',200],['/features',200],['/authors',200],['/authors/000020',200],['/books/21633',200],['/books/999999999',404],['/settings',200],['/search?q=x',200]]){
 const response=await fetch(base+path),html=await response.text();assert.equal(response.status,status,path+': '+html.slice(0,100))
 const isPublic=status===200&&!/^\/(settings|search)/.test(path)
 assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,path)
 const title=html.match(/<title>(.*?)<\/title>/s)?.[1];assert(title)
 if(isPublic)assert(html.includes(`href="https://khzanah.com${path}"`),path)
 else{assert.match(html,/name="robots" content="noindex, follow"/);assert(!html.includes('rel="canonical"'))}
 if(new URL(base).hostname!=='khzanah.com')assert.match(response.headers.get('x-robots-tag')||'',/noindex/)
 else if(isPublic){assert(!/noindex/i.test(response.headers.get('x-robots-tag')||''),path);assert.match(html,/name="robots" content="index, follow"/)}
 if(path==='/books/21633'){assert.match(html,/فهرس المحتويات/);assert.match(html,/pageIndex=\d+/);assert.match(title,/أبو موسى المديني/)}
 results.push({path,status:response.status,title,robots:response.headers.get('x-robots-tag'),h1:1})
}
for(const [path,target]of [['/authors/20','/authors/000020'],['/books/410021633','/books/21633']]){const r=await fetch(base+path,{redirect:'manual'});assert.equal(r.status,301);assert.equal(new URL(r.headers.get('location')).pathname,target);results.push({path,status:301,target})}
const head=await fetch(base+'/authors/000020',{method:'HEAD'});assert.equal(head.status,200)
const sitemap=await(await fetch(base+'/sitemap.xml')).text();assert.match(sitemap,/<sitemapindex/)
let total=0
for(const name of ['sitemap-static.xml','sitemap-authors.xml','sitemap-books-001.xml','sitemap-books-002.xml']){
 const response=await fetch(base+'/'+name),xml=await response.text();assert.equal(response.status,200);assert(!xml.includes('#'));assert(!/\/search|\/settings|\/books\/local/.test(xml));total+=(xml.match(/<url>/g)||[]).length
}
// 8 public static routes, including /categories, plus the pinned source catalog.
assert.equal(total,8594+3174+8)
const api=await fetch(base+'/api/seo/record?kind=books&id=21633');assert.equal(api.status,200);assert((await api.json()).record.title)
const report={passed:true,base,checkedAt:new Date().toISOString(),results,staticSitemapUrls:total,sitemap,head:{status:head.status,robots:head.headers.get('x-robots-tag')}}
await writeFile(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report))
