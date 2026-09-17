import {test} from 'node:test'
import assert from 'node:assert/strict'
import {readPublicFieldObject} from './field-public-read.mjs'
const prefix='library/search-fields/test',key=prefix+'/books/1.json'
test('public read validates bytes and does not follow redirects',async()=>{
 const result=await readPublicFieldObject(key,3,{prefix,fetchImpl:async(url,options)=>{assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return new Response('abc')}})
 assert.equal(result.toString(),'abc')
})
test('size mismatch is not retriable',async()=>{
 await assert.rejects(readPublicFieldObject(key,2,{prefix,fetchImpl:async()=>new Response('abc')}),e=>e.message==='public_verify_size'&&!e.transient)
})
test('network errors are retriable but namespace errors are not',async()=>{
 await assert.rejects(readPublicFieldObject(key,3,{prefix,fetchImpl:async()=>{throw new TypeError('fetch failed')}}),e=>e.transient===true)
 await assert.rejects(readPublicFieldObject(prefix+'/../secret',3,{prefix}),/public_verify_key/)
})
test('upload probes do not reuse negative-cache keys; normal verification is canonical',async()=>{
 const urls=[],fetchImpl=async url=>{urls.push(url);return new Response('abc')}
 await readPublicFieldObject(key,3,{prefix,fetchImpl,avoidNegativeCache:true})
 await readPublicFieldObject(key,3,{prefix,fetchImpl,avoidNegativeCache:true})
 await readPublicFieldObject(key,3,{prefix,fetchImpl})
 assert.notEqual(urls[0],urls[1]);assert.equal(new URL(urls[0]).pathname,'/'+key)
 assert.equal(urls[2],'https://khzanah.com/'+key)
})
