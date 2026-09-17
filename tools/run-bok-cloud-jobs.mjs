import {readFile,writeFile} from 'node:fs/promises'
import {randomUUID} from 'node:crypto'
import assert from 'node:assert/strict'
const root='.artifacts/bok-cloud-acceptance-20260917',s=JSON.parse(await readFile(root+'/private-job-session.json','utf8'))
assert.equal(s.origin,'https://khizana-bok-acceptance-20260917.pages.dev')
const request=(path,input)=>fetch(s.origin+path,{method:input?'POST':'GET',redirect:'error',signal:AbortSignal.timeout(20000),headers:{cookie:s.cookie,origin:s.origin,'x-alkhizana-request':'account-ui',accept:'application/json',...(input?{'content-type':'application/json'}:{})},...(input?{body:JSON.stringify(input)}:{})})
const route='/api/admin/bok-publication',caps=await(await request(route)).json();assert.equal(caps.editingEnabled,true);assert.equal(caps.submissionEnabled,true);assert.equal(caps.automaticPublication,false)
const draft=await(await request('/api/admin/bok-text?'+new URLSearchParams({bookId:s.bookId,sourceHash:s.sourceHash,pageId:'17'}))).json()
const input={id:randomUUID(),bookId:s.bookId,sourceHash:s.sourceHash,reviews:[{pageId:17,revision:draft.draft.revision,baseHash:draft.draft.baseHash,text:draft.draft.text}]}
let result=await request(route,input);assert.equal(result.status,202);let data=await result.json();assert.equal(data.published,false);assert.equal(data.job.status,'awaiting_operator')
result=await request(route,input);assert.equal(result.status,200)
data=await(await request(route+'?bookId='+s.bookId)).json();assert.equal(data.job.id,input.id)
const stale={...input,id:randomUUID(),reviews:[{...input.reviews[0],revision:1}]};assert.equal((await request(route,stale)).status,409)
const receipt={passed:true,testedAt:new Date().toISOString(),origin:s.origin,durableStatus:'awaiting_operator',idempotentReplay:true,staleReviewRejected:true,productionWrites:0,automaticPublication:false}
await writeFile(root+'/jobs-receipt.json',JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt,null,2))
