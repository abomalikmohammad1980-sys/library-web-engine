import {readFile,writeFile,mkdir,link,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {inlineThemeBootstrap} from './inline-theme-bootstrap.mjs'
import {injectSearchBootstrap} from './search-bootstrap-html.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
const batch=process.argv[2]??'64';if(!['64','65'].includes(batch))throw Error('reviewed_batch_required')
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch63'),out=resolve(root,'.artifacts/batch'+batch),app=resolve(root,'.artifacts/performance-20260920/client-pass'+(batch==='65'?'9':'8'))
const sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p))
const manifest=await json(resolve(base,'static-source-manifest.json')),stage=await json(resolve(base,'stage.json')),snapshot=await json(resolve(base,'source-snapshot.json'))
if(!stage.published||sha(JSON.stringify(manifest))!==stage.payloadFingerprint)throw Error('published_baseline_required')
const replacements=new Map()
async function collect(dir){for(const entry of await readdir(resolve(app,dir),{withFileTypes:true})){const p=dir+'/'+entry.name;if(entry.isDirectory())await collect(p);else replacements.set(p,await readFile(resolve(app,p)))}}
await collect('assets')
for(const p of ['theme-init.js','manifest.webmanifest','quran/resources/manifest.json'])replacements.set(p,await readFile(resolve(app,p)))
const optimized=inlineThemeBootstrap(injectSearchBootstrap(await readFile(resolve(app,'index.html'),'utf8'),{defer:true}),await readFile(resolve(base,'deploy/pages-dist/_headers'),'utf8'),replacements.get('theme-init.js').toString())
replacements.set('index.html',Buffer.from(optimized.index));replacements.set('_headers',Buffer.from(optimized.headers))
replacements.set('sw.js',Buffer.from(stampServiceWorkerRelease((await readFile(resolve(app,'sw.js'),'utf8')).replace("const CACHE = 'alkhizana-shell-v18'",`const CACHE = 'alkhizana-shell-search${batch}'`),optimized.index)))
// Two morphology files have identical verified bytes. Preserve both request
// URLs through an explicit redirect; free one physical slot for the lazy chunk.
const alias='morphology/alkhalil/DATA.Derived.Verbs.PartOfSpeech.Emphasized2.list.jsonl.gz',canonical='morphology/alkhalil/DATA.Derived.Verbs.PartOfSpeech.Emphasized.list.jsonl.gz'
const a=manifest.find(r=>r.path===alias),b=manifest.find(r=>r.path===canonical)
if(!a||!b||a.sha256!==b.sha256||a.bytes!==b.bytes)throw Error('alias_bytes_not_identical')
replacements.set('_redirects',Buffer.from((await readFile(resolve(base,'deploy/pages-dist/_redirects'),'utf8'))+'\n/'+alias+' /'+canonical+' 301\n'))
await mkdir(out)
const next=[]
for(const row of manifest){if(row.path.startsWith('assets/')||replacements.has(row.path)||row.path===alias)continue;const dest=resolve(out,'deploy/pages-dist',row.path);await mkdir(dirname(dest),{recursive:true});await link(resolve(base,'deploy/pages-dist',row.path),dest);next.push(row)}
for(const [path,bytes] of replacements){const dest=resolve(out,'deploy/pages-dist',path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'});next.push({path,bytes:bytes.length,sha256:sha(bytes)})}
if(next.length>20000)throw Error('file_budget');next.sort((a,b)=>a.path.localeCompare(b.path))
const seen=new Set();for(const row of snapshot.files){if(seen.has(row.path))continue;seen.add(row.path);const bytes=await readFile(resolve(base,row.path));if(sha(bytes)!==row.sha256)throw Error('source_snapshot_mismatch');const dest=resolve(out,row.path);await mkdir(dirname(dest),{recursive:true});await writeFile(dest,bytes,{flag:'wx'})}
const payloadFingerprint=sha(JSON.stringify(next)),config=await json(resolve(base,'deploy/wrangler.jsonc'))
config.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint;config.env.preview.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint
for(const [name,data] of [['static-source-manifest.json',next],['source-snapshot.json',snapshot],['deploy/wrangler.jsonc',config],['rollback.json',await json(resolve(root,'alpha-publish/ops/current-production.json'))],['stage.json',{...stage,version:'batch-20260920-'+batch,baselineDeploymentId:'8844e864-5caf-436f-a7aa-f271cd565295',files:next.length,payloadFingerprint,functionsUnchanged:true,productionReady:false,published:false,reason:'Quran mode-only redraw; default reading; lazy reviewed book links; identical morphology alias; optional Sunnah enrichment after first paint'}]])await writeFile(resolve(out,name),JSON.stringify(data,null,2),{flag:'wx'})
console.log(JSON.stringify({batch,files:next.length,payloadFingerprint,alias,canonical}))
