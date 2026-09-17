// Local immutable candidate only. No publication or production pointer writes.
import {readFile,writeFile,mkdir,copyFile,link,stat} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {injectBatch35SearchCandidate} from './inject-batch35-search-candidate.mjs'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch41'),out=resolve(root,'.artifacts/batch42')
const sha=b=>createHash('sha256').update(b).digest('hex')
if(process.argv[2]!=='--prepare')throw Error('explicit_prepare_required')
const current=JSON.parse(await readFile(resolve(root,'alpha-publish/ops/current-production.json'),'utf8'))
if(current.deploymentId!=='151af741-5955-4c77-aafb-43189c8d51b0')throw Error('baseline_changed')
try{await stat(out);throw Error('candidate_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const staticFiles=JSON.parse(await readFile(resolve(base,'static-source-manifest.json'),'utf8'))
const snapshot=JSON.parse(await readFile(resolve(base,'source-snapshot.json'),'utf8'))
const stage=JSON.parse(await readFile(resolve(base,'stage.json'),'utf8'))
const config=JSON.parse(await readFile(resolve(base,'deploy/wrangler.jsonc'),'utf8'))
const transformed=injectBatch35SearchCandidate({html:await readFile(resolve(base,'deploy/pages-dist/index.html'),'utf8'),configSource:await readFile(resolve(root,'tools/batch35-search-candidate-config.js'),'utf8'),candidate:'batch35',serverAcceptance:config.vars})
const next=[]
await mkdir(out,{recursive:true})
for(const item of staticFiles){
 const source=resolve(base,'deploy/pages-dist',item.path),bytes=await readFile(source)
 if(sha(bytes)!==item.sha256||bytes.length!==item.bytes)throw Error('baseline_asset_changed:'+item.path)
 let payload=bytes
 if(item.path==='index.html')payload=Buffer.from(transformed.html)
 if(item.path==='sw.js'){
  if(!bytes.toString().startsWith("const CACHE = 'alkhizana-shell-v18'"))throw Error('sw_baseline_changed')
  payload=Buffer.from(bytes.toString().replace("const CACHE = 'alkhizana-shell-v18'","const CACHE = 'alkhizana-shell-fields-a81347ca'"))
 }
 const target=resolve(out,'deploy/pages-dist',item.path);await mkdir(dirname(target),{recursive:true})
 if(item.path.startsWith('data/')||item.path.startsWith('quran/'))await link(source,target)
 else await writeFile(target,payload,{flag:'wx'})
 next.push({path:item.path,bytes:payload.length,sha256:sha(payload)})
}
const extra=transformed.scriptPath.slice(1),extraPath=resolve(out,'deploy/pages-dist',extra)
await writeFile(extraPath,transformed.scriptSource,{flag:'wx'})
next.push({path:extra,bytes:Buffer.byteLength(transformed.scriptSource),sha256:transformed.scriptSha256})
if(next.length>20000)throw Error('file_budget')
const sources=[...snapshot.files,...stage.sharedSource]
const seen=new Set()
for(const item of sources){
 if(seen.has(item.path))continue;seen.add(item.path)
 const source=resolve(base,item.path),target=resolve(out,item.path)
 if(sha(await readFile(source))!==item.sha256)throw Error('baseline_source_changed:'+item.path)
 await mkdir(dirname(target),{recursive:true});await copyFile(source,target)
}
next.sort((a,b)=>a.path.localeCompare(b.path))
config.vars.SEO_HTML_CACHE_VERSION=sha(JSON.stringify(next))
config.env.preview.vars.SEO_HTML_CACHE_VERSION=config.vars.SEO_HTML_CACHE_VERSION
await writeFile(resolve(out,'deploy/wrangler.jsonc'),JSON.stringify(config,null,2),{flag:'wx'})
await writeFile(resolve(out,'static-source-manifest.json'),JSON.stringify(next,null,2),{flag:'wx'})
await writeFile(resolve(out,'source-snapshot.json'),JSON.stringify({files:sources},null,2),{flag:'wx'})
await writeFile(resolve(out,'rollback.json'),JSON.stringify(current,null,2),{flag:'wx'})
const result={version:'batch-20260917-42',baselineDeploymentId:current.deploymentId,files:next.length,payloadFingerprint:sha(JSON.stringify(next)),functionsUnchanged:true,productionReady:false,published:false,requires:['fresh remote field verification','compiled Functions','preview consumer acceptance','live verification']}
await writeFile(resolve(out,'stage.json'),JSON.stringify(result,null,2),{flag:'wx'})
console.log(JSON.stringify(result))
