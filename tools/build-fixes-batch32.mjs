// Assemble reviewed deltas on a verified frozen baseline, never the dirty tree.
// This prepares a LOCAL candidate only; it does not deploy or migrate a database.
import {execFileSync} from 'node:child_process'
import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from 'vite'
import {inventory,verifyPagesConfiguration} from '../alpha-publish/scripts/release-integrity.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const candidate=process.env.KHIZANA_FIXES_CANDIDATE??'batch32'
assert(/^batch\d+$/u.test(candidate),'invalid_candidate_name')
const baselineName=process.env.KHIZANA_FIXES_BASELINE??'batch31'
assert(/^batch\d+$/u.test(baselineName)&&baselineName!==candidate,'invalid_baseline_name')
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts',baselineName),work=resolve(root,'.artifacts',candidate),out=resolve(work,'deploy/pages-dist')
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex')
const current=await read(resolve(root,'alpha-publish/ops/current-production.json'))
const baseline=await read(resolve(base,'stage.json'))
if(process.env.KHIZANA_FIXES_BASELINE){
 const receipt=await read(resolve(base,'deployment.json'))
 assert(receipt.published===true&&receipt.productionReady===true,'baseline_not_published')
 assert.equal(receipt.deploymentId,current.deploymentId,'production_changed_reconcile_first')
 assert.equal(receipt.deployFingerprint,baseline.deployFingerprint,'baseline_receipt_mismatch')
 assert.equal(receipt.functionsFingerprint,baseline.functionsFingerprint,'baseline_functions_receipt_mismatch')
}else{
 assert.equal(current.deploymentId,'36a4eb26-f57a-48ce-9322-8b6785c2311e','production_changed_reconcile_first')
 assert.equal(baseline.baselineDeploymentId,current.deploymentId)
}
assert.equal((await inventory(resolve(base,'deploy/pages-dist'))).fingerprint,baseline.deployFingerprint)
assert.equal((await inventory(resolve(base,'deploy/functions'))).fingerprint,baseline.functionsFingerprint)
try{await stat(work);throw Error('candidate_exists')}catch(error){if(error.code!=='ENOENT')throw error}
const overlay=await read(resolve(root,`tools/${candidate}-reviewed-overlay.json`))
for(const path of [...overlay.source,...overlay.functions,...overlay.public,...overlay.migrations])assert(!path.includes('..')&&!path.startsWith('/')&&!path.includes('\\'),'invalid_overlay_path')
execFileSync(process.execPath,['node_modules/typescript/bin/tsc','-p','app/tsconfig.json','--noEmit'],{cwd:root,stdio:'inherit'})
const changed=new Set(overlay.source),snapshot=new Map(),files=[],reviewedBytes=new Map()
for(const path of [...overlay.source,...overlay.functions,...overlay.public,...overlay.migrations])reviewedBytes.set(path,await readFile(resolve(root,path)))
const sourceFiles=(await read(resolve(base,'source-snapshot.json'))).files
for(const path of changed)if(!sourceFiles.some(file=>file.path===path))sourceFiles.push({path})
for(const file of sourceFiles){
 const old=file.sha256?await readFile(resolve(base,file.path)):Buffer.alloc(0);if(file.sha256)assert.equal(sha(old),file.sha256)
 const bytes=changed.has(file.path)?reviewedBytes.get(file.path):old
 snapshot.set(file.path,bytes.toString('utf8'));files.push({path:file.path,sha256:sha(bytes),changed:changed.has(file.path)})
 await mkdir(resolve(work,file.path,'..'),{recursive:true});await writeFile(resolve(work,file.path),bytes)
}
await writeFile(resolve(work,'source-snapshot.json'),JSON.stringify({baseline:current.deploymentId,previewBaseline:baseline.deployFingerprint,files},null,2))
await writeFile(resolve(work,'rollback.json'),JSON.stringify(current,null,2))
const inputHtml=(await readFile(resolve(base,'deploy/pages-dist/index.html'),'utf8')).replace(/<script\b[^>]*type="module"[^>]*><\/script>/g,'<script type="module" src="/src/main.ts"></script>').replace(/\s*<link\b[^>]*rel="stylesheet"[^>]*>/g,'')
const plugin=()=>({name:'frozen-old-fixes',enforce:'pre',load(id){const path=relative(root,id.split('?')[0]).replaceAll('\\','/');if(snapshot.has(path))return snapshot.get(path);if(/^(app\/src|packages)\//.test(path)&&/\.(ts|json|css)$/.test(path))throw Error('unfrozen_source:'+path);return null}})
process.env.KHIZANA_BUILD_READONLY_SOURCE='1'
const {config}=await loadConfigFromFile({command:'build',mode:'production'},resolve(root,'app/vite.config.ts'))
config.plugins=config.plugins.flat(Infinity).filter(p=>p?.name!=='emit-essential-public-assets')
await build({...config,base:'/',configFile:false,plugins:[plugin(),{name:'frozen-html',transformIndexHtml:{order:'pre',handler:()=>inputHtml}},...config.plugins],worker:{...config.worker,plugins:()=>[plugin()]},build:{...config.build,outDir:resolve(work,'compiled'),emptyOutDir:false}})
const oldOut=resolve(base,'deploy/pages-dist')
await cp(oldOut,out,{recursive:true,errorOnExist:true,force:false,filter:p=>{const name=relative(oldOut,p).replaceAll('\\','/');return name!=='assets'&&!name.startsWith('assets/')&&!['index.html','sw.js','q13-manifest.json'].includes(name)}})
await cp(resolve(work,'compiled/assets'),resolve(out,'assets'),{recursive:true})
const html=await readFile(resolve(work,'compiled/index.html'),'utf8')
await writeFile(resolve(out,'index.html'),html)
await writeFile(resolve(out,'sw.js'),stampServiceWorkerRelease(await readFile(resolve(oldOut,'sw.js'),'utf8'),html))
await cp(resolve(base,'deploy/functions'),resolve(work,'deploy/functions'),{recursive:true})
await cp(resolve(base,'deploy/wrangler.toml'),resolve(work,'deploy/wrangler.toml'))
for(const path of overlay.functions){assert(path.startsWith('alpha-publish/functions/'));const target=resolve(work,'deploy/functions',path.slice('alpha-publish/functions/'.length));await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,reviewedBytes.get(path))}
for(const path of overlay.public){assert(path.startsWith('app/public/'));const target=resolve(out,path.slice('app/public/'.length));await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,path==='app/public/sw.js'?stampServiceWorkerRelease(reviewedBytes.get(path).toString('utf8'),html):reviewedBytes.get(path))}
for(const path of overlay.migrations){assert(path.startsWith('alpha-publish/migrations/'));const target=resolve(work,'deploy/migrations',path.slice('alpha-publish/migrations/'.length));await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,reviewedBytes.get(path))}
await mkdir(resolve(work,'app/public/data'),{recursive:true});await cp(resolve(base,'app/public/data/heading-release.json'),resolve(work,'app/public/data/heading-release.json'))
for(const [path,bytes] of reviewedBytes)assert.equal(sha(await readFile(resolve(root,path))),sha(bytes),'source_changed_during_build:'+path)
await verifyPagesConfiguration(out)
const payload=await inventory(out);await writeFile(resolve(out,'q13-manifest.json'),JSON.stringify({schemaVersion:1,...payload},null,2))
const final=await inventory(out);assert(final.fileCount<=20000,'pages_asset_count_exceeded')
const stage={buildPassed:true,productionReady:false,published:false,version:candidate==='batch32'?'batch-20260916-32':`batch-20260917-${candidate.slice(5)}`,baselineDeploymentId:current.deploymentId,payloadFingerprint:payload.fingerprint,deployFingerprint:final.fingerprint,functionsFingerprint:(await inventory(resolve(work,'deploy/functions'))).fingerprint,overlay,files:final.fileCount,requiredMigrations:overlay.migrations,acceptanceRequired:['isolated migrated edition workflow','combined Chrome preview','field coverage and BOK transaction separate activation gates']}
await writeFile(resolve(work,'stage.json'),JSON.stringify(stage,null,2));console.log(JSON.stringify(stage))
