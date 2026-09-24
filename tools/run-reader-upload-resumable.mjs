import {spawn} from 'node:child_process'
import {mkdir,writeFile} from 'node:fs/promises'
import {createWriteStream} from 'node:fs'
import {resolve} from 'node:path'
const root=resolve(import.meta.dirname,'..'),out=resolve(root,'.artifacts/reader-upload-resumable-20260924')
await mkdir(out,{recursive:true})
const stage='.artifacts/pages-reader-extended-20260924/601fbdb9ac80f05dd86d2383/reader-01'
for(let attempt=1;attempt<=8;attempt++){
 const log=createWriteStream(resolve(out,`attempt-${Date.now()}.log`),{flags:'wx'})
 console.log(`Reader upload attempt ${attempt}/8 (per-bucket server checkpoints enabled)`)
 let tail=''
 const code=await new Promise((done,reject)=>{
  const p=spawn(process.execPath,['tools/wrangler-pages-small-batches.cjs','pages','deploy',stage,'--project-name','khezana-reader-01','--branch','reader-extended-20260924','--commit-dirty=true'],{
   cwd:root,windowsHide:true,env:{...process.env,CLOUDFLARE_ACCOUNT_ID:'db956e5187111b69e796e4a8e4c3fe36',WRANGLER_LOG_PATH:'D:/alkhizana/.wrangler-logs'}})
  const onData=b=>{process.stdout.write(b);log.write(b);tail=(tail+b.toString()).slice(-24000)}
  p.stdout.on('data',onData);p.stderr.on('data',onData);p.on('error',reject);p.on('exit',done)
 })
 log.end()
 const urls=[...tail.matchAll(/https:\/\/[a-f0-9]{8}\.khezana-reader-01\.pages\.dev/g)].map(m=>m[0])
 if(code===0&&urls.length){
  const receipt={completedAt:new Date().toISOString(),releaseId:'601fbdb9ac80f05dd86d2383',project:'khezana-reader-01',localDirectory:stage,deploymentUrl:urls.at(-1),uploaded:true,remoteVerified:false,uiPublished:false}
  await writeFile(resolve(out,'receipt.json'),JSON.stringify(receipt,null,2));console.log(JSON.stringify(receipt));process.exit(0)
 }
 await writeFile(resolve(out,'status.json'),JSON.stringify({checkedAt:new Date().toISOString(),attempt,exitCode:code,uploaded:false,uiPublished:false},null,2))
 if(attempt<8){console.log('Transfer interrupted; retrying only missing registered hashes in 30 seconds.');await new Promise(r=>setTimeout(r,30000))}
}
throw Error('reader_upload_network_retries_exhausted')
