import {expect,it,vi} from 'vitest'
import {searchBatchFetch} from './search_batch_fetch'
const origin='https://example.test'
it('batches concurrent objects while preserving verified range bytes and headers',async()=>{
 const fetcher=vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
  expect(JSON.parse(init!.body as string)).toHaveLength(2)
  const meta=new TextEncoder().encode(JSON.stringify([{status:206,headers:{'content-range':'bytes 0-1/9','content-length':'2'},length:2},{status:200,headers:{'content-type':'application/json'},length:2}]))
  const bytes=new Uint8Array(4+meta.length+4);new DataView(bytes.buffer).setUint32(0,meta.length);bytes.set(meta,4);bytes.set([1,2,123,125],4+meta.length)
  return new Response(bytes,{headers:{'x-search-batch':'1'}})
 })
 const fetch=searchBatchFetch(fetcher as typeof globalThis.fetch,origin)
 const [a,b]=await Promise.all([fetch(origin+'/r2/khezana-search-v2-00/archives/000001.bin',{headers:{Range:'bytes=0-1'}}),fetch(origin+'/r2/khezana-search-v2-00/control/indexes/0001.json')])
 expect(fetcher).toHaveBeenCalledTimes(1);expect(a.status).toBe(206);expect(a.headers.get('content-range')).toBe('bytes 0-1/9');expect([...new Uint8Array(await a.arrayBuffer())]).toEqual([1,2]);expect(await b.json()).toEqual({})
})
it('falls back to original requests when batch support is absent',async()=>{
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('/batch')?new Response(null,{status:404}):new Response('original'))
 const fetch=searchBatchFetch(fetcher as typeof globalThis.fetch,origin)
 expect(await(await fetch(origin+'/r2/khezana-search-v2-00/control/manifest.json')).text()).toBe('original');expect(fetcher).toHaveBeenCalledTimes(2)
})
it('does not intercept private or unrelated resources',async()=>{
 const fetcher=vi.fn(async()=>new Response('untouched')),fetch=searchBatchFetch(fetcher as typeof globalThis.fetch,origin)
 await fetch('/api/account');expect(fetcher).toHaveBeenCalledWith('/api/account',undefined)
})
it('preserves streaming progress and cancellation for term directories',async()=>{
 const fetcher=vi.fn(async()=>new Response('directory')),fetch=searchBatchFetch(fetcher as typeof globalThis.fetch,origin),signal=new AbortController().signal
 const url=origin+'/r2/khezana-search-v2-00/control/term-indexes/0001.json'
 await fetch(url,{signal});expect(fetcher).toHaveBeenCalledExactlyOnceWith(url,{signal})
})
it('splits a large wave into bounded batches and falls back on a malformed frame',async()=>{
 const sizes:number[]=[]
 const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{
  if(String(input).endsWith('/batch')){sizes.push(JSON.parse(init!.body as string).length);return new Response(new Uint8Array([0,0,0,1,123]),{headers:{'x-search-batch':'1'}})}
  return new Response(String(input))
 })
 const fetch=searchBatchFetch(fetcher as typeof globalThis.fetch,origin)
 const urls=Array.from({length:49},(_,i)=>origin+'/r2/khezana-search-v2-00/archives/'+String(i).padStart(6,'0')+'.bin')
 const responses=await Promise.all(urls.map(url=>fetch(url,{headers:{range:'bytes=0-1'}})))
 expect(sizes).toEqual([24,24,1]);expect(await Promise.all(responses.map(r=>r.text()))).toEqual(urls)
})
it('bounds aggregate bytes as well as request count',async()=>{
 const sizes:number[]=[]
 const fetcher=vi.fn(async(input:RequestInfo|URL,init?:RequestInit)=>{if(String(input).endsWith('/batch'))sizes.push(JSON.parse(init!.body as string).length);return new Response(null,{status:404})})
 const fetch=searchBatchFetch(fetcher as typeof globalThis.fetch,origin)
 await Promise.all(Array.from({length:10},()=>fetch(origin+'/r2/khezana-search-v2-00/archives/000001.bin',{headers:{range:'bytes=0-2097151'}})))
 expect(sizes).toEqual([4,4,2])
})
