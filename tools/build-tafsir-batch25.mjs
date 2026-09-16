import {readFile,writeFile,mkdir,stat,cp} from 'node:fs/promises'
import {resolve,relative,sep} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from 'vite'
import {inventory,verifyPagesConfiguration} from '../alpha-publish/scripts/release-integrity.mjs'
import {wireSearchBootstrap} from '../alpha-publish/scripts/search-bootstrap.mjs'
import {stampServiceWorkerRelease,assertServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'

const root=resolve(import.meta.dirname,'..'),work=resolve(root,'.artifacts/batch25'),out=resolve(work,'deploy/pages-dist')
const sha=b=>createHash('sha256').update(b).digest('hex'),read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'))
try{await stat(work);throw Error('candidate_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const current=await read('alpha-publish/ops/current-production.json'),receipt=await read('alpha-publish/ops/'+current.receipt)
assert.equal(current.deploymentId,'11db8ddb-32c5-4635-9b3b-a0a414d1d1ea')
const base=resolve(root,'alpha-publish',current.publishedDirectory)
assert.equal((await inventory(base)).fingerprint,receipt.deployFingerprint)
const review=resolve(root,'artifacts/six-requested-tafsirs-20260915/review-package')
const handoffBytes=await readFile(resolve(review,'handoff.json')),handoff=JSON.parse(handoffBytes)
for(const name of ['unlinked-publication-acceptance.json','http-ui-acceptance.json']){
 const acceptance=JSON.parse(await readFile(resolve(review,name)))
 assert(acceptance.passed);assert.equal(acceptance.handoffSha256,sha(handoffBytes),name+' stale')
}
assert.equal(handoff.sourceOverrides.length,7);assert.equal(handoff.dataOverlay.length,12)
const overrides=new Map()
for(const item of handoff.sourceOverrides){const bytes=await readFile(item.source);assert.equal(sha(bytes),item.sha256);overrides.set(item.target,bytes.toString('utf8'))}
const baseline=await read('.artifacts/batch24/source-snapshot.json'),snapshot=new Map(),files=[]
for(const record of baseline.files){
 const path=record.path.replaceAll('\\','/'),bytes=await readFile(resolve(root,'.artifacts/batch24/frozen-source',path));assert.equal(sha(bytes),record.sha256)
 const text=overrides.get(path)??bytes.toString('utf8');snapshot.set(path,text)
 files.push({path,sha256:sha(text),changed:sha(text)!==record.sha256});overrides.delete(path)
}
for(const [path,text] of overrides){snapshot.set(path,text);files.push({path,sha256:sha(text),changed:true})}
await mkdir(work,{recursive:true})
for(const [path,text] of snapshot){const target=resolve(work,path);assert(target.startsWith(work+sep));await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,text)}
await writeFile(resolve(work,'source-snapshot.json'),JSON.stringify({baseline:current.deploymentId,files},null,2))
await writeFile(resolve(work,'rollback.json'),JSON.stringify({...current,receipt,retainedDirectory:base},null,2))
const baselineHtml=await readFile(resolve(base,'index.html'),'utf8')
const inputHtml=baselineHtml.replace(/<script\b[^>]*type="module"[^>]*><\/script>/g,'<script type="module" src="/src/main.ts"></script>').replace(/\s*<link\b[^>]*rel="stylesheet"[^>]*>/g,'')
const plugin=()=>({name:'frozen-batch24-with-reviewed-tafsir',enforce:'pre',load(id){
 const absolute=id.split('?')[0].replaceAll('\\','/'),path=relative(root,absolute).replaceAll('\\','/')
 if(snapshot.has(path))return snapshot.get(path)
 if(/^(app\/src|packages)\//.test(path)&&/\.(ts|json|css)$/.test(path))throw Error('unfrozen_source:'+path)
 return null
}})
process.env.KHIZANA_BUILD_READONLY_SOURCE='1'
const loaded=await loadConfigFromFile({command:'build',mode:'production'},resolve(root,'app/vite.config.ts'));assert(loaded)
const config=loaded.config,compiled=resolve(work,'compiled')
config.plugins=config.plugins.flat(Infinity).filter(p=>p?.name!=='emit-essential-public-assets')
await build({...config,base:'./',configFile:false,plugins:[plugin(),{name:'retained-production-html',transformIndexHtml:{order:'pre',handler:()=>inputHtml}},...config.plugins],worker:{...config.worker,plugins:()=>[plugin()]},build:{...config.build,outDir:compiled,emptyOutDir:false}})
const code=p=>p==='assets'||p.startsWith('assets/')||['index.html','sw.js','q13-manifest.json'].includes(p)
await cp(base,out,{recursive:true,errorOnExist:true,force:false,filter:p=>!code(relative(base,p).replaceAll('\\','/'))})
await cp(resolve(compiled,'assets'),resolve(out,'assets'),{recursive:true,errorOnExist:true,force:false})
const html=wireSearchBootstrap(await readFile(resolve(compiled,'index.html'),'utf8')),sw=stampServiceWorkerRelease(await readFile(resolve(base,'sw.js'),'utf8'),html)
assertServiceWorkerRelease(sw,html);await writeFile(resolve(out,'index.html'),html);await writeFile(resolve(out,'sw.js'),sw)
const changedData=new Set()
for(const item of handoff.dataOverlay){
 const bytes=await readFile(item.source);assert.equal(sha(bytes),item.sha256)
 const target=resolve(out,item.target);assert(target.startsWith(out+sep));await mkdir(resolve(target,'..'),{recursive:true});await writeFile(target,bytes);changedData.add(item.target)
}
await verifyPagesConfiguration(out)
const payload=await inventory(out),prior=JSON.parse(await readFile(resolve(base,'q13-manifest.json'))),old=new Map(prior.files.map(f=>[f.path,f]))
for(const file of payload.files)if(!code(file.path)&&!changedData.has(file.path))assert.deepEqual(file,old.get(file.path),'unrelated_data_changed:'+file.path)
for(const file of prior.files)if(!code(file.path))assert(payload.files.some(f=>f.path===file.path),'data_removed:'+file.path)
await writeFile(resolve(out,'q13-manifest.json'),JSON.stringify({schemaVersion:1,...payload},null,2))
const final=await inventory(out);assert(final.fileCount<=20000);assert(final.maxFileBytes<=25*1024*1024)
const baseFunctions=resolve(root,'alpha-publish',receipt.functionsSnapshot);assert.equal((await inventory(baseFunctions)).fingerprint,receipt.functionsFingerprint)
await cp(baseFunctions,resolve(work,'deploy/functions'),{recursive:true,errorOnExist:true,force:false})
await cp(resolve(root,'alpha-publish/wrangler.toml'),resolve(work,'deploy/wrangler.toml'))
await mkdir(resolve(work,'app/public/data'),{recursive:true});await cp(resolve(base,'data/heading-release.json'),resolve(work,'app/public/data/heading-release.json'))
const report={passed:true,published:false,version:'batch-20260916-25',out,files:final.fileCount,payloadFingerprint:payload.fingerprint,deployFingerprint:final.fingerprint,functionsFingerprint:receipt.functionsFingerprint,baselineDeploymentId:current.deploymentId,handoffSha256:sha(handoffBytes),changed:files.filter(f=>f.changed).map(f=>f.path),dataChanges:[...changedData],productionMigrations:[],seoIncluded:false}
await writeFile(resolve(work,'stage.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report))
