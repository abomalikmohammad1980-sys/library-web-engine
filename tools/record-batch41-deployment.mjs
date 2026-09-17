// Receipt only, no deployment or network. Explicit evidence is required.
import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import {pathToFileURL} from 'node:url'
export function deploymentReceipt(stage,evidence,configSha256){
 if(!stage.compilePassed||stage.version!=='batch-20260917-41')throw Error('candidate_not_compiled')
 if(!evidence.preview?.passed||evidence.preview.payloadFingerprint!==stage.payloadFingerprint||evidence.preview.functionsFingerprint!==stage.functionsFingerprint)throw Error('fresh_matching_preview_required')
 if(!evidence.live?.passed||!evidence.live.payloadMatches||evidence.live.payloadFingerprint!==stage.payloadFingerprint)throw Error('matching_live_evidence_required')
 if(!/^[a-f0-9-]{36}$/.test(evidence.deploymentId??'')||!new RegExp('^https://'+evidence.deploymentId.slice(0,8)+'\\.khezana\\.pages\\.dev/?$').test(evidence.url??''))throw Error('deployment_identity_invalid')
 if(!/^[a-f0-9]{40}$/.test(evidence.sourceCommit??'')||!evidence.scope)throw Error('reviewed_commit_scope_required')
 const deployFingerprint=createHash('sha256').update(JSON.stringify({payloadFingerprint:stage.payloadFingerprint,functionsFingerprint:stage.functionsFingerprint,configSha256})).digest('hex')
 return {published:true,productionReady:true,deploymentId:evidence.deploymentId,url:evidence.url,deployFingerprint,functionsFingerprint:stage.functionsFingerprint,payloadFingerprint:stage.payloadFingerprint,sourceCommit:evidence.sourceCommit,previousDeploymentId:'214d9565-f244-41d5-af51-e86309c463ce',scope:evidence.scope,liveChecks:evidence.live,browser:evidence.browser??'Not established by this receipt',previewChecks:evidence.preview,staticFileManifest:'static-source-manifest.json',functionsFileManifest:'functions-manifest.json',configSha256,recordedAt:new Date().toISOString()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const root=resolve(import.meta.dirname,'..'),candidate=resolve(root,'.artifacts/batch41'),input=process.argv[2]
 if(!input)throw Error('deployment_evidence_json_required')
 const stage=JSON.parse(await readFile(resolve(candidate,'stage.json'),'utf8')),evidence=JSON.parse(await readFile(resolve(input),'utf8')),config=await readFile(resolve(candidate,'deploy/wrangler.jsonc'))
 const receipt=deploymentReceipt(stage,evidence,createHash('sha256').update(config).digest('hex'))
 const currentPath=resolve(root,'alpha-publish/ops/current-production.json'),current=process.argv.includes('--record-ops')?JSON.parse(await readFile(currentPath,'utf8')):null
 if(current&&current.deploymentId!==receipt.previousDeploymentId)throw Error('previous_production_changed')
 await writeFile(resolve(candidate,'deployment.json'),JSON.stringify(receipt,null,2),{flag:'wx'})
 if(process.argv.includes('--record-ops')){
  await writeFile(resolve(root,'alpha-publish/ops/batch-20260917-41-deployment.json'),JSON.stringify(receipt,null,2),{flag:'wx'})
  await writeFile(resolve(candidate,'rollback.json'),JSON.stringify(current,null,2),{flag:'wx'})
  await writeFile(currentPath,JSON.stringify({version:stage.version,receipt:'batch-20260917-41-deployment.json',publishedDirectory:'../.artifacts/batch41/deploy/pages-dist',deploymentId:receipt.deploymentId,previousReceipt:current.receipt},null,2))
 }
 console.log(JSON.stringify({receipt:resolve(candidate,'deployment.json'),deploymentId:receipt.deploymentId,payloadFingerprint:receipt.payloadFingerprint}))
}
