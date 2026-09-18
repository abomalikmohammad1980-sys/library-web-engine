import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const [base,phase]=process.argv.slice(2),origin=new URL(base).origin
assert(['preview','live'].includes(phase));assert(origin===base&&/^https:\/\/(?:khzanah\.com|[a-z0-9-]+\.khezana\.pages\.dev)$/.test(origin))
const batch=process.argv[4]??'44';assert(['44','45','46','47','48','50','51','52','53','54','55','56','57','58','59','60'].includes(batch))
const root='.artifacts/batch'+batch,manifest=JSON.parse(await readFile(root+'/static-source-manifest.json')),stage=JSON.parse(await readFile(root+'/stage.json')),sha=b=>createHash('sha256').update(b).digest('hex')
assert.equal(sha(JSON.stringify(manifest)),stage.payloadFingerprint)
const selected=manifest.filter(x=>x.path.startsWith('assets/')||['sw.js','data/shamela-search-v2-packed.js'].includes(x.path))
assert(selected.length>=120&&selected.length<=150)
let cursor=0;const checked=[]
async function verify(row){
 assert.equal(sha(await readFile(root+'/deploy/pages-dist/'+row.path)),row.sha256)
 let bytes
 for(let attempt=0;;attempt++)try{const response=await fetch(base+'/'+row.path,{signal:AbortSignal.timeout(30000)});assert.equal(response.status,200,row.path);bytes=Buffer.from(await response.arrayBuffer());break}catch(error){if(attempt>=2||error.code==='ERR_ASSERTION')throw error}
 assert.equal(bytes.length,row.bytes,row.path);assert.equal(sha(bytes),row.sha256,row.path)
 if(row.path==='data/shamela-search-v2-packed.js')assert(!bytes.toString().includes('__KHIZANA_SEARCH_FIELDS__'))
 checked.push(row.path)
}
await Promise.all(Array.from({length:4},async()=>{while(cursor<selected.length)await verify(selected[cursor++])}))
const report={passed:true,base,phase,payloadFingerprint:stage.payloadFingerprint,checked:checked.length,fieldsActivated:false,checkedAt:new Date().toISOString()}
await writeFile(root+'/'+phase+'-assets.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report))
