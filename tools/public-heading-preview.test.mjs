import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readFile} from 'node:fs/promises'
import {usePublicHeadingBucket} from '../server/public-heading-preview.mjs'
test('only the read-only heading route receives the public binding',async()=>{
 const source=await readFile('.artifacts/batch53/deploy/functions/api/search/headings/[[path]].js','utf8'),patched=usePublicHeadingBucket(source),{onRequest}=await import('data:text/javascript;base64,'+Buffer.from(patched).toString('base64'))
 let reads=0;const isolated={get(){throw Error('private_bucket_read')}},publicBucket={get(){reads++;return null}},env={LIBRARY_R2:isolated,PUBLIC_LIBRARY_R2:publicBucket,HEADING_RELEASE_SHA256:'a'.repeat(64)},url='https://test.invalid/api/search/headings/'+'a'.repeat(64)+'/manifest.json'
 assert.equal((await onRequest({request:new Request(url,{method:'POST'}),env})).status,405);assert.equal(reads,0)
 assert.equal((await onRequest({request:new Request(url),env})).status,503);assert.equal(reads,1);assert.equal(env.LIBRARY_R2,isolated)
 assert.throws(()=>usePublicHeadingBucket('different source'),/unreviewed/)
})
