// Explicit bounded refresh. Immutable corpus and Functions remain untouched.
import {readFile,writeFile,readdir,mkdir,copyFile,unlink,realpath,lstat} from 'node:fs/promises'
import {resolve,relative,dirname,sep} from 'node:path'
import {createHash} from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),candidate=resolve(root,'.artifacts/batch41'),pages=resolve(candidate,'deploy/pages-dist'),source=resolve(root,'.artifacts/batch41-final-app'),sha=b=>createHash('sha256').update(b).digest('hex')
if(process.argv[2]!=='--apply')throw Error('explicit_refresh_apply_required')
const manifestPath=resolve(candidate,'static-source-manifest.json'),stagePath=resolve(candidate,'stage.json'),manifest=JSON.parse(await readFile(manifestPath,'utf8')),stage=JSON.parse(await readFile(stagePath,'utf8'))
if(stage.published||stage.baselineDeploymentId!=='214d9565-f244-41d5-af51-e86309c463ce')throw Error('candidate_not_refreshable')
const actualPages=await realpath(pages),assetsRoot=resolve(actualPages,'assets')
async function safeTarget(path){const target=resolve(pages,path),rel=relative(actualPages,target);if(rel.startsWith('..')||rel.includes(':')||!rel)throw Error('target_outside_candidate');const parent=await realpath(dirname(target));if(parent!==actualPages&&!parent.startsWith(actualPages+sep))throw Error('target_parent_escaped');try{if((await lstat(target)).isSymbolicLink())throw Error('target_symlink')}catch(e){if(e.code!=='ENOENT')throw e}return target}
async function files(dir,prefix=''){const list=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('source_symlink');list.push(...e.isDirectory()?await files(resolve(dir,e.name),prefix+e.name+'/'):[prefix+e.name])}return list.sort()}
const replacements=new Map(),rootFiles=['index.html','sw.js','manifest.webmanifest','theme-init.js']
for(const name of await files(resolve(source,'assets')))replacements.set('assets/'+name,await readFile(resolve(source,'assets',name)))
for(const name of rootFiles)replacements.set(name,await readFile(resolve(source,name)))
let html=replacements.get('index.html').toString(),script='<script src="/data/shamela-search-v2-packed.js"></script>'
html=html.replace(/\s*<script\s+src=["'][^"']*shamela-search-v2-packed\.js["']\s*><\/script>/g,'').replace(/(<script type="module")/,script+'\n    $1')
if((html.match(/shamela-search-v2-packed\.js/g)||[]).length!==1)throw Error('packed_configuration_missing')
replacements.set('index.html',Buffer.from(html))
for(const m of html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)/g))if(!replacements.has(m[1].slice(1)))throw Error('new_entry_asset_missing')
const oldAssets=manifest.filter(x=>x.path.startsWith('assets/')),next=manifest.filter(x=>!x.path.startsWith('assets/')&&!rootFiles.includes(x.path))
if(next.length+replacements.size>20000)throw Error('asset_budget_exceeded:'+String(next.length+replacements.size))
for(const row of [...oldAssets,...manifest.filter(x=>rootFiles.includes(x.path))])if(sha(await readFile(await safeTarget(row.path)))!==row.sha256)throw Error('candidate_was_modified:'+row.path)
const archive=resolve(candidate,'metadata-history',new Date().toISOString().replaceAll(':','-'));await mkdir(archive,{recursive:true})
for(const name of ['stage.json','static-source-manifest.json','functions-manifest.json','preview-verification.json','preview-check.json'])try{await copyFile(resolve(candidate,name),resolve(archive,name))}catch(e){if(e.code!=='ENOENT')throw e}
// No recursive delete: exact old candidate asset paths were resolved and verified.
for(const row of oldAssets)if(!replacements.has(row.path)){const target=await safeTarget(row.path);if(!target.startsWith(assetsRoot+sep))throw Error('asset_delete_outside_candidate');await unlink(target)}
for(const [path,bytes] of replacements){const target=resolve(pages,path);await mkdir(dirname(target),{recursive:true});await safeTarget(path);await writeFile(target,bytes);next.push({path,source:relative(root,resolve(source,path)).replaceAll('\\','/'),bytes:bytes.length,sha256:sha(bytes),...(path==='index.html'?{transform:'one absolute packed search configuration before application'}:{})})}
next.sort((a,b)=>a.path.localeCompare(b.path));stage.files=next.length;stage.payloadFingerprint=sha(JSON.stringify(next.map(({path,bytes,sha256})=>({path,bytes,sha256}))));stage.appRefreshedAt=new Date().toISOString();stage.appBuildSource=relative(root,source).replaceAll('\\','/');stage.previewChecksStale=true;stage.productionReady=false
await writeFile(manifestPath,JSON.stringify(next,null,2));await writeFile(stagePath,JSON.stringify(stage,null,2))
console.log(JSON.stringify({files:stage.files,payloadFingerprint:stage.payloadFingerprint,archive,functionsUnchanged:true,corpusUnchanged:true,previewChecksStale:true}))
