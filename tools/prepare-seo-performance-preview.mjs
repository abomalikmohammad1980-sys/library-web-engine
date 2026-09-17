// Clone the verified SEO preview; freeze only the reviewed server optimizations.
// No client rebuild, ingestion activation, migrations or production deployment.
import {readFile,writeFile,mkdir,cp,stat} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {inventory} from '../alpha-publish/scripts/release-integrity.mjs'
const candidate=process.argv[2]??'batch38'
assert(/^batch\d+$/.test(candidate)&&candidate!=='batch37','invalid_candidate')
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch37'),target=resolve(root,'.artifacts',candidate)
const stage=JSON.parse(await readFile(resolve(base,'stage.json')))
assert(stage.buildPassed&&stage.seoPreview?.remoteVerified&&!stage.published,'verified_preview_required')
assert.equal((await inventory(resolve(base,'deploy/pages-dist'))).fingerprint,stage.deployFingerprint)
assert.equal((await inventory(resolve(base,'deploy/functions'))).fingerprint,stage.functionsFingerprint)
try{await stat(target);throw Error('candidate_exists')}catch(e){if(e.code!=='ENOENT')throw e}
const names=['_middleware.js','_seo-data-release.js','_seo-listings.js','_seo-edge-cache.js'],frozen=new Map()
for(const name of names){
 const bytes=await readFile(resolve(root,'alpha-publish/functions',name))
 assert(bytes.equals(await readFile(resolve(root,'deployment/cloudflare/functions',name))),'mirror_mismatch:'+name)
 frozen.set(name,bytes)
}
await mkdir(target,{recursive:true})
await cp(resolve(base,'deploy'),resolve(target,'deploy'),{recursive:true,errorOnExist:true,force:false})
for(const name of ['source-snapshot.json','rollback.json'])await cp(resolve(base,name),resolve(target,name),{errorOnExist:true,force:false})
for(const name of ['app','packages'])await cp(resolve(base,name),resolve(target,name),{recursive:true,errorOnExist:true,force:false})
for(const [name,bytes] of frozen)await writeFile(resolve(target,'deploy/functions',name),bytes)
const functionsFingerprint=(await inventory(resolve(target,'deploy/functions'))).fingerprint
let config=await readFile(resolve(target,'deploy/wrangler.toml'),'utf8')
assert(config.includes('9133fe99-c4e1-4a1e-84f3-127735883279'),'isolated_database_required')
assert(!/PUBLIC_BOOK_(?:SEARCH|INGESTION)_ENABLED/.test(config),'ingestion_not_in_this_preview')
config=config.replace(/SEO_HTML_CACHE_VERSION = "[a-f0-9]+"/,`SEO_HTML_CACHE_VERSION = "${functionsFingerprint}"`)
await writeFile(resolve(target,'deploy/wrangler.toml'),config)
assert.equal((await inventory(resolve(target,'deploy/pages-dist'))).fingerprint,stage.deployFingerprint,'client_payload_must_not_change')
await writeFile(resolve(target,'stage.json'),JSON.stringify({...stage,version:`batch-20260917-${candidate.slice(5)}`,productionReady:false,published:false,functionsFingerprint,previewBaseline:stage.functionsFingerprint,clientBuildReusedFrom:'batch37',reviewedServerChanges:names,seoPreview:{...stage.seoPreview,cacheVersion:functionsFingerprint,remoteVerified:false},acceptanceRequired:['Functions compile','remote functional checks','30-URL latency measurement'],createdAt:new Date().toISOString()},null,2))
console.log(JSON.stringify({candidate,functionsFingerprint,deployFingerprint:stage.deployFingerprint,files:stage.files,productionReady:false}))
