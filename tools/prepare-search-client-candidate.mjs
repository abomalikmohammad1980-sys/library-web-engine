// Reuse the immutable, verified data payload; replace only the built client.
import {readFile,writeFile,mkdir,copyFile,link,readdir} from 'node:fs/promises'
import {resolve,dirname} from 'node:path'
import {createHash} from 'node:crypto'
import {positionFilterConfig} from './position-filter-config.mjs'
import {usePublicHeadingBucket} from '../server/public-heading-preview.mjs'
import {injectSearchBootstrap} from './search-bootstrap-html.mjs'
import {scopeStaticCacheHeaders} from './static-cache-headers.mjs'
const batch=process.argv[2];if(!['51','52','53','54','55','56','57','58','59'].includes(batch))throw Error('reviewed_batch_required')
const performanceBatch=['56','57','58','59'].includes(batch)
const base='.artifacts/batch'+(performanceBatch?'55':batch==='55'?'54':'49'),out='.artifacts/batch'+batch,app=performanceBatch?'.artifacts/performance-20260918/client-pass'+(batch==='59'?'4':'3'):'.artifacts/batch'+(batch==='54'?'53':batch)+'-final-app',sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=JSON.parse(await readFile(base+'/static-source-manifest.json')),stage=JSON.parse(await readFile(base+'/stage.json')),snapshot=JSON.parse(await readFile(base+'/source-snapshot.json')),current=JSON.parse(await readFile('alpha-publish/ops/current-production.json'))
if(batch==='55'||performanceBatch){const receipt=JSON.parse(await readFile(base+'/deployment.json'));if(receipt.deploymentId!==current.deploymentId)throw Error('baseline_changed');stage.baselineDeploymentId=current.deploymentId}
if(stage.payloadFingerprint!==sha(JSON.stringify(manifest))||stage.baselineDeploymentId!==current.deploymentId)throw Error('baseline_changed')
const replacements=new Map()
const packedScript=await readFile(base+'/deploy/pages-dist/data/shamela-search-v2-packed.js','utf8'),filters=JSON.stringify(await positionFilterConfig('https://position.invalid')).replace(/"https:\/\/position\.invalid([^\"]*)"/g,(_,path)=>'location.origin+'+JSON.stringify(path))
if(batch!=='55'&&!performanceBatch)replacements.set('data/shamela-search-v2-packed.js',Buffer.from(packedScript+'\nglobalThis.__SHAMELA_SEARCH_V2_PACKED__=Object.freeze({...globalThis.__SHAMELA_SEARCH_V2_PACKED__,positionFilters:'+filters+'});\n'))
async function collectAssets(relative){for(const entry of await readdir(app+'/'+relative,{withFileTypes:true})){const path=relative+'/'+entry.name;if(entry.isDirectory())await collectAssets(path);else if(entry.isFile())replacements.set(path,await readFile(app+'/'+path));else throw Error('asset_type')}}
await collectAssets('assets')
const retired=new Set()
if(performanceBatch){
 const fonts=JSON.parse(await readFile(app+'/font-cache-map.json'))
 if(fonts.length!==16)throw Error('font_coverage_changed')
 for(const row of fonts){const original=row.original.slice(1),old=manifest.find(entry=>entry.path===original),bytes=replacements.get(row.target);if(!old||!bytes||sha(bytes)!==old.sha256||bytes.length!==old.bytes)throw Error('font_bytes_changed');retired.add(original)}
 replacements.set('_redirects',await readFile(app+'/_redirects'))
 replacements.set('quran/resources/manifest.json',await readFile(app+'/quran/resources/manifest.json'))
}
for(const name of ['index.html','sw.js','manifest.webmanifest','theme-init.js'])replacements.set(name,await readFile(app+'/'+name))
const html=replacements.get('index.html').toString();if(html.includes('shamela-search-v2-packed.js')||!html.includes('<script type="module"'))throw Error('html_changed')
replacements.set('index.html',Buffer.from(injectSearchBootstrap(html,{defer:['57','58','59'].includes(batch)})))
if(['58','59'].includes(batch))replacements.set('_headers',Buffer.from(scopeStaticCacheHeaders(await readFile(base+'/deploy/pages-dist/_headers','utf8'),manifest.map(row=>row.path))))
const sw=replacements.get('sw.js').toString();if(!sw.startsWith("const CACHE = 'alkhizana-shell-v18'"))throw Error('sw_changed');replacements.set('sw.js',Buffer.from(sw.replace("const CACHE = 'alkhizana-shell-v18'",`const CACHE = 'alkhizana-shell-search${batch}'`)))
await mkdir(out);const next=[]
for(const entry of manifest){if(entry.path.startsWith('assets/')||replacements.has(entry.path)||retired.has(entry.path))continue;if(entry.path.includes('..')||entry.path.startsWith('/'))throw Error('unsafe_path');const target=resolve(out,'deploy/pages-dist',entry.path);await mkdir(dirname(target),{recursive:true});await link(resolve(base,'deploy/pages-dist',entry.path),target);next.push(entry)}
for(const [path,bytes]of replacements){const target=resolve(out,'deploy/pages-dist',path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'});next.push({path,bytes:bytes.length,sha256:sha(bytes)})}
if(next.length>20000)throw Error('file_budget');next.sort((a,b)=>a.path.localeCompare(b.path));const payloadFingerprint=sha(JSON.stringify(next)),seen=new Set()
for(const entry of snapshot.files){if(seen.has(entry.path))continue;seen.add(entry.path);let bytes=await readFile(resolve(base,entry.path));if(sha(bytes)!==entry.sha256)throw Error('function_changed');if(batch==='54'&&entry.path==='deploy/functions/api/search/headings/[[path]].js'){bytes=Buffer.from(usePublicHeadingBucket(bytes.toString()));entry.sha256=sha(bytes);if('bytes' in entry)entry.bytes=bytes.length;if('byteLength' in entry)entry.byteLength=bytes.length}const target=resolve(out,entry.path);await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx'})}
const config=JSON.parse(await readFile(base+'/deploy/wrangler.jsonc'));config.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint;config.env.preview.vars.SEO_HTML_CACHE_VERSION=payloadFingerprint
await writeFile(out+'/deploy/wrangler.jsonc',JSON.stringify(config,null,2),{flag:'wx'});await writeFile(out+'/source-snapshot.json',JSON.stringify(snapshot,null,2),{flag:'wx'});await copyFile(base+'/rollback.json',out+'/rollback.json')
await writeFile(out+'/static-source-manifest.json',JSON.stringify(next,null,2),{flag:'wx'});await writeFile(out+'/stage.json',JSON.stringify({...stage,version:'batch-20260918-'+batch,files:next.length,payloadFingerprint,productionReady:false,published:false},null,2),{flag:'wx'})
console.log(JSON.stringify({batch,files:next.length,payloadFingerprint}))
