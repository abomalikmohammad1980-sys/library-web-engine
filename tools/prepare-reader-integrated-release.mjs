// Freeze the already-reviewed reader client over the current production data.
// Never edits either input tree; publication remains a separate, verified step.
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {readFile,writeFile,mkdir,readdir,link,cp} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {injectSearchBootstrap} from './search-bootstrap-html.mjs'
import {inlineThemeBootstrap} from './inline-theme-bootstrap.mjs'
import {inlineRoutePreloads} from './route-preload-hints.mjs'
import {inlineEntryCss} from './inline-entry-css.mjs'
import {stampServiceWorkerRelease} from '../alpha-publish/scripts/service-worker-release.mjs'
import {inventory} from '../alpha-publish/scripts/release-integrity.mjs'
import {buildShamelaReaderClientConfig} from './build-shamela-reader-client-config.mjs'

const root=resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex')
const json=async p=>JSON.parse(await readFile(p,'utf8'))
const client=resolve(root,'.artifacts/reader-merged-client-20260925-v8/compiled')
const resources=resolve(root,'.artifacts/reader-preview-app-v4-20260924')
const smoke=process.argv.includes('--smoke-preview')
const out=resolve(root,smoke?'.artifacts/reader-integrated-smoke-20260925-v5':'.artifacts/reader-integrated-20260925-v5')
const plan=process.argv.includes('--plan'),readerBase=process.argv.find(x=>/^https:\/\//.test(x))
const current=await json(resolve(root,'alpha-publish/ops/current-production.json'))
assert.equal(current.version,'batch-20260924-91','production_changed_review_required')
const basePages=resolve(root,'alpha-publish',current.publishedDirectory)
const base=resolve(basePages,'../..')
assert(base.startsWith(resolve(root,'.artifacts')+'/')||base.startsWith(resolve(root,'.artifacts')+'\\'),'invalid_baseline_path')
const prior=await json(resolve(base,'inventory.json'))
const previous=await json(resolve(root,'alpha-publish/ops',current.receipt))
assert.equal(sha(JSON.stringify(prior)),previous.payloadFingerprint,'baseline_inventory_drift')
const replacement=new Map()
async function collect(relative){for(const e of await readdir(resolve(client,relative),{withFileTypes:true})){
 const path=relative+'/'+e.name
 if(e.isDirectory())await collect(path)
 else {assert(e.isFile(),'non_file_client_asset');replacement.set(path,await readFile(resolve(client,path)))}
}}
await collect('assets')
for(const path of ['theme-init.js','manifest.webmanifest','quran/resources/manifest.json','fonts/quran/kfgqpc-hafs-regular.otf','font-cache-map.json','morphology/alkhalil/DATA.Derived.Nouns.PartOfSpeech.Number2.list.jsonl.gz','morphology/alkhalil/DATA.Derived.Verbs.PartOfSpeech.Emphasized2.list.jsonl.gz'])replacement.set(path,await readFile(resolve(resources,path)))
let headers=await readFile(resolve(basePages,'_headers'),'utf8')
// Remove stale inline-script hashes before pinning this client's exact bytes.
headers=headers.replace(/ 'sha256-[A-Za-z0-9+/=]+'/g,'')
if(!plan){
 assert(/^https:\/\/[a-f0-9]{8}\.khezana-reader-01\.pages\.dev\/?$/.test(readerBase??''),'immutable_reader_deployment_required')
 assert(smoke?readerBase==='https://689e316e.khezana-reader-01.pages.dev':!readerBase.includes('689e316e'),'three_book_smoke_is_not_a_release')
 const cfg=smoke?await json(resolve(root,'.artifacts/reader-smoke-public-20260924/data/shamela-pages-release.json')):await buildShamelaReaderClientConfig({releaseManifest:resolve(root,'.artifacts/pages-reader-extended-20260924/601fbdb9ac80f05dd86d2383/release-manifest.json'),sidecars:resolve(root,'.artifacts/shamela-reader-shards-extended-20260924'),baseUrl:readerBase})
 assert.equal(cfg.releaseId,smoke?'5b97084a5b2b060f0c9fc831':'601fbdb9ac80f05dd86d2383')
 assert.equal(Object.keys(cfg.directReaderShards.routeSha256).length,1788)
 if(smoke)cfg.directReaderShards.routeSha256=Object.fromEntries(Object.entries(cfg.directReaderShards.routeSha256).filter(([path])=>/\/books\/(88|907|5678)\/route\.json$/.test(path)))
 replacement.set('data/shamela-pages-release.json',Buffer.from(JSON.stringify(cfg)+'\n'))
 headers=headers.replace("connect-src 'self' http://localhost:43129;",`connect-src 'self' http://localhost:43129 ${new URL(readerBase).origin};`)
 assert(headers.includes(new URL(readerBase).origin),'reader_csp_missing')
}else replacement.set('data/shamela-pages-release.json',Buffer.from('{}'))
const shell=inlineThemeBootstrap(injectSearchBootstrap(await readFile(resolve(client,'index.html'),'utf8'),{defer:true}),
 headers,replacement.get('theme-init.js').toString())
shell.index=await inlineEntryCss(shell.index,path=>readFile(resolve(client,path),'utf8'),{preservePreloadIdentity:true})
Object.assign(shell,inlineRoutePreloads(shell.index,shell.headers,await json(resolve(client,'route-preload-hints.json'))))
replacement.set('index.html',Buffer.from(shell.index));replacement.set('_headers',Buffer.from(shell.headers))
replacement.set('sw.js',Buffer.from(stampServiceWorkerRelease(await readFile(resolve(basePages,'sw.js'),'utf8'),shell.index)))
const retained=prior.filter(r=>!r.path.startsWith('assets/')&&r.path!=='q13-manifest.json'&&!replacement.has(r.path))
assert(retained.length+replacement.size+1<=20000,'pages_file_limit:'+String(retained.length+replacement.size+1))
if(plan){console.log(JSON.stringify({plannedFiles:retained.length+replacement.size+1,clientAssets:[...replacement.keys()].filter(p=>p.startsWith('assets/')).length,baseline:current.version,output:out,waitingFor:'full immutable reader deployment; no files written'}));process.exit(0)}
await mkdir(out) // Fail closed if a candidate already exists.
const put=async(path,bytes)=>{const target=resolve(out,path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'})}
for(const row of retained){
 assert(!row.path.includes('..')&&!row.path.startsWith('/'),'unsafe_inventory_path')
 const source=resolve(basePages,row.path),bytes=await readFile(source)
 assert.equal(sha(bytes),row.sha256,`baseline_drift:${row.path}`)
 const target=resolve(out,'deploy/pages-dist',row.path);await mkdir(dirname(target),{recursive:true});await link(source,target)
}
for(const [path,bytes] of replacement)await put('deploy/pages-dist/'+path,bytes)
// Retain production-generated routes and their support modules (notably the
// PUBLIC_LIBRARY_R2 heading route). Overlay only the reviewed server changes.
for(const path of ['deploy/functions','deploy/server','app','packages'])await cp(resolve(base,path),resolve(out,path),{recursive:true,errorOnExist:true,force:false})
const functions=['api/_account-contract.js','api/_book-intake.js','api/_jpeg-source.js','api/account/books.js','api/account/books/[bookId].js','api/account/books/[bookId]/file.js','api/account/books/[bookId]/metadata.js','api/library/author-names.js','api/library/categories.js','api/library/central-authors.js','api/library/central-overrides.js','api/library/published-books.js','api/library/attachments.js','api/library/attachments/[attachmentId].js']
for(const path of functions){const target=resolve(out,'deploy/functions',path);await mkdir(dirname(target),{recursive:true});await writeFile(target,await readFile(resolve(root,'deployment/cloudflare/functions',path)))}
for(const [path,source] of [['0042_download_attachments.sql','deployment/cloudflare/migrations'],['0043_html_companion_resources.sql','alpha-publish/migrations']])await put('migrations/'+path,await readFile(resolve(root,source,path)))
const config=await json(resolve(base,'deploy/wrangler.jsonc'))
config.pages_build_output_dir='./pages-dist'
// Same production bindings; previews keep the existing isolated D1/R2 bindings.
await put('deploy/wrangler.jsonc',JSON.stringify(config,null,2))
const pages=resolve(out,'deploy/pages-dist'),payload=await inventory(pages)
config.vars.SEO_HTML_CACHE_VERSION=payload.fingerprint
config.env.preview.vars.SEO_HTML_CACHE_VERSION=payload.fingerprint
await writeFile(resolve(out,'deploy/wrangler.jsonc'),JSON.stringify(config,null,2))
await put('deploy/pages-dist/q13-manifest.json',JSON.stringify({schemaVersion:1,...payload}))
const deployed=await inventory(pages),server=await inventory(resolve(out,'deploy/functions'))
assert(deployed.fileCount<=20000&&deployed.maxFileBytes<=25*1024*1024)
await put('inventory.json',JSON.stringify(deployed.files))
await put('candidate.json',JSON.stringify({createdAt:new Date().toISOString(),published:false,productionReady:false,smokeOnly:smoke,baseline:current.version,rollback:current,readerBase,readerBooks:smoke?3:1788,files:deployed.fileCount,payloadFingerprint:payload.fingerprint,deployFingerprint:deployed.fingerprint,functionsFingerprint:server.fingerprint,overlaidFunctions:functions,requiredGates:['remote reader hashes','isolated integrated preview','production migrations 0042/0043','source sync','live verification']},null,2))
console.log(JSON.stringify({output:out,files:deployed.fileCount,deployFingerprint:deployed.fingerprint,productionReady:false}))
