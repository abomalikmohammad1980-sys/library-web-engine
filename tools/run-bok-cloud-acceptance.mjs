import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
import {recheckBokPublicationDrafts} from './recheck-bok-publication-drafts.mjs'
const root='.artifacts/bok-cloud-acceptance-20260917',s=JSON.parse(await readFile(root+'/private-session.json','utf8'))
assert.equal(s.origin,'https://khizana-bok-acceptance-20260917.pages.dev')
const fetchAs=(url,init={})=>fetch(url,{...init,redirect:'error',headers:{...init.headers,cookie:s.cookie},signal:AbortSignal.timeout(20000)})
const url=s.origin+'/api/admin/bok-text?'+new URLSearchParams({bookId:s.bookId,sourceHash:s.sourceHash,pageId:'17'})
if(process.argv.includes('--verify-revoked')){
 assert.equal((await fetchAs(url)).status,403)
 await writeFile(root+'/revocation-receipt.json',JSON.stringify({passed:true,testedAt:new Date().toISOString(),origin:s.origin,remoteSessionRevocation:true,productionWrites:0},null,2))
 console.log('Isolated cloud revoked session denied with 403.')
}else{
const put=(text,expectedRevision,origin=s.origin)=>fetchAs(url,{method:'PUT',headers:{origin,'x-alkhizana-request':'account-ui','content-type':'application/json'},body:JSON.stringify({baseHash:s.baseHash,text,expectedRevision})})
const candidate={contract:'bok-text-release/1',bookId:s.bookId,sourceHash:s.sourceHash,pages:[{id:17,text:'التصحيح'}],reviewedPages:[{pageId:17,revision:1,baseHash:s.baseHash}]}
const checks=[]
assert.equal((await fetch(url)).status,403);checks.push('unauthenticated denied')
assert.equal((await put('wrong',0,'https://untrusted.invalid')).status,403);checks.push('cross origin denied')
assert.equal((await put('التصحيح',0)).status,200);checks.push('real session save')
await recheckBokPublicationDrafts(candidate,{origin:s.origin,fetcher:fetchAs});checks.push('remote draft preflight')
assert.equal((await put('stale',0)).status,409);checks.push('stale write conflict')
const activate=()=>fetchAs(s.origin+'/isolated/activate',{method:'POST',headers:{origin:s.origin,'x-alkhizana-request':'account-ui','content-type':'application/json'},body:JSON.stringify({releaseId:s.releaseId,candidateSha256:s.candidateSha256,expectedGeneration:0,expectedReleaseId:null})}).then(r=>r.json())
assert.equal((await activate()).activated,true);checks.push('atomic synthetic pointer activation')
assert.equal((await activate()).activated,false);checks.push('stale pointer CAS denied')
const pointer=await fetchAs(s.origin+'/isolated/pointer').then(r=>r.json());assert.equal(pointer.releaseId,s.releaseId);assert.equal(pointer.generation,1);checks.push('single reader/search descriptor')
assert.equal((await put('تصحيح أحدث',1)).status,200)
await assert.rejects(recheckBokPublicationDrafts(candidate,{origin:s.origin,fetcher:fetchAs}),/revision_conflict/);checks.push('changed draft preflight denied')
const receipt={contract:'bok-isolated-cloud-handler-acceptance/1',testedAt:new Date().toISOString(),origin:s.origin,databaseId:'9133fe99-c4e1-4a1e-84f3-127735883279',checks,passed:true,accountTestMode:false,productionWrites:0,productionActivation:false,readerSearchCloudAcceptance:false}
await writeFile(root+'/receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2))
}
