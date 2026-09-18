// Strict immutable namespace; local plan first, bounded opt-in execution only.
import {readFile,mkdir,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {PIN} from './field-overlay-upload-plan.mjs'
import {createFieldS3Transport} from './field-overlay-s3-transport.mjs'
import {parseR2Config,journalWriter,safeFailure} from './field-overlay-upload-state.mjs'
import {readPublicFieldObject} from './field-public-read.mjs'
import {fieldSourceExecutionPolicy} from './field-source-execution-policy.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex'),root=resolve(`.artifacts/field-source-ranges-${PIN}`)
const args=process.argv.slice(2),mode=args[0]
if(!['--plan','--execute'].includes(mode)||args.slice(1).some(x=>x!=='--fresh'))throw Error('source_range_arguments')
const raw=await readFile(resolve(root,'manifest.json')),manifest=JSON.parse(raw),pin=sha(raw),prefix=`library/search-field-source-ranges/${pin}`
if(manifest.contract!=='khizana-field-source-ranges/1'||manifest.overlaySha256!==PIN||manifest.complete!==true||manifest.counts.books!==8594||manifest.counts.documents!==7626594||manifest.books.length!==8594)throw Error('source_range_incomplete')
const jobs=[]
for(const book of manifest.books){
 if(!/^\d+$/.test(book.bookId)||book.indexFile!==`books/${book.bookId}.json.gz`||!Number.isSafeInteger(book.indexBytes)||book.indexBytes<1||book.indexBytes>16*1024**2||!Number.isSafeInteger(book.expandedBytes)||book.expandedBytes>32*1024**2||! /^[a-f0-9]{64}$/.test(book.indexSha256))throw Error('source_range_book')
 const bytes=await readFile(resolve(root,book.indexFile));if(bytes.length!==book.indexBytes||sha(bytes)!==book.indexSha256)throw Error('source_range_local_integrity')
 jobs.push({file:book.indexFile,bytes:book.indexBytes,sha256:book.indexSha256})
}
jobs.push({file:'manifest.json',bytes:raw.length,sha256:pin})
const totalBytes=jobs.reduce((n,j)=>n+j.bytes,0)
if(new Set(jobs.map(j=>j.file)).size!==8595||totalBytes>1024**3)throw Error('source_range_budget')
if(mode==='--plan'){console.log(JSON.stringify({pin,prefix,objects:jobs.length,bytes:totalBytes,activated:false}));process.exit(0)}
const state=resolve(`.artifacts/field-source-transfer-${pin}`);await mkdir(state,{recursive:true})
const fresh=args.includes('--fresh'),policy=fieldSourceExecutionPolicy(fresh),signal=AbortSignal.timeout(policy.runTimeoutMs)
let transport={close(){}}
if(policy.needsWriteTransport){
 const configPath='C:/Users/Windows_OS/AppData/Roaming/rclone/rclone.conf'
 if((await stat(configPath)).size>1024**2)throw Error('credential_config_size')
 const config=parseR2Config(await readFile(configPath,'utf8'))
 transport=createFieldS3Transport({...config,sourceRangesPin:pin,signal,requestTimeoutMs:30000,runTimeoutMs:policy.runTimeoutMs})
}
let journal={};try{journal=JSON.parse(await readFile(resolve(state,'journal.json'),'utf8'))}catch(e){if(e.code!=='ENOENT')throw e}
const matches=j=>journal[j.file]?.sha256===j.sha256&&journal[j.file]?.bytes===j.bytes
if(fresh&&!jobs.every(matches))throw Error('source_range_fresh_requires_complete_transfer')
let count=0,cursor=0,failed=false,checkpoint=Promise.resolve()
const selected=fresh?jobs:jobs.slice(0,-1).filter(j=>!matches(j))
async function one(job){
 for(let attempt=0;;attempt++)try{
  signal.throwIfAborted();let bytes=await readPublicFieldObject(`${prefix}/${job.file}`,job.bytes,{prefix,signal,avoidNegativeCache:!fresh})
  if(bytes===null&&!fresh){const local=await readFile(resolve(root,job.file));if(sha(local)!==job.sha256)throw Error('source_range_local_integrity');await transport.put(`${prefix}/${job.file}`,local,{ifNoneMatch:'*'});bytes=await readPublicFieldObject(`${prefix}/${job.file}`,job.bytes,{prefix,signal,avoidNegativeCache:true})}
  if(!bytes||bytes.length!==job.bytes||sha(bytes)!==job.sha256)throw Error('source_range_remote_integrity')
  if(!fresh){journal[job.file]={bytes:job.bytes,sha256:job.sha256};const snapshot=structuredClone(journal);checkpoint=checkpoint.then(()=>journalWriter(resolve(state,'journal.json'),snapshot));await checkpoint}
  if(++count%100===0)console.log(JSON.stringify({fresh,checked:count,selected:selected.length}));return
 }catch(error){if(!error.transient||attempt>=2){error.objectFile=job.file;throw error}await new Promise(done=>setTimeout(done,250*(attempt+1)))}
}
try{
 const results=await Promise.allSettled(Array.from({length:policy.workers},async()=>{while(!failed&&cursor<selected.length)try{await one(selected[cursor++])}catch(error){failed=true;throw error}}))
 await checkpoint;const failure=results.find(r=>r.status==='rejected');if(failure)throw failure.reason
 if(!fresh){if(!jobs.slice(0,-1).every(matches))throw Error('source_range_manifest_before_books');await one(jobs.at(-1))}
 const receipt={complete:fresh,transferred:jobs.every(matches),activated:false,pin,objects:jobs.length,bytes:totalBytes,checkedAt:new Date().toISOString()}
 await journalWriter(resolve(state,'status.json'),receipt);console.log(JSON.stringify(receipt))
}catch(error){await journalWriter(resolve(state,'failure.json'),{...safeFailure(error,fresh?'fresh_verify':'transfer'),objectFile:error.objectFile});throw Error('source_range_transfer_failed')}finally{transport.close()}
