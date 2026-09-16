import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),work=resolve(root,'.artifacts/batch25'),origin=process.argv[2],label=process.argv[3]??'local'
assert(/^[a-z-]+$/.test(label))
if(origin)assert(/^https:\/\/(?:khzanah\.com|[a-z0-9-]+\.khezana\.pages\.dev)$/.test(origin))
const read=async p=>JSON.parse(await readFile(p)),sha=b=>createHash('sha256').update(b).digest('hex')
const stage=await read(resolve(work,'stage.json')),handoff=await read(resolve(root,'artifacts/six-requested-tafsirs-20260915/review-package/handoff.json'))
const packs=await read(resolve(work,'app/src/quran_source_packs.generated.json'))
async function bytes(path,range){
 if(!origin){const b=await readFile(resolve(stage.out,path));return range?b.subarray(range.offset,range.offset+range.bytes):b}
 const headers=range?{Range:`bytes=${range.offset}-${range.offset+range.bytes-1}`}:{},response=await fetch(origin+'/'+path,{headers,signal:AbortSignal.timeout(120000)})
 assert(response.ok,`${response.status}:${path}`)
 const b=Buffer.from(await response.arrayBuffer())
 if(range){assert.equal(response.status,206,'Range required: '+path);assert.equal(b.length,range.bytes)}
 return b
}
const manifestBytes=await bytes('q13-manifest.json'),manifest=JSON.parse(manifestBytes)
assert.equal(manifest.fingerprint,stage.payloadFingerprint)
const report={checkedAt:new Date().toISOString(),origin:origin??'local',passed:false,fingerprint:stage.deployFingerprint,assets:[],surahs:0,records:0,ranges:[]}
const buffers=new Map()
for(const item of handoff.dataOverlay){
 const data=await bytes(item.target);assert.equal(sha(data),item.sha256,item.target)
 buffers.set(item.target,data);report.assets.push({path:item.target,bytes:data.length,sha256:sha(data)})
}
for(const source of handoff.sources){
 const prefix=`quran/resources/source-editions/${source.slug}/`,metadata=JSON.parse(buffers.get(prefix+'manifest.json'));let records=0
 assert.equal(metadata.files.length,114)
 for(const file of metadata.files){
  const part=packs[source.slug][file.file];assert(part)
  const packed=buffers.get(prefix+part.path);assert(packed)
  const data=packed.subarray(part.offset,part.offset+part.bytes);assert.equal(data.length,file.byteSize);assert.equal(sha(data),file.checksumSha256)
  const decoded=JSON.parse(data);assert.equal(decoded.records.length,file.records);records+=decoded.records.length;report.surahs++
 }
 assert.equal(records,source.coverage,source.slug);report.records+=records
 if(origin){const file=metadata.files[0],part=packs[source.slug][file.file],data=await bytes(prefix+part.path,part);assert.equal(sha(data),file.checksumSha256);report.ranges.push({slug:source.slug,passed:true})}
}
assert.equal(report.surahs,684);assert.equal(report.records,25066)
const html=await bytes('index.html');assert.equal(sha(html),manifest.files.find(f=>f.path==='index.html').sha256)
const links=[...new Set([...html.toString('utf8').matchAll(/(?:src|href)="\.\/(assets\/[^"?#]+)"/g)].map(x=>x[1]).concat(manifest.files.filter(f=>/^assets\/(quran|reader|sunnah|search)-[^/]+\.js$/.test(f.path)).map(f=>f.path)))]
assert(links.length>=2)
for(const path of links){const data=await bytes(path);assert.equal(sha(data),manifest.files.find(f=>f.path===path)?.sha256,path)}
if(origin){
 for(const path of ['sw.js','data/shamela-search-v2-packed.js']){const data=await bytes(path);assert.equal(sha(data),manifest.files.find(f=>f.path===path)?.sha256,path)}
 const response=await fetch(origin+'/api/account/native-session',{signal:AbortSignal.timeout(30000)});assert([200,401].includes(response.status),'account API unavailable');assert(response.headers.get('content-type')?.includes('json'))
 const admin=await fetch(origin+'/api/admin/account-stats',{signal:AbortSignal.timeout(30000)});assert([401,403].includes(admin.status),'anonymous admin must be denied')
}
report.passed=true;await writeFile(resolve(work,label+'-verification.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,assets:report.assets.length}))
