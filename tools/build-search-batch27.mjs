import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises'
import {resolve,relative} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {build,loadConfigFromFile} from 'vite'
import {inventory,verifyPagesConfiguration} from '../alpha-publish/scripts/release-integrity.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch26'),work=resolve(root,'.artifacts/batch27'),out=resolve(work,'deploy/pages-dist')
const read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex')
const current=await read(resolve(root,'alpha-publish/ops/current-production.json'))
assert.equal(current.deploymentId,'036ced36-8bb4-4120-9349-c3eedbd899d8')
try{await stat(work);throw Error('candidate_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const previous=await read(resolve(root,'alpha-publish/ops',current.receipt))
assert.equal((await inventory(resolve(base,'deploy/pages-dist'))).fingerprint,previous.deployFingerprint)
const changed=new Set(['app/src/heading_catalog_supplement.ts','app/src/screens/search.ts'])
const snapshot=new Map(),files=[]
for(const file of (await read(resolve(base,'source-snapshot.json'))).files){
 const old=await readFile(resolve(base,file.path));assert.equal(sha(old),file.sha256)
 const bytes=changed.has(file.path)?await readFile(resolve(root,file.path)):old
 snapshot.set(file.path,bytes.toString('utf8'));files.push({path:file.path,sha256:sha(bytes),changed:changed.has(file.path)})
 await mkdir(resolve(work,file.path,'..'),{recursive:true});await writeFile(resolve(work,file.path),bytes)
}
await writeFile(resolve(work,'source-snapshot.json'),JSON.stringify({baseline:current.deploymentId,files},null,2))
await writeFile(resolve(work,'rollback.json'),JSON.stringify({...current,receipt:previous},null,2))
const inputHtml=(await readFile(resolve(base,'deploy/pages-dist/index.html'),'utf8')).replace(/<script\b[^>]*type="module"[^>]*><\/script>/g,'<script type="module" src="/src/main.ts"></script>').replace(/\s*<link\b[^>]*rel="stylesheet"[^>]*>/g,'')
const plugin=()=>({name:'frozen-search-repair',enforce:'pre',load(id){const path=relative(root,id.split('?')[0]).replaceAll('\\','/');if(snapshot.has(path))return snapshot.get(path);if(/^(app\/src|packages)\//.test(path)&&/\.(ts|json|css)$/.test(path))throw Error('unfrozen_source:'+path);return null}})
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
await mkdir(resolve(work,'app/public/data'),{recursive:true});await cp(resolve(base,'app/public/data/heading-release.json'),resolve(work,'app/public/data/heading-release.json'))
await verifyPagesConfiguration(out)
const payload=await inventory(out);await writeFile(resolve(out,'q13-manifest.json'),JSON.stringify({schemaVersion:1,...payload},null,2))
const final=await inventory(out);assert(final.fileCount<=20000)
const functionsFingerprint=(await inventory(resolve(work,'deploy/functions'))).fingerprint;assert.equal(functionsFingerprint,previous.functionsFingerprint)
const stage={passed:true,published:false,version:'batch-20260916-27',baselineDeploymentId:current.deploymentId,payloadFingerprint:payload.fingerprint,deployFingerprint:final.fingerprint,functionsFingerprint,changed:[...changed],files:final.fileCount,productionMigrations:[]}
await writeFile(resolve(work,'stage.json'),JSON.stringify(stage,null,2));console.log(JSON.stringify(stage))
