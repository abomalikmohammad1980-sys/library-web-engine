import {readFile,writeFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import {createHash} from 'node:crypto'
import assert from 'node:assert/strict'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch33'),ops=resolve(root,'alpha-publish/ops')
const read=async p=>JSON.parse(await readFile(p,'utf8'))
const stage=await read(resolve(base,'stage.json')),previous=await read(resolve(ops,'current-production.json'))
assert.equal(previous.deploymentId,stage.baselineDeploymentId)
const checks=[]
for(const [path,status] of [['/',200],['/books/151179',200],['/authors/000020',200],['/books/999999999',404],['/api/library/book-editions?id=410021633',200]]){
 const r=await fetch('https://khzanah.com'+path,{cache:'no-store'}),text=await r.text()
 checks.push({path,status:r.status,title:text.match(/<title>(.*?)<\/title>/)?.[1]})
 assert.equal(r.status,status,JSON.stringify(checks.at(-1)))
}
const sha=b=>createHash('sha256').update(b).digest('hex')
assert.equal(sha(await readFile(resolve(base,'deploy/pages-dist/q13-manifest.json'))),sha(Buffer.from(await(await fetch('https://khzanah.com/q13-manifest.json',{cache:'no-store'})).arrayBuffer())))
const config=await readFile('C:/Users/Windows_OS/AppData/Roaming/xdg.config/.wrangler/config/default.toml','utf8'),token=/^oauth_token\s*=\s*"([^"]+)"/m.exec(config)?.[1];assert(token)
const info=await(await fetch('https://api.cloudflare.com/client/v4/accounts/db956e5187111b69e796e4a8e4c3fe36/pages/projects/khezana',{headers:{Authorization:`Bearer ${token}`}})).json();assert(info.success)
const deployed=info.result.canonical_deployment;assert.equal(deployed.latest_stage.status,'success');assert(deployed.url.includes('a5ff7588'))
const receipt={...stage,published:true,productionReady:true,fullAcceptanceClosed:false,deploymentId:deployed.id,url:deployed.url,productionUrl:'https://khzanah.com',publishedAt:new Date().toISOString(),publishedDirectory:'../.artifacts/batch33/deploy/pages-dist',rollbackDirectory:previous.publishedDirectory,previousDeploymentId:previous.deploymentId,checks,migration:'0031_independent_pdf_editions applied successfully',caveats:['Field-separated search activation remains gated and is not included.','BOK publication activation has not passed isolated cloud acceptance.','Original DOCX visual comparison and full slow-network timing remain open.','Edition endpoint recognizes 21633 but returns 404 for 151179; edition coverage for that book remains open, while its reader works.']}
const name=stage.version+'-deployment.json'
await writeFile(resolve(ops,name),JSON.stringify(receipt,null,2)+'\n')
await writeFile(resolve(base,'deployment.json'),JSON.stringify(receipt,null,2)+'\n')
await writeFile(resolve(ops,'current-production.json'),JSON.stringify({version:stage.version,receipt:name,publishedDirectory:receipt.publishedDirectory,deploymentId:deployed.id,previousReceipt:previous.receipt},null,2)+'\n')
console.log(JSON.stringify({deploymentId:deployed.id,url:deployed.url,checks}))
