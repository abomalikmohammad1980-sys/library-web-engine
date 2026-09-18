import {readFile,writeFile} from 'node:fs/promises'
import {createHash} from 'node:crypto'
import {S3Client,GetObjectCommand,PutObjectCommand} from '@aws-sdk/client-s3'
import {parseR2Config} from './field-overlay-upload-state.mjs'
import {positionFilterRoot} from './position-filter-config.mjs'
const sha=b=>createHash('sha256').update(b).digest('hex'),raw=await readFile(positionFilterRoot+'/descriptor.json'),descriptor=JSON.parse(raw),proof=JSON.parse(await readFile(positionFilterRoot+'/proof.json')),audit=JSON.parse(await readFile('.artifacts/position-filter-audit.json'))
if(proof.falseNegatives!==0||proof.checked!==proof.positions||!audit.coverageComplete||audit.falseNegatives!==0)throw Error('proof_required')
const prefix='library/position-filters/'+descriptor.sha256+'/',jobs=[]
for(const p of descriptor.parts){if(!/^\d{3}\.bin$/.test(p.path))throw Error('path');const bytes=await readFile(positionFilterRoot+'/'+p.path);if(bytes.length!==p.byteLength||sha(bytes)!==p.sha256)throw Error('integrity');jobs.push({...p,bytes})}
if(sha(Buffer.concat(jobs.map(j=>j.bytes)))!==descriptor.sha256)throw Error('whole_integrity')
jobs.push({path:'descriptor.json',bytes:raw,sha256:sha(raw)})
if(process.argv[2]!=='--execute'){console.log(JSON.stringify({prefix,objects:jobs.length,bytes:jobs.reduce((n,j)=>n+j.bytes.length,0)}));process.exit(0)}
const config=parseR2Config(await readFile('C:/Users/Windows_OS/AppData/Roaming/rclone/rclone.conf','utf8')),sdk=new S3Client({...config,region:'auto',forcePathStyle:true,maxAttempts:3,requestChecksumCalculation:'WHEN_REQUIRED'})
try{for(const job of jobs){const params={Bucket:'khzanah-library',Key:prefix+job.path};let response
 try{response=await sdk.send(new GetObjectCommand(params),{abortSignal:AbortSignal.timeout(30000)})}catch(e){if(e.$metadata?.httpStatusCode!==404)throw e}
 if(!response){await sdk.send(new PutObjectCommand({...params,Body:job.bytes,IfNoneMatch:'*',ContentType:job.path.endsWith('.json')?'application/json':'application/octet-stream',CacheControl:'public,max-age=31536000,immutable'}),{abortSignal:AbortSignal.timeout(30000)});response=await sdk.send(new GetObjectCommand(params),{abortSignal:AbortSignal.timeout(30000)})}
 const bytes=await response.Body.transformToByteArray();if(bytes.length!==job.bytes.length||sha(bytes)!==job.sha256)throw Error('remote_integrity');console.log(JSON.stringify({verified:job.path}))
}await writeFile('.artifacts/position-filter-upload.json',JSON.stringify({prefix,objects:jobs.length,complete:true,checkedAt:new Date().toISOString()}))}finally{sdk.destroy()}
