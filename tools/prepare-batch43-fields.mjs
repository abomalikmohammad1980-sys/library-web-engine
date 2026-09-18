// Frozen batch41 + freshly built repaired client. No cloud writes or activation.
import {readFile,writeFile,mkdir,stat,readdir,link,copyFile} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {PIN} from './field-overlay-upload-plan.mjs'
const safeSearch=process.argv[2]==='--prepare-safe-search',batch=safeSearch?'44':'43'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch41'),app=resolve(root,`.artifacts/batch${batch}-final-app`),out=resolve(root,`.artifacts/batch${batch}`)
const sha=b=>createHash('sha256').update(b).digest('hex')
if(!safeSearch&&process.argv[2]!=='--prepare')throw Error('explicit_prepare_required')
try{await stat(out);throw Error('candidate_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const current=JSON.parse(await readFile(resolve(root,'alpha-publish/ops/current-production.json'),'utf8'))
if(current.deploymentId!=='151af741-5955-4c77-aafb-43189c8d51b0')throw Error('production_baseline_changed')
const rawSource=await readFile(resolve(root,`.artifacts/field-source-ranges-${PIN}/manifest.json`)),sourcePin=sha(rawSource),source=JSON.parse(rawSource)
if(sourcePin!=='22f94a61c287f256af8ddca967140b831c73f56bd9e00d5d062cf7dc26121bb3'||!source.complete||source.counts.books!==8594||source.counts.documents!==7626594)throw Error('reviewed_source_descriptor_required')
const manifest=JSON.parse(await readFile(resolve(base,'static-source-manifest.json'),'utf8')),stage=JSON.parse(await readFile(resolve(base,'stage.json'),'utf8')),snapshot=JSON.parse(await readFile(resolve(base,'source-snapshot.json'),'utf8'))
const newAssets=await readdir(resolve(app,'assets'))
if(newAssets.some(name=>name.includes('/')||name.includes('\\')))throw Error('nested_asset_unreviewed')
const replacements=new Map()
for(const file of newAssets)replacements.set('assets/'+file,await readFile(resolve(app,'assets',file)))
for(const file of ['index.html','sw.js','manifest.webmanifest','theme-init.js'])replacements.set(file,await readFile(resolve(app,file)))
const packed=await readFile(resolve(base,'deploy/pages-dist/data/shamela-search-v2-packed.js'),'utf8')
if(packed.includes('__KHIZANA_SEARCH_FIELDS__'))throw Error('baseline_already_activated')
const binding={complete:true,manifestSha256:PIN,sourceIndexSha256:'a88f1f13ac8f8fd62162b1fa631fd7652874408ac639ab7976984eb034b73381',packedManifestSha256:'b1815eeec97468f791b5a155f43b4f9d85f2d783926d0162bef896397b03f54b',packedReleaseId:'shamela-search-v2-packed-a88f1f13ac8f8fd6-p8-l26213376-t1-r1',expectedBooks:8594,expectedSegments:860}
const activation=`\nglobalThis.__KHIZANA_SEARCH_FIELDS__=Object.freeze({...${JSON.stringify(binding)},manifestUrl:location.origin+'/library/search-fields/${PIN}/manifest.json',sourceRows:Object.freeze({manifestUrl:location.origin+'/library/search-field-source-ranges/${sourcePin}/manifest.json',manifestSha256:'${sourcePin}'})});\n`
replacements.set('data/shamela-search-v2-packed.js',Buffer.from(packed+(safeSearch?'':activation)))
let html=replacements.get('index.html').toString()
if(html.includes('shamela-search-v2-packed.js'))throw Error('unexpected_app_packed_config')
html=html.replace(/(<script type="module")/,'<script src="/data/shamela-search-v2-packed.js"></script>\n    $1')
if(!html.includes('shamela-search-v2-packed.js'))throw Error('missing_module')
replacements.set('index.html',Buffer.from(html))
const sw=replacements.get('sw.js').toString();if(!sw.startsWith("const CACHE = 'alkhizana-shell-v18'"))throw Error('unreviewed_sw')
replacements.set('sw.js',Buffer.from(sw.replace("const CACHE = 'alkhizana-shell-v18'",`const CACHE = 'alkhizana-shell-${safeSearch?'search44':'fields-'+sourcePin.slice(0,8)}'`)))
await mkdir(out,{recursive:true});const next=[]
for(const entry of manifest){
 const original=resolve(base,'deploy/pages-dist',entry.path),bytes=await readFile(original)
 if(sha(bytes)!==entry.sha256||bytes.length!==entry.bytes)throw Error('baseline_changed:'+entry.path)
 if(entry.path.startsWith('assets/')||replacements.has(entry.path))continue
 const target=resolve(out,'deploy/pages-dist',entry.path);await mkdir(dirname(target),{recursive:true})
 if(entry.path.startsWith('data/')||entry.path.startsWith('quran/'))await link(original,target);else await copyFile(original,target)
 next.push({path:entry.path,bytes:bytes.length,sha256:sha(bytes)})
}
for(const [path,bytes] of replacements){const target=resolve(out,'deploy/pages-dist',path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});next.push({path,bytes:bytes.length,sha256:sha(bytes)})}
if(next.length>20000)throw Error('file_budget')
const sources=[...snapshot.files,...stage.sharedSource],seen=new Set()
for(const entry of sources){if(seen.has(entry.path))continue;seen.add(entry.path);const bytes=await readFile(resolve(base,entry.path));if(sha(bytes)!==entry.sha256)throw Error('source_closure_changed');const target=resolve(out,entry.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'})}
next.sort((a,b)=>a.path.localeCompare(b.path));const payloadFingerprint=sha(JSON.stringify(next))
const config=JSON.parse(await readFile(resolve(base,'deploy/wrangler.jsonc'),'utf8'));config.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint;config.env.preview.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint
await writeFile(resolve(out,'deploy/wrangler.jsonc'),JSON.stringify(config,null,2),{flag:'wx'})
await writeFile(resolve(out,'static-source-manifest.json'),JSON.stringify(next,null,2),{flag:'wx'})
await writeFile(resolve(out,'source-snapshot.json'),JSON.stringify({files:sources},null,2),{flag:'wx'})
await writeFile(resolve(out,'rollback.json'),JSON.stringify(current,null,2),{flag:'wx'})
const result={version:`batch-20260918-${batch}`,baselineDeploymentId:current.deploymentId,files:next.length,payloadFingerprint,boundaryPin:PIN,sourcePin,fieldsActivated:!safeSearch,functionsUnchanged:true,productionReady:false,published:false}
await writeFile(resolve(out,'stage.json'),JSON.stringify(result,null,2),{flag:'wx'});console.log(JSON.stringify(result))
