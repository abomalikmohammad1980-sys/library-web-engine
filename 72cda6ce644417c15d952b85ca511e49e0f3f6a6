import {execFileSync} from 'node:child_process'
import {readFile,writeFile,mkdir,cp,readdir,unlink} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from 'vite'
import {inventory,verifyPagesConfiguration} from '../alpha-publish/scripts/release-integrity.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch28'),work=resolve(root,'.artifacts/batch29'),out=resolve(work,'deploy/pages-dist')
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex')
const compiled=resolve(work,'compiled-'+Date.now())
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','app/tsconfig.json','--noEmit'],{cwd:root,stdio:'inherit'})
const stage=await read(resolve(work,'stage.json')),current=await read(resolve(root,'alpha-publish/ops/current-production.json'))
assert(!stage.published);assert.equal(current.deploymentId,stage.baselineDeploymentId)
const source=await read(resolve(work,'source-snapshot.json')),snapshot=new Map()
for(const file of source.files){
 const before=await readFile(resolve(work,file.path));assert.equal(sha(before),file.sha256)
 let bytes=['app/src/engine/search_store.ts','app/src/page_meta_model.ts'].includes(file.path)?await readFile(resolve(root,file.path)):before
 if(file.path==='app/src/screens/home.ts'){
  const old="'مرحبًا بك في ', h('span', { class: 'home-hero__title-brand' }, 'الخِزانة')"
  const next="h('span', { class: 'home-hero__title-brand' }, 'الخزانة'), ': المكتبة الإسلامية الذكية'"
  const text=before.toString('utf8');assert(text.includes(old)||text.includes(next));bytes=Buffer.from(text.replace(old,next))
 }
 if(!bytes.equals(before)){file.sha256=sha(bytes);file.changed=true;await writeFile(resolve(work,file.path),bytes)}
 snapshot.set(file.path,bytes.toString('utf8'))
}
const inputHtml=(await readFile(resolve(base,'deploy/pages-dist/index.html'),'utf8')).replace(/<title>[^<]*<\/title>/,'<title>الخزانة: المكتبة الإسلامية الذكية</title>').replace(/<script\b[^>]*type="module"[^>]*><\/script>/g,'<script type="module" src="/src/main.ts"></script>').replace(/\s*<link\b[^>]*rel="stylesheet"[^>]*>/g,'')
const plugin=()=>({name:'frozen-search-repair',enforce:'pre',load(id){const path=relative(root,id.split('?')[0]).replaceAll('\\','/');if(snapshot.has(path))return snapshot.get(path);if(/^(app\/src|packages)\//.test(path)&&/\.(ts|json|css)$/.test(path))throw Error('unfrozen_source:'+path);return null}})
process.env.KHIZANA_BUILD_READONLY_SOURCE='1'
const {config}=await loadConfigFromFile({command:'build',mode:'production'},resolve(root,'app/vite.config.ts'))
config.plugins=config.plugins.flat(Infinity).filter(p=>p?.name!=='emit-essential-public-assets')
await build({...config,base:'/',configFile:false,plugins:[plugin(),{name:'frozen-html',transformIndexHtml:{order:'pre',handler:()=>inputHtml}},...config.plugins],worker:{...config.worker,plugins:()=>[plugin()]},build:{...config.build,outDir:compiled,emptyOutDir:false}})

const fresh=resolve(compiled,'assets'),assets=resolve(out,'assets')
const names=new Set(await readdir(fresh))
for(const entry of await readdir(assets,{withFileTypes:true})){
 assert(entry.isFile());const target=resolve(assets,entry.name);assert.equal(relative(assets,target),entry.name)
 if(!names.has(entry.name))await unlink(target)
}
await cp(fresh,assets,{recursive:true})
const html=await readFile(resolve(compiled,'index.html'),'utf8');await writeFile(resolve(out,'index.html'),html)
await writeFile(resolve(out,'sw.js'),stampServiceWorkerRelease(await readFile(resolve(base,'deploy/pages-dist/sw.js'),'utf8'),html))
await writeFile(resolve(work,'source-snapshot.json'),JSON.stringify(source,null,2))
for(const name of ['_middleware.js','_seo-presentation.js'])await cp(resolve(root,'alpha-publish/functions',name),resolve(work,'deploy/functions',name))
await verifyPagesConfiguration(out)
await unlink(resolve(out,'q13-manifest.json'))
const payload=await inventory(out);await writeFile(resolve(out,'q13-manifest.json'),JSON.stringify({schemaVersion:1,...payload},null,2))
const final=await inventory(out);assert(final.fileCount<=20000)
stage.changed=[...new Set([...stage.changed,'app/src/engine/search_store.ts','app/src/page_meta_model.ts','app/src/screens/home.ts','app/index.html','alpha-publish/functions/_middleware.js','alpha-publish/functions/_seo-presentation.js'])];stage.payloadFingerprint=payload.fingerprint;stage.deployFingerprint=final.fingerprint;stage.files=final.fileCount
stage.functionsFingerprint=(await inventory(resolve(work,'deploy/functions'))).fingerprint
await writeFile(resolve(work,'stage.json'),JSON.stringify(stage,null,2));console.log(JSON.stringify(stage))
