import {test} from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {serveHeadingPartition} from './heading-static-partition.mjs'
const sha=x=>createHash('sha256').update(x).digest('hex'),part=new Uint8Array([3,4,5]),pack=new Uint8Array([1,2,3,4,5,6]),release='a'.repeat(64),id='b'.repeat(64)
const descriptor={baseURL:`./data/heading-dictionary/${release}/packed-v2/`,parts:{sourceManifestSha256:release,shards:[{path:`dictionary/${id}.bin`,gzipBytes:3,gzipSha256:sha(part)}]},locations:{[`dictionary/${id}.bin`]:{path:sha(pack)+'.bin',offset:2,bytes:3,packBytes:6}}}
const request=()=>new Request(`https://fixture.test/api/search/heading-partitions/${release}/${id}.bin`)
test('streams only verified shard bytes from an ignored-Range full pack',async()=>{
 let requested
 const response=await serveHeadingPartition(request(),{fetch:async r=>{requested=r;return new Response(pack)}},descriptor)
 assert.equal(requested.headers.get('range'),'bytes=2-4')
 assert.equal(response.status,200);assert.deepEqual(new Uint8Array(await response.arrayBuffer()),part)
 assert.equal(response.headers.get('content-length'),'3');assert.match(response.headers.get('cache-control'),/immutable/)
})
test('supports exact206 and rejects misplaced ranges and corrupted bytes',async()=>{
 for(const [bytes,range,expected] of [[part,'bytes 2-4/6',200],[part,'bytes 3-5/6',502],[new Uint8Array(3),'bytes 2-4/6',502]]){
  const response=await serveHeadingPartition(request(),{fetch:async()=>new Response(bytes,{status:206,headers:{'content-range':range}})},descriptor)
  assert.equal(response.status,expected)
 }
})
test('rejects unknown releases, query parameters and oversized descriptors before I/O',async()=>{
 const assets={fetch:()=>{throw Error('unexpected fetch')}}
 assert.equal((await serveHeadingPartition(new Request(request().url+'?x=1'),assets,descriptor)).status,400)
 assert.equal((await serveHeadingPartition(new Request(request().url.replace(release,'c'.repeat(64))),assets,descriptor)).status,404)
 const bad=structuredClone(descriptor);bad.locations[`dictionary/${id}.bin`].bytes=1048577
 assert.equal((await serveHeadingPartition(request(),assets,bad)).status,503)
})
test('rejects truncated full packs and permits request cancellation',async()=>{
 assert.equal((await serveHeadingPartition(request(),{fetch:async()=>new Response(pack.slice(0,3))},descriptor)).status,502)
 const controller=new AbortController();controller.abort()
 assert.equal((await serveHeadingPartition(new Request(request().url,{signal:controller.signal}),{fetch:async()=>new Response(pack)},descriptor)).status,502)
})
