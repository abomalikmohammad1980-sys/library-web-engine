import {test} from 'node:test'
import assert from 'node:assert/strict'
import {onRequest} from '../alpha-publish/functions/api/search/batch.js'
test('rejects private paths, external origins and oversized batches before storage',async()=>{
 const env={LIBRARY_R2:{get(){throw Error('must not read')}}}
 for(const input of [[{path:'/library/private/book'}],Array(25).fill({path:'/r2/khezana-search-v2-00/control/manifest.json'})])assert.equal((await onRequest({env,request:new Request('https://x.test/api/search/batch',{method:'POST',body:JSON.stringify(input)})})).status,400)
 assert.equal((await onRequest({env,request:new Request('https://x.test/api/search/batch',{method:'POST',headers:{origin:'https://other.test'},body:'[]'})})).status,403)
})
test('returns exact framed bytes with independently checkable range headers',async()=>{
 const bytes=new Uint8Array([4,5]),env={LIBRARY_R2:{get:async()=>({size:10,range:{offset:2,length:2},arrayBuffer:async()=>bytes.buffer})}}
 const response=await onRequest({env,request:new Request('https://x.test/api/search/batch',{method:'POST',body:JSON.stringify([{path:'/r2/khezana-search-v2-00/archives/000001.bin',range:'bytes=2-3'}])})})
 assert.equal(response.status,200);const raw=new Uint8Array(await new Response(response.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()),n=new DataView(raw.buffer).getUint32(0),meta=JSON.parse(new TextDecoder().decode(raw.subarray(4,4+n)))
 assert.equal(meta[0].headers['content-range'],'bytes 2-3/10');assert.deepEqual([...raw.subarray(4+n)],[4,5])
})
