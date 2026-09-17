import {readFile,realpath,stat} from 'node:fs/promises'
import {resolve,relative,isAbsolute} from 'node:path'
import {createHash} from 'node:crypto'
export const PIN='a81347caaabbdb907b29fe2b4f8309be801c47d41cd051cc99c438e043eb1613'
export const PREFIX=`library/search-fields/${PIN}`
export const ARTIFACT='.artifacts/field-overlay-full-proof-1789638689620'
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex')
export function validateFieldJob(job){if(!job||! /^(books\/\d+\.json|manifest\.json)$/.test(job.path)||job.remoteKey!==`${PREFIX}/${job.path}`||!Number.isSafeInteger(job.bytes)||job.bytes<1||job.bytes>8*1024**2||! /^[a-f0-9]{64}$/.test(job.sha256)||job.path==='manifest.json'&&job.sha256!==PIN)throw Error('invalid_job')}
export async function planFieldOverlay(directory=ARTIFACT){
 const root=await realpath(directory);if((await stat(resolve(root,'manifest.json'))).size>8*1024**2)throw Error('descriptor_pin');const raw=await readFile(resolve(root,'manifest.json'))
 if(sha(raw)!==PIN)throw Error('descriptor_pin')
 const manifest=JSON.parse(raw)
 if(!manifest.coverageComplete||manifest.activated!==false||manifest.counts.books!==8594||manifest.counts.segments!==860||manifest.counts.documents!==7626594||manifest.counts.positions!==1589552709)throw Error('field_coverage')
 const jobs=[]
 for(const book of manifest.books){const path=book.file,localPath=await realpath(resolve(root,path)),rel=relative(root,localPath);if(rel.startsWith('..')||isAbsolute(rel))throw Error('local_path_escape');const job={path,localPath,remoteKey:`${PREFIX}/${path}`,bytes:book.byteLength,sha256:book.sha256};validateFieldJob(job);if((await stat(localPath)).size!==job.bytes)throw Error('local_sha');const bytes=await readFile(localPath);if(bytes.length!==job.bytes||sha(bytes)!==job.sha256)throw Error('local_sha');jobs.push(job)}
 const manifestJob={path:'manifest.json',localPath:resolve(root,'manifest.json'),remoteKey:`${PREFIX}/manifest.json`,bytes:raw.length,sha256:PIN};validateFieldJob(manifestJob);jobs.push(manifestJob)
 if(new Set(jobs.map(j=>j.remoteKey)).size!==8595)throw Error('duplicate_job')
 return{contract:'khizana-field-overlay-upload/1',manifestSha256:PIN,prefix:PREFIX,manifestUrl:`https://khzanah.com/${PREFIX}/manifest.json`,objects:jobs.length,bytes:jobs.reduce((n,j)=>n+j.bytes,0),concurrency:2,retries:2,activated:false,jobs}
}
export async function transferFieldOverlay({plan,journal={},transport,readLocal,persist,signal,maxObjects,maxBytes,freshVerify=false,freshState={},persistFresh=async()=>{}}){
 if(plan.manifestSha256!==PIN||plan.prefix!==PREFIX||!Number.isSafeInteger(maxObjects)||maxObjects<1||maxObjects>8595||!Number.isSafeInteger(maxBytes)||maxBytes<1||maxBytes>200000000)throw Error('limits')
 for(const job of plan.jobs)validateFieldJob(job)
 const matches=job=>journal[job.remoteKey]?.sha256===job.sha256&&journal[job.remoteKey]?.bytes===job.bytes&&journal[job.remoteKey]?.remoteVerified===true
 const check=(job,bytes)=>{if(!bytes||bytes.length!==job.bytes||sha(bytes)!==job.sha256)throw Error('immutable_remote_mismatch')}
 if(freshVerify){
  if(plan.jobs.length>maxObjects||plan.bytes>maxBytes||!plan.jobs.every(matches))throw Error('fresh_verify_requires_full_budget_and_journal')
  const now=Date.now()
  if(freshState.manifestSha256!==PIN||!Number.isSafeInteger(freshState.startedAt)||freshState.startedAt>now||now-freshState.startedAt>6*60*60*1000){freshState.manifestSha256=PIN;freshState.startedAt=now;freshState.objects={}}
  if(!freshState.objects||Array.isArray(freshState.objects)||typeof freshState.objects!=='object')throw Error('fresh_verify_state')
  const freshMatches=job=>freshState.objects[job.remoteKey]?.sha256===job.sha256&&freshState.objects[job.remoteKey]?.bytes===job.bytes
  const pending=plan.jobs.filter(job=>!freshMatches(job));let saved=0,checkpoint=Promise.resolve()
  // Same two-request ceiling as transfer. Drain both workers before returning
  // or failing, and never treat the old journal as fresh verification evidence.
  let next=0,failed=false
  const results=await Promise.allSettled(Array.from({length:2},async()=>{
   while(!failed&&next<pending.length){
    const job=pending[next++]
    try{
     for(let attempt=0;;attempt++){
      signal?.throwIfAborted()
      try{check(job,await transport.get(job.remoteKey,job.bytes));freshState.objects[job.remoteKey]={sha256:job.sha256,bytes:job.bytes};break}
      catch(error){if(!error.transient||attempt>=2)throw error;await new Promise(done=>setTimeout(done,250*(attempt+1)))}
     }
     if(++saved%100===0){const snapshot=structuredClone(freshState);checkpoint=checkpoint.then(()=>persistFresh(snapshot));await checkpoint}
    }
    catch(error){failed=true;throw error}
   }
  }))
  await checkpoint;await persistFresh(freshState)
  const failure=results.find(result=>result.status==='rejected');if(failure)throw failure.reason
  if(!plan.jobs.every(freshMatches))throw Error('fresh_verify_incomplete')
  return{complete:true,activated:false,freshVerifiedObjects:plan.jobs.length,manifestSha256:PIN,verificationStartedAt:new Date(freshState.startedAt).toISOString(),verificationCompletedAt:new Date().toISOString()}
 }
 const selected=[];let bytes=0
 for(const job of plan.jobs){if(matches(job))continue;if(selected.length>=maxObjects||bytes+job.bytes>maxBytes)break;selected.push(job);bytes+=job.bytes}
 let checkpoint=Promise.resolve(),cursor=0,stopped=false
 const one=async job=>{signal?.throwIfAborted();const local=await readLocal(job);if(local.length!==job.bytes||sha(local)!==job.sha256)throw Error('local_sha');for(let attempt=0;;attempt++){try{const remote=await transport.get(job.remoteKey,job.bytes);if(remote===null){await transport.put(job.remoteKey,local,{ifNoneMatch:'*'});check(job,await transport.get(job.remoteKey,job.bytes))}else check(job,remote);journal[job.remoteKey]={sha256:job.sha256,bytes:job.bytes,remoteVerified:true};const snapshot=structuredClone(journal);checkpoint=checkpoint.then(()=>persist(snapshot));await checkpoint;return}catch(error){if(!error.transient||attempt>=2)throw error;await new Promise(done=>setTimeout(done,250*(attempt+1)));signal?.throwIfAborted()}}}
 const books=selected.filter(j=>j.path!=='manifest.json')
 const results=await Promise.allSettled(Array.from({length:2},async()=>{while(!stopped&&cursor<books.length){try{await one(books[cursor++])}catch(error){stopped=true;throw error}}}))
 await checkpoint;const failed=results.find(r=>r.status==='rejected');if(failed)throw failed.reason
 const manifest=selected.find(j=>j.path==='manifest.json');if(manifest){if(!plan.jobs.filter(j=>j.path!=='manifest.json').every(matches))throw Error('field_manifest_before_books');await one(manifest)}
 return{complete:false,activated:false,selectedObjects:selected.length,selectedBytes:bytes,verifiedObjects:plan.jobs.filter(matches).length,totalObjects:plan.jobs.length,manifestSha256:PIN}
}
