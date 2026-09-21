import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root='.artifacts/batch81',sha=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(p))
const stage=await json(root+'/stage.json'),manifest=await json(root+'/static-source-manifest.json'),baseline=await json('.artifacts/batch80/stage.json')
assert.equal(sha(JSON.stringify(manifest)),stage.payloadFingerprint);assert.equal(stage.fieldsActivated,false);assert.equal(stage.functionsFingerprint,baseline.functionsFingerprint)
assert(manifest.length<=20000);assert.equal(new Set(manifest.map(x=>x.path)).size,manifest.length)
const [origin,phase]=process.argv.slice(2)
if(origin){assert(/^https:\/\/(?:khzanah\.com|[a-z0-9-]+\.khezana\.pages\.dev)$/.test(origin));assert(['preview','live'].includes(phase))}
const rows=origin?manifest.filter(r=>r.path.startsWith('assets/')||['index.html','sw.js','data/shamela-search-v2-packed.js'].includes(r.path)):manifest
let cursor=0
await Promise.all(Array.from({length:origin?4:8},async()=>{while(cursor<rows.length){const row=rows[cursor++];assert(!row.path.includes('..'));let bytes=await readFile(root+'/deploy/pages-dist/'+row.path);assert.equal(sha(bytes),row.sha256,row.path);assert.equal(bytes.length,row.bytes);if(origin){for(let attempt=0;;attempt++){try{const response=await fetch(origin+'/'+row.path,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,row.path);bytes=Buffer.from(await response.arrayBuffer());break}catch(error){if(attempt>=2)throw error}}assert.equal(sha(bytes),row.sha256,row.path)}}}))
assert(manifest.some(r=>/shamela_pack_prepare.worker-.*\.js$/.test(r.path)))
const sw=await readFile(root+'/deploy/pages-dist/sw.js','utf8')
for(const row of await json('.artifacts/mobile-reader-20260921/client-final3/font-cache-map.json')){assert(manifest.some(r=>r.path===row.target));assert(sw.includes(row.target))}
const report={passed:true,phase:phase??'local',origin:origin??null,checked:rows.length,payloadFingerprint:stage.payloadFingerprint,functionsUnchanged:true,fieldsActivated:false,checkedAt:new Date().toISOString()}
await writeFile(root+'/'+(phase??'local')+'-verification.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
