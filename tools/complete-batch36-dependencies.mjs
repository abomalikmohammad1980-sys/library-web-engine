// Complete two already-reviewed imports in the unpublished local candidate.
import {readFile,writeFile,copyFile} from 'node:fs/promises'
import {resolve} from 'node:path'
import assert from 'node:assert/strict'
import {inventory} from '../alpha-publish/scripts/release-integrity.mjs'
const root=resolve(import.meta.dirname,'..'),base=resolve(root,'.artifacts/batch36')
const stage=JSON.parse(await readFile(resolve(base,'stage.json')))
assert.equal(stage.published,false)
assert.equal((await inventory(resolve(base,'deploy/pages-dist'))).fingerprint,stage.deployFingerprint)
assert.equal((await inventory(resolve(base,'deploy/functions'))).fingerprint,stage.functionsFingerprint)
for(const name of ['_public-book-index-read.js','_public-book-index-jobs.js']){
 const source=await readFile(resolve(root,'deployment/cloudflare/functions/api',name))
 assert(source.equals(await readFile(resolve(root,'alpha-publish/functions/api',name))))
 await copyFile(resolve(root,'deployment/cloudflare/functions/api',name),resolve(base,'deploy/functions/api',name))
}
stage.functionsFingerprint=(await inventory(resolve(base,'deploy/functions'))).fingerprint
stage.overlay=JSON.parse(await readFile(resolve(root,'tools/batch36-reviewed-overlay.json')))
await writeFile(resolve(base,'stage.json'),JSON.stringify(stage,null,2))
console.log(JSON.stringify({verified:true,functionsFingerprint:stage.functionsFingerprint}))
