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
test('large metadata uses exact bounded ranges without accepting whole-file fallback',async()=>{
 const size=1024**2+7,source=Buffer.alloc(size,65),ranges=[]
 const result=await readPublicFieldObject(key,size,{prefix,fetchImpl:async(url,options)=>{
  const match=options.headers.Range.match(/^bytes=(\d+)-(\d+)$/),start=Number(match[1]),end=Number(match[2]);ranges.push([start,end])
  assert(end-start+1<=512*1024)
  return new Response(source.subarray(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/${size}`}})
 }})
 assert.deepEqual(result,source);assert.equal(ranges.length,3)
 await assert.rejects(readPublicFieldObject(key,size,{prefix,fetchImpl:async()=>new Response('abc')}),/public_http_200/)
 await assert.rejects(readPublicFieldObject(key,size,{prefix,fetchImpl:async()=>new Response('abc',{status:206})}),/public_verify_range/)
})
