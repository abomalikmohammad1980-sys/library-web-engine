// Read-only remote acceptance for an exact frozen Pages candidate.
import assert from 'node:assert/strict'
import {readFile,writeFile} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
import {verifyPagesConfiguration} from '../alpha-publish/scripts/release-integrity.mjs'
const require=createRequire(import.meta.url),{Agent,setGlobalDispatcher}=require('../alpha-publish/node_modules/undici')
setGlobalDispatcher(new Agent({connect:{family:4,timeout:20000},connections:4,pipelining:0}))
const root=resolve(import.meta.dirname,'..'),[directory,origin,label]=process.argv.slice(2),out=resolve(root,directory??'')
assert(relative(resolve(root,'.artifacts'),out)&&!relative(resolve(root,'.artifacts'),out).startsWith('..'),'candidate_directory_required')
assert(/^https:\/\/(?:[a-f0-9]{8}\.khezana\.pages\.dev|khzanah\.com)$/.test(origin??''))
assert(['preview','production','smoke'].includes(label))
const candidate=JSON.parse(await readFile(resolve(out,'candidate.json'),'utf8'))
if(label!=='smoke'){assert.equal(candidate.smokeOnly,false);assert.equal(candidate.readerBooks,1788)}
else assert.equal(candidate.smokeOnly,true)
const pages=resolve(out,'deploy/pages-dist'),manifest=JSON.parse(await readFile(resolve(pages,'q13-manifest.json'),'utf8'))
await verifyPagesConfiguration(pages,{allowDeferredSearchBootstrap:true})
assert.equal(manifest.fingerprint,candidate.payloadFingerprint)
const paths=[...new Set(['index.html','sw.js','q13-manifest.json','data/shamela-search-v2-packed.js','data/shamela-pages-release.json','quran/resources/manifest.json','fonts/quran/kfgqpc-hafs-regular.otf',...manifest.files.filter(f=>f.path.startsWith('assets/')||/^downloads\/.*\.exe$/.test(f.path)).map(f=>f.path)])]
const hash=b=>createHash('sha256').update(b).digest('hex'),checked=[]
async function get(path){let last;for(let attempt=0;attempt<3;attempt++)try{
 const response=await fetch(origin+'/'+path,{signal:AbortSignal.timeout(60000),redirect:'manual',cache:'no-store'})
 if(path==='index.html'&&response.status===308){assert.equal(response.headers.get('location'),'/');return await fetch(origin+'/',{signal:AbortSignal.timeout(60000),redirect:'error',cache:'no-store'})}
 return response
}catch(e){last=e;if(attempt<2)await new Promise(r=>setTimeout(r,1000*(attempt+1)))}throw last}
let cursor=0
await Promise.all(Array.from({length:4},async()=>{for(;;){const index=cursor++;if(index>=paths.length)return;const path=paths[index],response=await get(path);assert.equal(response.status,200,path);const bytes=Buffer.from(await response.arrayBuffer()),local=await readFile(resolve(pages,path));
 if(path==='index.html'){
  // Pages redirects index.html to the SEO-rendered root. Its metadata differs,
  // but every frozen executable script and inline style must remain exact.
  const blocks=[...local.toString().matchAll(/<(script|style)\b[\s\S]*?<\/\1>/g)].map(m=>m[0]);assert(blocks.length>0)
  for(const block of blocks)assert(bytes.toString().includes(block),'root_executable_or_style_drift')
 }else assert.equal(hash(bytes),hash(local),'remote_hash:'+path)
 checked.push({path,sha256:hash(bytes),bytes:bytes.length,verification:path==='index.html'?'exact executable scripts and inline styles in SEO root':'full SHA256'});if(checked.length%25===0)console.log('Verified UI assets: '+checked.length)}}))
const readiness=await get('api/account/readiness');assert.equal(readiness.status,200);const ready=await readiness.json();assert.equal(ready.ready,true)
const native=await get('api/account/native-session');assert.equal(native.status,401,'anonymous_session_must_not_authenticate')
const seo=[]
for(const [path,expectedTitle] of [['books/907?pageIndex=8497','صحيح البخاري'],['books/151179','التفسير والبيان لأحكام القرآن'],['authors/001175','ابن المناصف']]){
 const response=await get(path);assert.equal(response.status,200,path);const html=await response.text();assert(!html.includes('people_central_baseline_unavailable'),path);const title=html.match(/<title>([^<]*)<\/title>/)?.[1];assert(title?.includes(expectedTitle),'seo_title:'+path);seo.push({path,status:response.status,title})
}
const report={verifiedAt:new Date().toISOString(),origin,passed:true,smokeOnly:candidate.smokeOnly,payloadFingerprint:candidate.payloadFingerprint,files:checked,accountReady:true,anonymousSessionDenied:true,seo,visualAcceptance:'separate browser receipt; HTTP checks do not prove interaction',productionWrites:false}
await writeFile(resolve(out,label+'-remote-verification.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify({passed:true,assets:checked.length,seo:seo.length,origin,smokeOnly:candidate.smokeOnly}))
