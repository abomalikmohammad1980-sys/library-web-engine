import {readFile,writeFile,mkdir,link} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {inlineThemeBootstrap} from './inline-theme-bootstrap.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const root=resolve(import.meta.dirname,'..'),previous=resolve(root,'.artifacts/batch62'),target=resolve(root,'.artifacts/batch63')
const sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=JSON.parse(await readFile(resolve(previous,'static-source-manifest.json')))
const stage=JSON.parse(await readFile(resolve(previous,'stage.json')))
if(sha(JSON.stringify(manifest))!==stage.payloadFingerprint||!stage.published)throw Error('published_baseline_required')
await mkdir(target) // Refuse to mutate an existing frozen candidate.
const read=p=>readFile(resolve(previous,'deploy/pages-dist',p),'utf8')
const optimized=inlineThemeBootstrap(await read('index.html'),await read('_headers'),await read('theme-init.js'))
const replacements=new Map([['index.html',optimized.index],['_headers',optimized.headers],['sw.js',stampServiceWorkerRelease(await read('sw.js'),optimized.index)]])
for(const entry of manifest){
 const dest=resolve(target,'deploy/pages-dist',entry.path)
 await mkdir(dirname(dest),{recursive:true})
 if(replacements.has(entry.path)){
  const bytes=Buffer.from(replacements.get(entry.path));await writeFile(dest,bytes,{flag:'wx'});entry.bytes=bytes.length;entry.sha256=sha(bytes)
 }else await link(resolve(previous,'deploy/pages-dist',entry.path),dest)
}
const snapshot=JSON.parse(await readFile(resolve(previous,'source-snapshot.json'))),seen=new Set()
const changes=new Map([['deploy/functions/_middleware.js','alpha-publish/functions/_middleware.js'],['deploy/functions/_seo-public-listings.js','alpha-publish/functions/_seo-public-listings.js']])
for(const entry of snapshot.files){
 const bytes=await readFile(changes.has(entry.path)?resolve(root,changes.get(entry.path)):resolve(previous,entry.path))
 if(!changes.has(entry.path)&&sha(bytes)!==entry.sha256)throw Error('snapshot_mismatch:'+entry.path)
 if(changes.has(entry.path)){entry.sha256=sha(bytes);entry.bytes=bytes.length}
 if(seen.has(entry.path))continue;seen.add(entry.path)
 const dest=resolve(target,entry.path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'})
}
const functionsFingerprint=sha(JSON.stringify(snapshot.files.filter(r=>r.path.startsWith('deploy/functions/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path))))
const config=JSON.parse(await readFile(resolve(previous,'deploy/wrangler.jsonc')))
config.vars.SEO_HTML_CACHE_VERSION=functionsFingerprint;config.env.preview.vars.SEO_HTML_CACHE_VERSION=functionsFingerprint
for(const [name,data] of [['source-snapshot.json',snapshot],['static-source-manifest.json',manifest],['deploy/wrangler.jsonc',config],['rollback.json',JSON.parse(await readFile(resolve(root,'alpha-publish/ops/current-production.json')))],['stage.json',{...stage,version:'batch-20260920-63',baselineDeploymentId:'71d9122e-fc2a-4275-b4de-2727d461de59',payloadFingerprint:sha(JSON.stringify(manifest)),functionsFingerprint,productionReady:false,published:false,reason:'hash-authorized inline theme bootstrap; bounded related queries without whole-catalog count'}]])await writeFile(resolve(target,name),JSON.stringify(data,null,2),{flag:'wx'})
console.log(JSON.stringify({batch:63,files:manifest.length,hash:optimized.hash,functionsFingerprint}))
