import assert from 'node:assert/strict'
import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {createRequire} from 'node:module'
const require=createRequire(import.meta.url),{Agent,setGlobalDispatcher}=require('../alpha-publish/node_modules/undici')
setGlobalDispatcher(new Agent({connect:{family:4,timeout:20000},connections:6,pipelining:0}))
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'.artifacts/reader-upload-resumable-20260924')
const receipt=JSON.parse(await readFile(resolve(out,'receipt.json'),'utf8'))
assert.equal(receipt.releaseId,'601fbdb9ac80f05dd86d2383');assert.equal(receipt.uploaded,true)
assert(/^https:\/\/[a-f0-9]{8}\.khezana-reader-01\.pages\.dev$/.test(receipt.deploymentUrl))
const stage=resolve(root,receipt.localDirectory),sha=b=>createHash('sha256').update(b).digest('hex')
const bytes=await readFile(resolve(stage,'project-manifest.json')),manifest=JSON.parse(bytes)
assert.equal(manifest.releaseId,receipt.releaseId);assert.equal(manifest.assets.length,16452)
const checked=[]
async function check(path,hash,size){
 let last
 for(let retry=0;retry<3;retry++)try{
  const response=await fetch(receipt.deploymentUrl+'/'+path,{headers:{Origin:'https://khzanah.com'},signal:AbortSignal.timeout(90000)})
  assert.equal(response.status,200,path)
  assert(['*','https://khzanah.com'].includes(response.headers.get('access-control-allow-origin')),'cors:'+path)
  assert.notEqual(response.headers.get('access-control-allow-credentials'),'true')
  const data=Buffer.from(await response.arrayBuffer());assert.equal(data.length,size,'size:'+path);assert.equal(sha(data),hash,'digest:'+path)
  checked.push({path,sha256:hash,bytes:size});return
 }catch(error){last=error;if(retry<2)await new Promise(r=>setTimeout(r,1000*(retry+1)))}
 throw last
}
await check('project-manifest.json',sha(bytes),bytes.length)
const routes=manifest.assets.filter(a=>a.path.endsWith('/route.json'));assert.equal(routes.length,1788)
const samples=new Set(['88','907','5678',routes[0].path.split('/').at(-2),routes[Math.floor(routes.length/2)].path.split('/').at(-2),routes.at(-1).path.split('/').at(-2)])
const chosen=new Map(routes.map(a=>[a.path,a]))
for(const a of manifest.assets){
 if(a.path==='reader-shards/catalog.json')chosen.set(a.path,a)
 if(a.path.endsWith('/index.json')&&samples.has(a.path.split('/').at(-2)))chosen.set(a.path,a)
}
for(const bookId of samples){const groups=manifest.assets.filter(a=>a.path.includes('/books/'+bookId+'/pages-'));for(const i of new Set([0,Math.floor(groups.length/2),groups.length-1]))if(groups[i])chosen.set(groups[i].path,groups[i])}
for(const a of manifest.assets.filter(a=>/\/907\/pages-0016|\/5678\/pages-0117|\/5678\/pages-0156/.test(a.path)))chosen.set(a.path,a)
const queue=[...chosen.values()];let cursor=0
await Promise.all(Array.from({length:6},async()=>{for(;;){const index=cursor++;if(index>=queue.length)return;const a=queue[index];assert.equal(a.parts.length,1);await check(a.parts[0].path,a.sha256,a.bytes);if(checked.length%100===0)console.log('Verified remote hashes: '+checked.length)}}))
await mkdir(out,{recursive:true})
await writeFile(resolve(out,'remote-verification.json'),JSON.stringify({verifiedAt:new Date().toISOString(),deploymentUrl:receipt.deploymentUrl,releaseId:receipt.releaseId,allRoutes:1788,sampledBookIds:[...samples],allDataAssetsDownloaded:false,checked},null,2))
await writeFile(resolve(out,'receipt.json'),JSON.stringify({...receipt,remoteVerified:true,remoteVerification:'remote-verification.json'},null,2))
console.log(JSON.stringify({passed:true,routes:1788,checked:checked.length,uiPublished:false}))
