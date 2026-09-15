import {readFile,writeFile,mkdir} from 'node:fs/promises'
import {resolve,sep} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
import {inventory} from '../alpha-publish/scripts/release-integrity.mjs'
const root=resolve(import.meta.dirname,'..'),sha=b=>createHash('sha256').update(b).digest('hex')
const read=async p=>JSON.parse(await readFile(resolve(root,p),'utf8'))
const current=await read('alpha-publish/ops/current-production.json')
const receipt=await read('alpha-publish/ops/'+current.receipt)
assert.equal(current.deploymentId,receipt.deploymentId)
const snapshotRoot=resolve(root,'.artifacts/batch24/frozen-source')
const snapshotBytes=await readFile(resolve(root,'.artifacts/batch24/source-snapshot.json'))
const snapshot=JSON.parse(snapshotBytes)
for(const file of snapshot.files){
 const path=resolve(snapshotRoot,file.path);assert(path.startsWith(snapshotRoot+sep),'source path escape')
 assert.equal(sha(await readFile(path)),file.sha256,'source drift: '+file.path)
}
const assets=await inventory(resolve(root,'alpha-publish',current.publishedDirectory))
assert.equal(assets.fingerprint,receipt.deployFingerprint,'deployed assets drift')
const functions=await inventory(resolve(root,'alpha-publish',receipt.functionsSnapshot))
assert.equal(functions.fingerprint,receipt.functionsFingerprint,'functions drift')
const config=await readFile('C:/Users/Windows_OS/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8')
const token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];assert(token,'OAuth unavailable')
const response=await fetch('https://api.cloudflare.com/client/v4/accounts/db956e5187111b69e796e4a8e4c3fe36/pages/projects/khezana',{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(30000)})
const payload=await response.json();assert(payload.success,'project read failed: '+response.status)
const project=payload.result;assert.equal(project.canonical_deployment?.id,current.deploymentId,'production advanced; rebase required')
const report={checkedAt:new Date().toISOString(),deploymentId:current.deploymentId,version:current.version,sourceFileCount:snapshot.files.length,sourceSnapshotSha256:sha(snapshotBytes),assetsFingerprint:assets.fingerprint,functionsFingerprint:functions.fingerprint,productionBranch:project.production_branch,gitIntegration:project.source?{type:project.source.type,owner:project.source.config?.owner,repoName:project.source.config?.repo_name,productionDeploymentsEnabled:project.source.config?.production_deployments_enabled}:null,productionChanged:false}
await mkdir(resolve(root,'.artifacts/seo-paths'),{recursive:true})
await writeFile(resolve(root,'.artifacts/seo-paths/production-baseline.json'),JSON.stringify(report,null,2))
console.log(JSON.stringify(report))
