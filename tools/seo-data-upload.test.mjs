import test from 'node:test'
import assert from 'node:assert/strict'
import {planSeoUpload, transferSeoData, runSeoUpload, PIN} from './seo-data-upload.mjs'
const plan = await planSeoUpload()
function small() {const jobs=plan.jobs.slice(0,2);return {...plan,jobs,totalBytes:jobs.reduce((n,j)=>n+j.bytes,0)}}
function memory(){const data=new Map(),puts=[];return {data,puts,async get(key){return data.get(key)??null},async put(key,bytes,condition){assert.deepEqual(condition,{ifNoneMatch:'*'});assert(!data.has(key));puts.push(key);data.set(key,bytes)}}}
test('full staged package pin and all local objects validate; dry run is default and side-effect free',async()=>{
 assert.equal(plan.descriptorSha256,PIN);assert.equal(plan.jobs.length,515);assert.equal(plan.totalBytes,15637665)
 assert.equal(plan.jobs.at(-1).key,`seo/descriptors/${PIN}.json`)
 let output;await runSeoUpload([],{planLocal:async()=>plan,log:value=>output=JSON.parse(value)});assert.equal(output.dryRun,true);assert.equal(output.jobs,undefined)
 await assert.rejects(planSeoUpload(undefined,'0'.repeat(64)),/descriptor_pin/)
})
test('bounded transfer resumes but only fresh all-object readback declares complete',async()=>{
 const p=small(),transport=memory(),journal={};let saves=0
 const first=await transferSeoData({plan:p,transport,journal,persist:async()=>saves++,maxObjects:1,maxBytes:p.totalBytes})
 assert.equal(first.complete,false);assert.equal(first.verifiedObjects,1)
 const second=await transferSeoData({plan:p,transport,journal,maxObjects:2,maxBytes:p.totalBytes})
 assert.equal(second.complete,false);assert.equal(second.verifiedObjects,2);assert.equal(transport.puts.length,2)
 const final=await transferSeoData({plan:p,transport,journal,maxObjects:2,maxBytes:p.totalBytes,freshVerify:true})
 assert.equal(final.complete,true);assert.equal(final.activated,false);assert.equal(saves,1)
})
test('never overwrites different existing data and never repairs missing objects during fresh verify',async()=>{
 const p=small(),transport=memory();transport.data.set(p.jobs[0].key,Buffer.from('wrong'))
 await assert.rejects(transferSeoData({plan:p,transport,maxObjects:2,maxBytes:p.totalBytes}),/immutable_remote_mismatch/)
 assert.equal(transport.puts.length,0);transport.data.clear()
 await assert.rejects(transferSeoData({plan:p,transport,maxObjects:2,maxBytes:p.totalBytes,freshVerify:true}),/fresh_verify_mismatch/)
 assert.equal(transport.puts.length,0)
 await assert.rejects(transferSeoData({plan:p,transport,maxObjects:1,maxBytes:p.totalBytes,freshVerify:true}),/full_budget/)
})
test('receipt cannot make corrupt remote content pass fresh verification',async()=>{
 const p=small(),transport=memory(),journal=Object.fromEntries(p.jobs.map(j=>[j.key,j.sha256]))
 transport.data.set(p.jobs[0].key,Buffer.alloc(p.jobs[0].bytes))
 await assert.rejects(transferSeoData({plan:p,transport,journal,maxObjects:2,maxBytes:p.totalBytes,freshVerify:true}),/immutable_remote_mismatch/)
})
test('local checksum is rechecked on resumed jobs and aborted transfer does no writes',async()=>{
 const p=small(),transport=memory(),bad={...p,jobs:[{...p.jobs[0],sha256:'0'.repeat(64)}]}
 await assert.rejects(transferSeoData({plan:bad,transport,maxObjects:2,maxBytes:p.totalBytes}),/local_sha/)
 const controller=new AbortController();controller.abort(Error('stopped'))
 await assert.rejects(transferSeoData({plan:p,transport,maxObjects:2,maxBytes:p.totalBytes,signal:controller.signal}),/stopped/)
 assert.equal(transport.puts.length,0)
})
