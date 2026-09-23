import {test} from 'node:test'
import assert from 'node:assert/strict'
import {onRequest} from '../edge-functions/api/library/catalog-snapshot.js'

const sha='157b8a546eabb127d3627268851c0cc0a091f4d32c58018c2cdd8565173ea05d'
test('streams the pinned static snapshot without querying a database',async()=>{
 let requested
 const env={ASSETS:{fetch:async input=>{requested=String(input);return new Response('{"ok":true}',{headers:{'content-type':'text/plain'}})}}}
 const response=await onRequest({request:new Request(`https://khzanah.com/api/library/catalog-snapshot?v=${sha}`),env})
 assert.equal(requested,'https://khzanah.com/data/shamela-catalog.snapshot.json')
 assert.equal(response.status,200)
 assert.equal(response.headers.get('cache-control'),'public, max-age=31536000, immutable')
 assert.equal(await response.text(),'{"ok":true}')
})
test('rejects another release before touching assets',async()=>{
 const env={ASSETS:{fetch:()=>{throw Error('unexpected')}}}
 const response=await onRequest({request:new Request('https://khzanah.com/api/library/catalog-snapshot?v=wrong'),env})
 assert.equal(response.status,400)
})
