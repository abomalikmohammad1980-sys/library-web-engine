import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),work=resolve(root,'.artifacts/batch25'),ops=resolve(root,'alpha-publish/ops')
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const stage=await read(resolve(work,'stage.json')),verification=await read(resolve(work,'production-verification.json'))
assert(stage.passed&&verification.passed);assert.equal(verification.origin,'https://khzanah.com');assert.equal(stage.deployFingerprint,verification.fingerprint)
const config=await readFile('C:/Users/Windows_OS/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8')
const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];assert(token)
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/db956e5187111b69e796e4a8e4c3fe36/pages/projects/khezana',{headers:{Authorization:`Bearer ${token}`}})
const body=await response.json();assert(body.success)
const deployed=body.result.canonical_deployment;assert(deployed?.id);assert.notEqual(deployed.id,stage.baselineDeploymentId)
assert.equal(deployed.latest_stage.status,'success')
const previous=await read(resolve(ops,'current-production.json'));assert.equal(previous.deploymentId,stage.baselineDeploymentId)
const receipt={version:stage.version,deploymentId:deployed.id,url:deployed.url,productionUrl:'https://khzanah.com',publishedDirectory:'../.artifacts/batch25/deploy/pages-dist',payloadFingerprint:stage.payloadFingerprint,deployFingerprint:stage.deployFingerprint,functionsFingerprint:stage.functionsFingerprint,functionsSnapshot:'../.artifacts/batch25/deploy/functions',previousDeploymentId:previous.deploymentId,rollbackDirectory:previous.publishedDirectory,rollbackFunctionsSnapshot:'../.artifacts/batch24/functions',dataChanges:stage.dataChanges,productionMigrationsApplied:[],primaryAssetVerification:'../.artifacts/batch25/production-verification.json',sourceSnapshot:'../.artifacts/batch25/source-snapshot.json',handoffSha256:stage.handoffSha256,acceptedUnlinkedCount:10,seoIncluded:false,fullAcceptanceClosed:false,browserVerification:null,browserCaveat:'Fresh browser verification unavailable: browser policy initialization failed. Exact reviewed package acceptance and live HTTP integrity checks passed.',publishedAt:new Date().toISOString(),included:['Six reviewed tafsir additions and targeted corrections','Ten accepted unverified library destinations rendered without links; commentary preserved']}
const name=stage.version+'-deployment.json'
receipt.browserVerification='../.artifacts/batch25/production-browser.json'
receipt.browserCaveat='Live Chrome spot-check: all six additions visible in chronological list; Mawardi 3:152 displays commentary with zero links; Nazm al-Durar 3:152 displays commentary and a reader link. Not a full end-to-end regression suite.'
await writeFile(resolve(ops,name),JSON.stringify(receipt,null,2)+'\n')
await writeFile(resolve(ops,'current-production.json'),JSON.stringify({version:stage.version,receipt:name,publishedDirectory:receipt.publishedDirectory,deploymentId:deployed.id,previousReceipt:previous.receipt},null,2)+'\n')
await writeFile(resolve(work,'deployment.json'),JSON.stringify(receipt,null,2)+'\n')
console.log(JSON.stringify(receipt))
