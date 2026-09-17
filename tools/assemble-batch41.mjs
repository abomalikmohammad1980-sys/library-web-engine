// One reviewed local candidate. No network, credentials, publication or baseline writes.
import {mkdir,readdir,readFile,writeFile,copyFile,link,stat} from 'node:fs/promises'
import {resolve,dirname,relative} from 'node:path'
import {createHash} from 'node:crypto'
import {execFileSync} from 'node:child_process'
const repo=resolve(import.meta.dirname,'..'),out=resolve(repo,'.artifacts/batch41'),base=resolve(repo,'.artifacts/batch40/deploy'),app=resolve(repo,'.artifacts/stage-b-app-build-20260917-final')
const sha=b=>createHash('sha256').update(b).digest('hex'),git=(...args)=>execFileSync('git',args,{cwd:repo,encoding:'utf8'}).trim()
if(!process.argv.includes('--approved-omit-r2-toc-copies'))throw Error('explicit_toc_copy_omission_approval_required')
for(const owned of ['deploy','stage.json','static-source-manifest.json'])try{await stat(resolve(out,owned));throw Error('batch41_candidate_already_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const current=JSON.parse(await readFile(resolve(repo,'alpha-publish/ops/current-production.json'),'utf8'))
if(current.deploymentId!=='214d9565-f244-41d5-af51-e86309c463ce')throw Error('production_baseline_changed')
const descriptor=await readFile(resolve(base,'pages-dist/data/seo/release.json')),releaseSha=sha(descriptor)
if(releaseSha!=='3c6c99ea80fb2f3b723a5c32a5b0eafdb8cbb4c930fcf8172e96c4c27f827d4c')throw Error('seo_descriptor_changed')
async function paths(dir,prefix=''){const found=[];for(const e of await readdir(dir,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('input_symlink');const name=prefix+e.name;if(e.isDirectory())found.push(...await paths(resolve(dir,e.name),name+'/'));else found.push(name)}return found.sort()}
const selected=new Map((await paths(resolve(base,'pages-dist'))).map(p=>[p,resolve(base,'pages-dist',p)]))
for(const p of [...selected.keys()])if(p.startsWith('assets/'))selected.delete(p)
for(const p of await paths(resolve(app,'assets')))selected.set('assets/'+p,resolve(app,'assets',p))
for(const p of ['index.html','sw.js','manifest.webmanifest','theme-init.js'])selected.set(p,resolve(app,p))
const omitted=['data/seo/toc-000.bin','data/seo/toc-001.bin','data/seo/toc-002.bin']
const toc=JSON.parse(await readFile(resolve(repo,'.artifacts/seo-toc-20260916/toc-manifest.json'),'utf8'))
const remoteToc=JSON.parse(await readFile(resolve(repo,'.artifacts/batch41-toc-r2-receipt.json'),'utf8'))
if(!remoteToc.complete||remoteToc.verified.length!==3||toc.packs.some(p=>!remoteToc.verified.some(v=>v.sha256===p.sha256&&v.bytes===p.bytes&&v.status===200)))throw Error('toc_remote_receipt_required')
for(const p of omitted){const pack=toc.packs.find(x=>'data/seo/'+x.path===p);if(!pack||sha(await readFile(selected.get(p)))!==pack.sha256)throw Error('toc_pack_mismatch');selected.delete(p)}
if(selected.size>20000)throw Error('pages_file_count:'+selected.size)
const serverPaths=git('diff','--name-only','252f936..HEAD','--','deployment/cloudflare/functions').split('\n').filter(Boolean)
if(serverPaths.length!==33)throw Error('reviewed_server_delta_changed:'+serverPaths.length)
await mkdir(resolve(out,'deploy'),{recursive:true})
const staticManifest=[]
for(const [p,source] of [...selected].sort(([a],[b])=>a.localeCompare(b))){
 const data=await readFile(source);if(data.length>=25*1024*1024)throw Error('oversize_asset:'+p)
 const target=resolve(out,'deploy/pages-dist',p);await mkdir(dirname(target),{recursive:true})
 // Only immutable data is hard-linked; app entry files are independently copied.
 if(p.startsWith('data/')||p.startsWith('quran/'))await link(source,target);else await copyFile(source,target)
 staticManifest.push({path:p,source:relative(repo,source).replaceAll('\\','/'),bytes:data.length,sha256:sha(data)})
}
const functionsManifest=[]
const functionMap=new Map((await paths(resolve(base,'functions'))).map(p=>[p,resolve(base,'functions',p)]))
for(const path of serverPaths){const rel=path.replace('deployment/cloudflare/functions/',''),source=resolve(repo,path),mirror=resolve(repo,'alpha-publish/functions',rel);if(sha(await readFile(source))!==sha(await readFile(mirror)))throw Error('server_mirror_mismatch:'+rel);if(git('diff','HEAD','--',path))throw Error('uncommitted_reviewed_server:'+rel);functionMap.set(rel,source)}
for(const [p,source] of [...functionMap].sort(([a],[b])=>a.localeCompare(b))){const target=resolve(out,'deploy/functions',p),bytes=await readFile(source);await mkdir(dirname(target),{recursive:true});await copyFile(source,target);functionsManifest.push({path:p,sha256:sha(bytes)})}
// Four pure shared source modules imported by Functions. No entire source-tree copy.
for(const p of ['page_meta_model.ts','http_route_policy.ts','path_location.ts','route_shape.ts']){await mkdir(resolve(out,'app/src'),{recursive:true});await copyFile(resolve(repo,'app/src',p),resolve(out,'app/src',p))}
const functionsFingerprint=sha(JSON.stringify(functionsManifest)),payloadFingerprint=sha(JSON.stringify(staticManifest.map(({path,bytes,sha256})=>({path,bytes,sha256}))))
const oldConfig=await readFile(resolve(repo,'.artifacts/batch34/deploy/wrangler.toml'),'utf8')
const variableBlock=oldConfig.split('[vars]')[1].split('\n[')[0],vars=Object.fromEntries([...variableBlock.matchAll(/^([A-Z_0-9]+)\s*=\s*"([^"]*)"/gm)].map(m=>[m[1],m[2]]))
Object.assign(vars,{SEO_DATA_RELEASE_SHA256:releaseSha,SEO_HTML_CACHE_VERSION:functionsFingerprint,HEADING_QUERY_ENABLED:'0',PUBLIC_BOOK_INGESTION_ENABLED:'false',PUBLIC_BOOK_SEARCH_ENABLED:'false',PUBLIC_BOOK_INDEX_EVENTS_ENABLED:'false',PUBLIC_BOOK_TARGETED_ONLY:'true',BOOK_INDEX_QUEUE_ENABLED:'false',INDEXNOW_ENABLED:'false',INDEXNOW_SUBMISSION_APPROVED:'false',BOK_TEXT_EDITING_ENABLED:'0',BOK_PUBLICATION_JOBS_ENABLED:'0',BOK_RELEASE_ACTIVATION_ENABLED:'0'})
const preview={vars:{...vars,ACCOUNT_ACCESS_DOMAIN:'',ACCOUNT_ACCESS_AUD:''},d1_databases:[{binding:'VISITORS_DB',database_name:'khizana-bok-acceptance-20260917',database_id:'9133fe99-c4e1-4a1e-84f3-127735883279'}],r2_buckets:[{binding:'LIBRARY_R2',bucket_name:'khizana-ingestion-acceptance-20260917'},{binding:'PUBLIC_LIBRARY_R2',bucket_name:'khzanah-library'}]}
const config={name:'khezana',pages_build_output_dir:'./pages-dist',compatibility_date:'2026-08-09',vars,ai:{binding:'AI'},d1_databases:[{binding:'VISITORS_DB',database_name:'khezana-visitors',database_id:'aeb2bf7d-bfc5-4ec1-9ef5-a81371efe800'}],r2_buckets:[{binding:'LIBRARY_R2',bucket_name:'khzanah-library'},{binding:'PUBLIC_LIBRARY_R2',bucket_name:'khzanah-library'}],env:{preview}}
if(!oldConfig.includes(config.d1_databases[0].database_id)||!oldConfig.includes('bucket_name = "khzanah-library"'))throw Error('production_binding_mismatch')
await writeFile(resolve(out,'deploy/wrangler.jsonc'),JSON.stringify(config,null,2))
await writeFile(resolve(out,'deploy/wrangler.preview.jsonc'),JSON.stringify({name:'khezana',pages_build_output_dir:'./pages-dist',compatibility_date:config.compatibility_date,...preview,env:{preview}},null,2))
await writeFile(resolve(out,'static-source-manifest.json'),JSON.stringify(staticManifest,null,2))
await writeFile(resolve(out,'functions-manifest.json'),JSON.stringify(functionsManifest,null,2))
const stage={version:'batch-20260917-41',published:false,productionReady:false,baselineDeploymentId:current.deploymentId,commit:git('rev-parse','HEAD'),files:selected.size,payloadFingerprint,functionsFingerprint,seoReleaseSha256:releaseSha,serverOverlay:serverPaths,omittedLocalR2TocCopies:omitted,gates:'Stage B, IndexNow and BOK activation disabled',immutableDataHardLinked:true,requiredMigrations:'root-managed verified0032–0041; not applied by assembler',compilePassed:false}
await writeFile(resolve(out,'stage.json'),JSON.stringify(stage,null,2))
console.log(JSON.stringify(stage))
