import {expect,it,vi} from 'vitest'
import {batchHeadingRanges} from './heading_range_batch'
const url='https://fixture.test/api/search/headings/release/postings/part.bin'
const source=Uint8Array.from({length:100},(_,i)=>i)
const transport=()=>vi.fn(async(_input:RequestInfo|URL,init?:RequestInit)=>{
 const [,a,b]=new Headers(init?.headers).get('Range')!.match(/bytes=(\d+)-(\d+)/)!,start=Number(a),end=Number(b)
 return new Response(source.slice(start,end+1),{status:206,headers:{'content-range':`bytes ${start}-${end}/100`}})
})
const range=(start:number,end:number,signal?:AbortSignal)=>({headers:{Range:`bytes=${start}-${end}`},signal})
it('merges neighbouring requests and returns exact individual ranges',async()=>{
 const fetch=transport(),batch=batchHeadingRanges(fetch)
 const [a,b,c]=await Promise.all([batch(url,range(10,19)),batch(url,range(0,4)),batch(url,range(17,25))])
 expect(fetch).toHaveBeenCalledTimes(1)
 expect(new Headers(fetch.mock.calls[0]![1]!.headers).get('Range')).toBe('bytes=0-25')
 expect([...new Uint8Array(await a.arrayBuffer())]).toEqual([...source.slice(10,20)])
 expect(b.headers.get('content-range')).toBe('bytes 0-4/100');expect(c.headers.get('content-length')).toBe('9')
})
it('does not cross different files or cancellation owners',async()=>{
 const fetch=transport(),batch=batchHeadingRanges(fetch)
 await Promise.all([batch(url,range(0,1,new AbortController().signal)),batch(url,range(2,3,new AbortController().signal)),batch(url+'?v=2',range(4,5))])
 expect(fetch).toHaveBeenCalledTimes(3)
})
it('propagates cancellation before issuing network requests',async()=>{
 const fetch=transport(),batch=batchHeadingRanges(fetch),controller=new AbortController()
 const a=batch(url,range(0,1,controller.signal)),b=batch(url,range(2,3,controller.signal));controller.abort()
 expect((await Promise.allSettled([a,b])).every(x=>x.status==='rejected')).toBe(true);expect(fetch).not.toHaveBeenCalled()
})
it('rejects a malformed combined range without manufacturing successful segments',async()=>{
 const batch=batchHeadingRanges(vi.fn(async()=>new Response(source,{status:206,headers:{'content-range':'bytes 0-99/100'}})))
 const settled=await Promise.allSettled([batch(url,range(0,4)),batch(url,range(5,9))])
 expect(settled.every(x=>x.status==='rejected')).toBe(true)
})
it('falls back to original requests when range batching is unsupported',async()=>{
 const fetch=transport();fetch.mockResolvedValueOnce(new Response(source))
 const batch=batchHeadingRanges(fetch),responses=await Promise.all([batch(url,range(0,4)),batch(url,range(5,9))])
 expect(fetch).toHaveBeenCalledTimes(3);expect(responses.every(r=>r.status===206)).toBe(true)
})
