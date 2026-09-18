// Local receipt only, after preview AND production acceptance; no cloud writes.
import {readFile,writeFile} from 'node:fs/promises'
import assert from 'node:assert/strict'
const [deploymentId,sourceCommit]=process.argv.slice(2)
assert(/^[a-f0-9-]{36}$/.test(deploymentId??''));assert(/^[a-f0-9]{40}$/.test(sourceCommit??''))
const batch=process.argv[4]??'45';assert(['45','48','53','54'].includes(batch))
const root='.artifacts/batch'+batch,read=async path=>JSON.parse(await readFile(path,'utf8'))
const stage=await read(root+'/stage.json'),current=await read('alpha-publish/ops/current-production.json')
assert.equal(current.deploymentId,stage.baselineDeploymentId);assert.equal(stage.fieldsActivated,false)
const checks={}
for(const phase of ['preview','live']){
 const assets=await read(root+'/'+phase+'-assets.json'),http=await read(root+'/'+phase+'-http.json')
 assert(assets.passed&&http.passed);assert.equal(assets.payloadFingerprint,stage.payloadFingerprint);assert.equal(assets.base,http.base)
 assert(assets.checked>=120);assert.equal(assets.fieldsActivated,false)
 if(phase==='live')assert.equal(http.base,'https://khzanah.com')
 checks[phase]={assets,http}
}
const browser=await read(root+'/browser.json');assert.equal(browser.passed,true);assert.equal(browser.origin,checks.preview.http.base)
const receipt={...stage,published:true,productionReady:true,deploymentId,url:`https://${deploymentId.slice(0,8)}.khezana.pages.dev`,sourceCommit,previousDeploymentId:current.deploymentId,checks,browser,scope:'Verified search transport and pinned snippet recovery; separated field overlay remains inactive',recordedAt:new Date().toISOString()}
await writeFile(root+'/deployment.json',JSON.stringify(receipt,null,2),{flag:'wx'})
if(['53','54'].includes(batch))await writeFile(`docs/design-audit/BATCH${batch}_DEPLOYMENT_20260918.json`,JSON.stringify(receipt,null,2),{flag:'wx'})
await writeFile(`alpha-publish/ops/batch-20260918-${batch}-deployment.json`,JSON.stringify(receipt,null,2),{flag:'wx'})
await writeFile('alpha-publish/ops/current-production.json',JSON.stringify({version:stage.version,receipt:`batch-20260918-${batch}-deployment.json`,publishedDirectory:`../.artifacts/batch${batch}/deploy/pages-dist`,deploymentId,previousReceipt:current.receipt},null,2))
console.log(JSON.stringify({recorded:true,deploymentId,payloadFingerprint:stage.payloadFingerprint}))
