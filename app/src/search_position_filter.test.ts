import {expect,it} from 'vitest'
import {addPosition,mayContainPosition,SearchPositionFilters} from './search_position_filter'
it('never removes inserted positions and distinguishes document and position',()=>{
 const bytes=new Uint8Array(20000)
 for(let i=0;i<1000;i++)addPosition(bytes,`${i}:1`,i)
 for(let i=0;i<1000;i++)expect(mayContainPosition(bytes,`${i}:1`,i)).toBe(true)
 expect(mayContainPosition(bytes,'missing:1',1)).toBe(false)
 expect(mayContainPosition(bytes,'1:1',-1)).toBe(false)
})
it('does not use filters from a different release or posting',async()=>{
 const filters=new SearchPositionFilters(),fetcher=async()=>{throw Error('must_not_fetch')}
 expect(await filters.get(undefined,'ا','r','m','t',fetcher,async()=>'',()=>{})).toBeUndefined()
 await expect(filters.get([{word:'ا',releaseId:'other'}],'ا','r','m','t',fetcher,async()=>'',()=>{})).rejects.toThrow('source_mismatch')
})
it('rejects corrupt bytes and permits a clean retry',async()=>{
 const filters=new SearchPositionFilters(),hash='a'.repeat(64),bytes=new Uint8Array([1]),f={word:'ا',releaseId:'r',sourceManifestSha256:'m',termSha256:'t',sha256:hash,byteLength:1,parts:[{url:'https://example.test/0',byteLength:1,sha256:hash}]}
 await expect(filters.get([f],'ا','r','m','t',async()=>new Response(bytes),async()=>'b'.repeat(64),()=>{})).rejects.toThrow('integrity')
 expect(await filters.get([f],'ا','r','m','t',async()=>new Response(bytes),async()=>hash,()=>{})).toEqual(bytes)
})
