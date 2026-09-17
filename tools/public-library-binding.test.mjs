import test from 'node:test'
import assert from 'node:assert/strict'
import {onRequest} from '../alpha-publish/functions/library/[[path]].js'
import {onRequest as packed} from '../alpha-publish/functions/r2/[[path]].js'
const object=()=>({size:4,httpEtag:'"fixture"',body:new Response('data').body,writeHttpMetadata:h=>h.set('content-type','text/plain')})
test('optional public binding serves GET and HEAD without mutating upload binding',async()=>{
 for(const method of ['GET','HEAD']){
  const calls=[],uploads={get:()=>{throw Error('upload read')},put:()=>{throw Error('upload write')}}
  const publicBucket={get:async k=>{calls.push(['get',k]);return object()},head:async k=>{calls.push(['head',k]);return object()},put:()=>{throw Error('public write')},delete:()=>{throw Error('public delete')}}
  const env={LIBRARY_R2:uploads,PUBLIC_LIBRARY_R2:publicBucket}
  const response=await onRequest({request:new Request('https://preview.test/library/search-fields/manifest.json',{method}),env})
  assert.equal(response.status,200);assert.equal(env.LIBRARY_R2,uploads)
  assert.deepEqual(calls,[[method.toLowerCase(),'library/search-fields/manifest.json']])
  assert.equal(await response.text(),method==='HEAD'?'':'data')
 }
})
test('absent override retains existing production binding',async()=>{
 let count=0
 const response=await onRequest({request:new Request('https://khzanah.com/library/book.json'),env:{LIBRARY_R2:{get:async()=>{count++;return object()}}}})
 assert.equal(response.status,200);assert.equal(count,1)
})
test('override cannot permit writes or unsafe keys',async()=>{
 const fail=()=>{throw Error('must not access any object')},env={LIBRARY_R2:{get:fail},PUBLIC_LIBRARY_R2:{get:fail,head:fail,put:fail,delete:fail}}
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await onRequest({request:new Request('https://preview.test/library/book.json',{method}),env})).status,405)
 assert.equal((await onRequest({request:new Request('https://preview.test/library/%252e%252e/secret'),env})).status,404)
})
test('release-bound static scope bypass stays on Pages with override configured',async()=>{
 const expected=new Response('scope'),fail=()=>{throw Error('unexpected bucket call')}
 assert.equal(await onRequest({request:new Request('https://preview.test/library/shamela/sunnah-scope.json'),env:{PUBLIC_LIBRARY_R2:{get:fail}},next:()=>expected}),expected)
})
test('packed public gateway override preserves GET HEAD ranges and all write/private-key guards',async()=>{
 const seen=[],fail=()=>{throw Error('unexpected isolated bucket access')}
 const original={get:fail,put:fail,delete:fail},env={LIBRARY_R2:original,PUBLIC_LIBRARY_R2:{get:async(k,options)=>{seen.push(k);return {...object(),range:options.range.has('range')?{offset:1,length:2}:undefined}},head:async k=>{seen.push(k);return object()},put:fail,delete:fail}}
 for(const method of ['GET','HEAD'])assert.equal((await packed({request:new Request('https://preview.test/r2/khezana-search-v2-00/control/manifest.json',{method}),env})).status,200)
 const range=await packed({request:new Request('https://preview.test/r2/khezana-search-v2-00/archive.bin',{headers:{range:'bytes=1-2'}}),env})
 assert.equal(range.status,206);assert.equal(range.headers.get('content-range'),'bytes 1-2/4')
 for(const method of ['POST','PUT','PATCH','DELETE'])assert.equal((await packed({request:new Request('https://preview.test/r2/key',{method}),env})).status,405)
 for(const path of ['private/secret','%252e%252e/secret'])assert.equal((await packed({request:new Request('https://preview.test/r2/'+path),env})).status,404)
 assert.equal(seen.length,3);assert.equal(env.LIBRARY_R2,original)
})
