import {createHash} from 'node:crypto'
import {expect,it,vi} from 'vitest'
import {HeadingPackCache} from './heading_pack_cache'
import {fetchPackedHeadingPartition} from './heading_dictionary_release'
const pack=new Uint8Array([0,1,2,3,4,5,6,7])
const urlFor=(bytes:Uint8Array)=>new URL('https://fixture.test/'+createHash('sha256').update(bytes).digest('hex')+'.bin')
it('downloads an ignored-Range pack only once and returns exact later slices',async()=>{
 const cache=new HeadingPackCache(),url=urlFor(pack),fetcher=vi.fn(async()=>new Response(pack))
 const first=await fetchPackedHeadingPartition(url,{path:url.pathname,offset:1,bytes:3,packBytes:8},undefined,fetcher,cache)
 const second=await fetchPackedHeadingPartition(url,{path:url.pathname,offset:5,bytes:3,packBytes:8},{headers:{Range:'bytes=1-2'}},fetcher,cache)
 expect([...new Uint8Array(await first.arrayBuffer())]).toEqual([1,2,3])
 expect([...new Uint8Array(await second.arrayBuffer())]).toEqual([6,7])
 expect(second.headers.get('content-range')).toBe('bytes 1-2/3')
 expect(fetcher).toHaveBeenCalledTimes(1)
})
it('rejects corrupt whole packs without caching them',async()=>{
 const cache=new HeadingPackCache(),url=urlFor(pack)
 await expect(cache.remember(url,new Uint8Array(8))).rejects.toThrow('pack_integrity')
 expect(cache.get(url,8)).toBeUndefined()
})
it('bounds retained bytes and separates origins',async()=>{
 const cache=new HeadingPackCache(8),other=new Uint8Array([8,9,10,11]),url=urlFor(pack)
 await cache.remember(url,pack)
 expect(cache.get(new URL(url.pathname,'https://other.test'),8)).toBeUndefined()
 await cache.remember(urlFor(other),other)
 expect(cache.get(url,8)).toBeUndefined()
 expect(cache.get(urlFor(other),4)).toEqual(other)
})
it('honors cancellation even for a cache hit',async()=>{
 const cache=new HeadingPackCache(),url=urlFor(pack)
 await cache.remember(url,pack)
 const controller=new AbortController();controller.abort()
 await expect(fetchPackedHeadingPartition(url,{path:url.pathname,offset:0,bytes:8,packBytes:8},{signal:controller.signal},vi.fn(),cache)).rejects.toThrow()
})
