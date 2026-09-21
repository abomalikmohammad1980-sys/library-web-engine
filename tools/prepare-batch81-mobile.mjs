import {readFile,writeFile,mkdir,link,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {inlineThemeBootstrap} from './inline-theme-bootstrap.mjs'
import {injectSearchBootstrap} from './search-bootstrap-html.mjs'
import {inlineRoutePreloads} from './route-preload-hints.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch80'),out=resolve(root,'.artifacts/batch81'),app=resolve(root,'.artifacts/mobile-reader-20260921/client-final3')
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
replacements.set('sw.js',Buffer.from(stampServiceWorkerRelease(sw.replace("const CACHE = 'alkhizana-shell-v18'","const CACHE = 'alkhizana-shell-mobile81'"),optimized.index)))
const next=manifest.filter(row=>!row.path.startsWith('assets/')&&!replacements.has(row.path))
if(next.length+replacements.size>20000)throw Error('file_budget:'+String(next.length+replacements.size))
await mkdir(out)
for(const row of next){const bytes=await readFile(resolve(base,'deploy/pages-dist',row.path));if(sha(bytes)!==row.sha256)throw Error('baseline_drift');const path=resolve(out,'deploy/pages-dist',row.path);await mkdir(dirname(path),{recursive:true});await link(resolve(base,'deploy/pages-dist',row.path),path)}
for(const [path,bytes] of replacements){const dest=resolve(out,'deploy/pages-dist',path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});next.push({path,bytes:bytes.length,sha256:sha(bytes)})}
next.sort((a,b)=>a.path.localeCompare(b.path))
const seen=new Set()
for(const row of snapshot.files){const bytes=await readFile(resolve(base,row.path));if(sha(bytes)!==row.sha256)throw Error('source_drift');if(seen.has(row.path))continue;seen.add(row.path);const dest=resolve(out,row.path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'})}
const functionsFingerprint=sha(JSON.stringify(snapshot.files.filter(r=>r.path.startsWith('deploy/functions/')).map(({path,sha256})=>({path,sha256})).sort((a,b)=>a.path.localeCompare(b.path))))
const payloadFingerprint=sha(JSON.stringify(next)),config=await json(resolve(base,'deploy/wrangler.jsonc'))
config.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint;config.env.preview.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint
for(const [name,data] of [['static-source-manifest.json',next],['source-snapshot.json',snapshot],['deploy/wrangler.jsonc',config],['rollback.json',await json(resolve(root,'alpha-publish/ops/current-production.json'))],['stage.json',{...stage,version:'batch-20260921-81',baselineDeploymentId:'96477f82-327d-479a-8e6b-5a27b981dccf',files:next.length,payloadFingerprint,functionsFingerprint,functionsUnchanged:true,productionReady:false,published:false,reason:'Mobile suggestions and worker-based large-book preparation; D1 quota remains external blocker; no field activation'}]])await writeFile(resolve(out,name),JSON.stringify(data,null,2),{flag:'wx'})
console.log(JSON.stringify({files:next.length,payloadFingerprint,functionsFingerprint}))
