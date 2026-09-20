import {readFile,writeFile,mkdir,link,copyFile,stat} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'

const root=resolve(import.meta.dirname,'..')
const previous=resolve(root,'.artifacts/batch61')
const target=resolve(root,'.artifacts/batch62')
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
const manifest=JSON.parse(await readFile(resolve(previous,'static-source-manifest.json')))
const stage=JSON.parse(await readFile(resolve(previous,'stage.json')))
const snapshot=JSON.parse(await readFile(resolve(previous,'source-snapshot.json')))
if(stage.payloadFingerprint!==sha(JSON.stringify(manifest))||stage.files!==20000)throw Error('verified_static_baseline_required')
const changes=new Map([
 ['deploy/functions/_middleware.js','alpha-publish/functions/_middleware.js'],
 ['deploy/functions/_seo-edge-cache.js','alpha-publish/functions/_seo-edge-cache.js'],
])
await mkdir(target,{recursive:true})
for(const entry of manifest){
 const source=resolve(previous,'deploy/pages-dist',entry.path)
 const destination=resolve(target,'deploy/pages-dist',entry.path)
 await mkdir(dirname(destination),{recursive:true})
 try{await link(source,destination)}catch(error){
  if(error?.code!=='EEXIST')throw error
  const [a,b]=await Promise.all([stat(source),stat(destination)])
  if(a.dev!==b.dev||a.ino!==b.ino)throw Error('unexpected_existing_static:'+entry.path)
 }
}
const seen=new Set()
for(const entry of snapshot.files){
 if(seen.has(entry.path)){if(changes.has(entry.path)){const bytes=await readFile(resolve(root,changes.get(entry.path)));entry.sha256=sha(bytes);entry.bytes=bytes.length}continue}
 seen.add(entry.path)
 const source=changes.get(entry.path)?resolve(root,changes.get(entry.path)):resolve(previous,entry.path)
 const bytes=await readFile(source)
 if(!changes.has(entry.path)&&sha(bytes)!==entry.sha256)throw Error('source_snapshot_changed:'+entry.path)
 const destination=resolve(target,entry.path)
 await mkdir(dirname(destination),{recursive:true})
 try{await writeFile(destination,bytes,{flag:'wx'})}catch(error){
  if(error?.code!=='EEXIST'||sha(await readFile(destination))!==sha(bytes))throw error
 }
 if(changes.has(entry.path)){entry.sha256=sha(bytes);entry.bytes=bytes.length}
}
for(const path of changes.keys())if(!snapshot.files.some(row=>row.path===path))throw Error('missing_function:'+path)
const functionRows=snapshot.files.filter(row=>row.path.startsWith('deploy/functions/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path))
const functionsFingerprint=sha(JSON.stringify(functionRows))
const config=JSON.parse(await readFile(resolve(previous,'deploy/wrangler.jsonc')))
config.vars.SEO_HTML_CACHE_VERSION=functionsFingerprint
config.env.preview.vars.SEO_HTML_CACHE_VERSION=functionsFingerprint
await writeFile(resolve(target,'deploy/wrangler.jsonc'),JSON.stringify(config,null,2),{flag:'wx'})
await writeFile(resolve(target,'source-snapshot.json'),JSON.stringify(snapshot,null,2),{flag:'wx'})
await copyFile(resolve(previous,'static-source-manifest.json'),resolve(target,'static-source-manifest.json'))
await copyFile(resolve(previous,'rollback.json'),resolve(target,'rollback.json'))
await writeFile(resolve(target,'stage.json'),JSON.stringify({...stage,version:'batch-20260920-62',functionsFingerprint,productionReady:false,published:false,reason:'D1 quota emergency shell; remove optional landing-page listing reads'},null,2),{flag:'wx'})
console.log(JSON.stringify({version:'batch-20260920-62',files:manifest.length,payloadFingerprint:stage.payloadFingerprint,functionsFingerprint,changed:[...changes.keys()]}))
