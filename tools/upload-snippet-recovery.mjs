import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
import {parseR2Config} from './field-overlay-upload-state.mjs'
const pin='81735c749b853a08f1bb2c6eb750062ee42dcdc8f3db93d7c5d2b10868907f3e',prefix=`library/snippet-recovery/${pin}/`,root='release-artifacts/snippet-source-recovery-aa8ba3b2ea338a83',sha=b=>createHash('sha256').update(b).digest('hex')
const manifest=await readFile(root+'/manifest.json');if(sha(manifest)!==pin)throw Error('manifest_integrity')
const value=JSON.parse(manifest),jobs=[]
for(const f of value.files){if(!/^books\/\d+\.json$/.test(f.path))throw Error('unsafe_path');const bytes=await readFile(root+'/'+f.path);if(bytes.length!==f.byteLength||sha(bytes)!==f.sha256||bytes.length>2*1024**2)throw Error('file_integrity');jobs.push({path:f.path,bytes,sha256:f.sha256})}
const correction=await readFile('release-artifacts/search-source-corrections-4ba908f1d2f92f69/corrections.json'),correctionSha='4ba908f1d2f92f6937369dfb310170de8e0bc8237e0d288846774365ac554345';if(sha(correction)!==correctionSha||jobs.length!==942||value.rows!==30289)throw Error('source_contract')
jobs.push({path:'corrections.json',bytes:correction,sha256:correctionSha},{path:'manifest.json',bytes:manifest,sha256:pin})
if(process.argv[2]!=='--execute'){console.log(JSON.stringify({objects:jobs.length,bytes:jobs.reduce((s,x)=>s+x.bytes.length,0),prefix}));process.exit(0)}
const config=parseR2Config(await readFile('C:/Users/Windows_OS/AppData/Roaming/rclone/rclone.conf','utf8')),sdk=new S3Client({...config,region:'auto',forcePathStyle:true,maxAttempts:2,requestChecksumCalculation:'WHEN_REQUIRED'}),checked=[]
async function one(job){const params={Bucket:'khzanah-library',Key:prefix+job.path};let response;try{response=await sdk.send(new GetObjectCommand(params),{abortSignal:AbortSignal.timeout(30000)})}catch(e){if(e.$metadata?.httpStatusCode!==404)throw e}
 if(!response){await sdk.send(new PutObjectCommand({...params,Body:job.bytes,IfNoneMatch:'*',ContentType:'application/json',CacheControl:'public,max-age=31536000,immutable'}),{abortSignal:AbortSignal.timeout(30000)});response=await sdk.send(new GetObjectCommand(params),{abortSignal:AbortSignal.timeout(30000)})}
 const bytes=await response.Body.transformToByteArray();if(bytes.length!==job.bytes.length||sha(bytes)!==job.sha256)throw Error('remote_integrity:'+job.path);checked.push(job.path);if(checked.length%100===0)console.log(JSON.stringify({checked:checked.length}))}
async function retry(job){for(let attempt=0;;attempt++)try{return await one(job)}catch(e){if(attempt>=2||String(e.message).startsWith('remote_integrity'))throw e;console.log(JSON.stringify({retry:job.path,attempt:attempt+1}));}}
try{let cursor=0;await Promise.all(Array.from({length:4},async()=>{while(cursor<jobs.length-1)await retry(jobs[cursor++])}));await retry(jobs.at(-1));await mkdir('.artifacts/snippet-recovery-publish',{recursive:true});await writeFile('.artifacts/snippet-recovery-publish/receipt.json',JSON.stringify({pin,prefix,checked:checked.length,complete:true,checkedAt:new Date().toISOString()}));console.log(JSON.stringify({complete:true,checked:checked.length}))}finally{sdk.destroy()}
