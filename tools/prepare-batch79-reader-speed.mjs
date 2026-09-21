import {readFile,writeFile,mkdir,link,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {inlineThemeBootstrap} from './inline-theme-bootstrap.mjs'
import {injectSearchBootstrap} from './search-bootstrap-html.mjs'
import {inlineRoutePreloads} from './route-preload-hints.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch77'),out=resolve(root,'.artifacts/batch79'),app=resolve(root,'.artifacts/reader-speed-20260921/client-pass2')
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p))
const manifest=await json(resolve(base,'static-source-manifest.json')),stage=await json(resolve(base,'stage.json')),snapshot=await json(resolve(base,'source-snapshot.json'))
if(!stage.published||sha(JSON.stringify(manifest))!==stage.payloadFingerprint)throw Error('verified_baseline_required')
const sw=await readFile(resolve(app,'sw.js'),'utf8')
for(const row of await json(resolve(app,'font-cache-map.json')))if(!sw.includes(row.target))throw Error('unfinished_build')
const replacements=new Map()
async function collect(dir){for(const e of await readdir(resolve(app,dir),{withFileTypes:true})){const p=dir+'/'+e.name;if(e.isDirectory())await collect(p);else replacements.set(p,await readFile(resolve(app,p)))}}
await collect('assets')
for(const p of ['theme-init.js','manifest.webmanifest','quran/resources/manifest.json'])replacements.set(p,await readFile(resolve(app,p)))
const optimized=inlineThemeBootstrap(injectSearchBootstrap(await readFile(resolve(app,'index.html'),'utf8'),{defer:true}),await readFile(resolve(base,'deploy/pages-dist/_headers'),'utf8'),replacements.get('theme-init.js').toString())
Object.assign(optimized,inlineRoutePreloads(optimized.index,optimized.headers,await json(resolve(app,'route-preload-hints.json'))))
replacements.set('index.html',Buffer.from(optimized.index));replacements.set('_headers',Buffer.from(optimized.headers))
replacements.set('sw.js',Buffer.from(stampServiceWorkerRelease(sw.replace("const CACHE = 'alkhizana-shell-v18'","const CACHE = 'alkhizana-shell-reader79'"),optimized.index)))
const next=manifest.filter(row=>!row.path.startsWith('assets/')&&!replacements.has(row.path))
if(next.length+replacements.size>20000)throw Error('file_budget')
await mkdir(out)
for(const row of next){const bytes=await readFile(resolve(base,'deploy/pages-dist',row.path));if(sha(bytes)!==row.sha256)throw Error('baseline_drift');const path=resolve(out,'deploy/pages-dist',row.path);await mkdir(dirname(path),{recursive:true});await link(resolve(base,'deploy/pages-dist',row.path),path)}
for(const [path,bytes] of replacements){const dest=resolve(out,'deploy/pages-dist',path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});next.push({path,bytes:bytes.length,sha256:sha(bytes)})}
next.sort((a,b)=>a.path.localeCompare(b.path))
const changed='deploy/functions/_seo-listings.js',seen=new Set()
for(const row of snapshot.files){const bytes=await readFile(resolve(root,row.path===changed?'deployment/cloudflare/functions/_seo-listings.js':'.artifacts/batch77/'+row.path));if(row.path!==changed&&sha(bytes)!==row.sha256)throw Error('source_drift');if(row.path===changed){row.sha256=sha(bytes);row.bytes=bytes.length}if(seen.has(row.path))continue;seen.add(row.path);const dest=resolve(out,row.path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'})}
if(!seen.has(changed))throw Error('missing_changed_function')
const functionsFingerprint=sha(JSON.stringify(snapshot.files.filter(r=>r.path.startsWith('deploy/functions/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path))))
const payloadFingerprint=sha(JSON.stringify(next)),config=await json(resolve(base,'deploy/wrangler.jsonc'))
config.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint;config.env.preview.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint
for(const [name,data] of [['static-source-manifest.json',next],['source-snapshot.json',snapshot],['deploy/wrangler.jsonc',config],['rollback.json',await json(resolve(root,'alpha-publish/ops/current-production.json'))],['stage.json',{...stage,version:'batch-20260921-79',baselineDeploymentId:'1df777d7-7a7b-4d0d-827d-ecab9e747e2b',files:next.length,payloadFingerprint,functionsFingerprint,functionsUnchanged:false,productionReady:false,published:false,reason:'Native text reader flow; parallel verified book assets; compact information actions; scalar SEO override lookups'}]])await writeFile(resolve(out,name),JSON.stringify(data,null,2),{flag:'wx'})
console.log(JSON.stringify({files:next.length,payloadFingerprint,functionsFingerprint}))
