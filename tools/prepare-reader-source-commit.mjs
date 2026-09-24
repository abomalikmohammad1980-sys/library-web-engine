// Stage only reviewed frozen runtime files and their companion tests in a
// separate Git index. Never touches the user's checkout, branch or index.
import {readFile,mkdir,writeFile,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
const root=resolve(import.meta.dirname,'..'),frozen=resolve(root,'.artifacts/reader-merged-client-20260925-v8')
const out=resolve(root,'.artifacts/reader-source-release-20260925')
const git=(args,options={})=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024,...options})
const base=git(['rev-parse','origin/main']).trim()
if(base!=='4ce7ce0aa3adb286c7b1ebcd71a5293021bba899')throw Error('source_baseline_changed')
const tree=new Map(git(['ls-tree','-r',base]).trim().split('\n').map(line=>{const [meta,path]=line.split('\t');return [path,meta.split(' ')[2]]}))
const snapshot=JSON.parse(await readFile(resolve(frozen,'source-snapshot.json'),'utf8'))
const rows=new Map(snapshot.map(row=>[row.path,row])),selected=new Map()
const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
async function add(path,source,expected){
 if(path.includes('..')||! /^[\w/.[\]-]+$/.test(path))throw Error('unsafe_source_path:'+path)
 const raw=await readFile(source);if(expected&&sha(raw)!==expected)throw Error('source_drift:'+path)
 const bytes=/\.(?:ts|js|mjs|cjs|json|css|sql|md)$/.test(path)?Buffer.from(raw.toString('utf8').replaceAll('\r\n','\n')):raw
 if(/(?:-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|CLOUDFLARE_API_TOKEN\s*=\s*['"][A-Za-z0-9_-]{20})/.test(bytes.toString()))throw Error('potential_secret:'+path)
 const blob=createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex')
 if(tree.get(path)!==blob){if(bytes.length>2*1024*1024)throw Error('large_source_requires_review:'+path);selected.set(path,{path,source,bytes,sha256:sha(bytes),blob})}
}
for(const row of snapshot){
 if(/(?:\.test\.|\.spec\.|\/__tests__\/|\/test\/|\/tests\/)/.test(row.path))continue
 await add(row.path,resolve(frozen,'source',row.path),row.sha256)
}
for(const path of [...selected.keys()]){
 const test=path.replace(/\.ts$/,'.test.ts'),row=rows.get(test)
 if(row&&test!==path)await add(test,resolve(frozen,'source',test),row.sha256)
}
const candidate=JSON.parse(await readFile(resolve(root,'.artifacts/reader-integrated-smoke-20260924-v4/candidate.json'),'utf8'))
for(const path of candidate.overlaidFunctions)await add('deployment/cloudflare/functions/'+path,resolve(root,'deployment/cloudflare/functions',path))
for(const path of [
 'deployment/cloudflare/migrations/0042_download_attachments.sql','alpha-publish/migrations/0043_html_companion_resources.sql',
 'deployment/cloudflare/tests/account-public-claims.test.mjs','deployment/cloudflare/tests/download-attachments.test.mjs','deployment/cloudflare/tests/jpeg-source.test.mjs',
 'app/public/fonts/quran/kfgqpc-hafs-regular.otf','app/public/quran/resources/manifest.json',
 'tools/build-reader-merged-client.mjs','tools/prepare-reader-integrated-release.mjs','tools/build-shamela-reader-client-config.mjs',
 'tools/verify-reader-remote-release.mjs','tools/run-reader-upload-resumable.mjs','tools/wrangler-pages-small-batches.cjs','tools/pages-curl-transport.cjs',
 'tools/search-bootstrap-html.mjs','tools/inline-theme-bootstrap.mjs','tools/route-preload-hints.mjs','tools/inline-entry-css.mjs',
 'tools/prepare-reader-source-commit.mjs'
])await add(path,resolve(root,path))
await mkdir(out,{recursive:true})
const files=[...selected.values()].map(({bytes,source,...row})=>({...row,bytes:bytes.length}))
await writeFile(resolve(out,'plan.json'),JSON.stringify({base,files,bytes:files.reduce((n,f)=>n+f.bytes,0)},null,2))
console.log(JSON.stringify({base,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),plan:resolve(out,'plan.json')}))
if(process.argv[2]!=='--stage-reviewed')process.exit(0)
const index=resolve(out,'index');try{await stat(index);throw Error('isolated_index_already_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const env={...process.env,GIT_INDEX_FILE:index}
git(['read-tree',base],{env})
for(const row of selected.values()){
 const object=git(['hash-object','-w','--stdin'],{input:row.bytes}).trim()
 if(object!==row.blob)throw Error('git_blob_mismatch')
 git(['update-index','--add','--cacheinfo',`100644,${object},${row.path}`],{env})
}
const stagedTree=git(['write-tree'],{env}).trim()
await writeFile(resolve(out,'staged-tree.json'),JSON.stringify({base,tree:stagedTree,index,files:files.length},null,2))
console.log(JSON.stringify({tree:stagedTree,commitCreated:false,checkoutChanged:false,userIndexChanged:false}))
