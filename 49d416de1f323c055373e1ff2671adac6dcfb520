import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),work=resolve(root,'.artifacts/batch28'),ops=resolve(root,'alpha-publish/ops')
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const stage=await read(resolve(work,'stage.json')),verification=await read(resolve(work,'production-http.json')),previous=await read(resolve(ops,'current-production.json'))
assert(stage.passed&&verification.passed);assert.equal(previous.deploymentId,stage.baselineDeploymentId)
const hash=b=>createHash('sha256').update(b).digest('hex')
assert.equal(hash(await readFile(resolve(work,'deploy/pages-dist/q13-manifest.json'))),hash(Buffer.from(await(await fetch('https://khzanah.com/q13-manifest.json',{cache:'no-store'})).arrayBuffer())))
const config=await readFile('C:/Users/Windows_OS/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8'),token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];assert(token)
const body=await(await fetch('https://api.cloudflare.com/client/v4/accounts/db956e5187111b69e796e4a8e4c3fe36/pages/projects/khezana',{headers:{Authorization:`Bearer ${token}`}})).json();assert(body.success)
const deployed=body.result.canonical_deployment;assert.equal(deployed.latest_stage.status,'success');assert.notEqual(deployed.id,previous.deploymentId)
const receipt={...stage,published:true,deploymentId:deployed.id,url:deployed.url,productionUrl:'https://khzanah.com',publishedDirectory:'../.artifacts/batch28/deploy/pages-dist',functionsSnapshot:'../.artifacts/batch28/deploy/functions',sourceSnapshot:'../.artifacts/batch28/source-snapshot.json',previousDeploymentId:previous.deploymentId,rollbackDirectory:previous.publishedDirectory,rollbackFunctionsSnapshot:'../.artifacts/batch27/deploy/functions',primaryAssetVerification:'../.artifacts/batch28/production-http.json',publishedAt:new Date().toISOString(),fullAcceptanceClosed:false,caveats:['Cold sub-second search target remains open.','A legacy normalizer source-hash test still fails, documented before this repair.']}
const name=stage.version+'-deployment.json'
await writeFile(resolve(ops,name),JSON.stringify(receipt,null,2)+'\n');await writeFile(resolve(work,'deployment.json'),JSON.stringify(receipt,null,2)+'\n')
await writeFile(resolve(ops,'current-production.json'),JSON.stringify({version:stage.version,receipt:name,publishedDirectory:receipt.publishedDirectory,deploymentId:deployed.id,previousReceipt:previous.receipt},null,2)+'\n')
console.log(JSON.stringify({version:receipt.version,deploymentId:deployed.id,url:deployed.url}))
