import { beforeEach,describe,expect,it,vi } from 'vitest'
import { createHash } from 'node:crypto'
import { fetchPagesDataAsset,pagesReleaseAllowedOnHost,resetPagesDataReleaseForTests,pinnedReaderBatch } from './pages_data_release'
const sha=(x:Uint8Array)=>createHash('sha256').update(x).digest('hex')
beforeEach(()=>resetPagesDataReleaseForTests())
it('locates a pinned reader batch without a catalog or project manifest request',async()=>{
 const config={contract:'alkhizana-pages-client/1',releaseId:'e'.repeat(24),projects:[{name:'reader-01',group:'corpus',baseUrl:'https://reader.example'}],directReaderShards:{project:'reader-01',catalogSha256:'f'.repeat(64),routeSha256:{'batch-0008/books/907/route.json':'a'.repeat(64)}}}
 const fetcher=vi.fn(async()=>Response.json(config)) as typeof fetch
 expect(await pinnedReaderBatch('907',fetcher)).toBe('batch-0008')
 expect(await pinnedReaderBatch('90',fetcher)).toBeUndefined()
 expect(await pinnedReaderBatch('../907',fetcher)).toBeUndefined()
 expect(fetcher).toHaveBeenCalledTimes(1)
})
it('rejects an ambiguous pinned batch mapping',async()=>{
 const config={contract:'alkhizana-pages-client/1',releaseId:'e'.repeat(24),projects:[{name:'reader-01',group:'corpus',baseUrl:'https://reader.example'}],directReaderShards:{project:'reader-01',catalogSha256:'f'.repeat(64),routeSha256:{'batch-0008/books/907/route.json':'a'.repeat(64),'batch-0009/books/907/route.json':'b'.repeat(64)}}}
 await expect(pinnedReaderBatch('907',vi.fn(async()=>Response.json(config)) as typeof fetch)).rejects.toThrow('pages_reader_batch_ambiguous')
})
it('aborts promptly while release discovery is stalled',async()=>{
 const controller=new AbortController()
 const fetcher=vi.fn(()=>new Promise<Response>(()=>undefined)) as typeof fetch
 const pending=fetchPagesDataAsset('corpus','book.json','local',fetcher,{signal:controller.signal})
 const assertion=expect(pending).rejects.toMatchObject({name:'AbortError'})
 controller.abort()
 await assertion
})
it('keeps production release URLs out of localhost while allowing an explicit local harness',()=>{const config=(baseUrl:string)=>({contract:'alkhizana-pages-client/1' as const,releaseId:'a'.repeat(24),projects:[{name:'corpus-01',group:'corpus' as const,baseUrl}]});expect(pagesReleaseAllowedOnHost(config('https://khezana-corpus-01.pages.dev'),'localhost')).toBe(false);expect(pagesReleaseAllowedOnHost(config('http://127.0.0.1:4200'),'127.0.0.1')).toBe(true);expect(pagesReleaseAllowedOnHost(config('https://khezana-corpus-01.pages.dev'),'alkhizana.pages.dev')).toBe(true)})
describe('Pages multi-project data release',()=>{it('reassembles an immutable cross-origin book and verifies every SHA',async()=>{const whole=new TextEncoder().encode('{"book":"كتاب"}'),a=whole.slice(0,7),b=whole.slice(7),fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=String(input);if(url.endsWith('shamela-pages-release.json'))return new Response(JSON.stringify({contract:'alkhizana-pages-client/1',releaseId:'a'.repeat(24),projects:[{name:'corpus-01',group:'corpus',baseUrl:'https://corpus.example'}]}));if(url.endsWith('project-manifest.json'))return new Response(JSON.stringify({contract:'alkhizana-pages-project/1',releaseId:'a'.repeat(24),project:'corpus-01',group:'corpus',assets:[{group:'corpus',path:'batch/books/1.json',bytes:whole.length,sha256:sha(whole),project:'corpus-01',parts:[{path:'releases/x/a.bin',bytes:a.length,sha256:sha(a)},{path:'releases/x/b.bin',bytes:b.length,sha256:sha(b)}]}]}));if(url.endsWith('a.bin'))return new Response(a);if(url.endsWith('b.bin'))return new Response(b);return new Response(null,{status:404})}) as typeof fetch;const response=await fetchPagesDataAsset('corpus','batch/books/1.json','./local.json',fetcher);expect(new Uint8Array(await response.arrayBuffer())).toEqual(whole);expect(response.headers.get('x-alkhizana-project')).toBe('corpus-01');expect(fetcher).not.toHaveBeenCalledWith('./local.json',expect.anything())});it('falls back locally when no release config exists',async()=>{const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('shamela-pages-release.json')?new Response(null,{status:404}):new Response('local')) as typeof fetch;expect(await (await fetchPagesDataAsset('search','manifest.json','./library/shamela-search/manifest.json',fetcher)).text()).toBe('local')});it('fails closed when a chunk is corrupt',async()=>{const bytes=new TextEncoder().encode('x'),fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('shamela-pages-release.json')?new Response(JSON.stringify({contract:'alkhizana-pages-client/1',releaseId:'b'.repeat(24),projects:[{name:'search-01',group:'search',baseUrl:'https://search.example'}]})):String(input).endsWith('project-manifest.json')?new Response(JSON.stringify({contract:'alkhizana-pages-project/1',releaseId:'b'.repeat(24),project:'search-01',group:'search',assets:[{group:'search',path:'manifest.json',bytes:1,sha256:sha(bytes),project:'search-01',parts:[{path:'bad',bytes:1,sha256:'0'.repeat(64)}]}]})):new Response(bytes)) as typeof fetch;await expect(fetchPagesDataAsset('search','manifest.json','local',fetcher)).rejects.toThrow('pages_asset_part_integrity')})})
it('uses an explicit same-origin fallback only for original corpus packs absent from a sidecar release',async()=>{
 const config={contract:'alkhizana-pages-client/1',releaseId:'c'.repeat(24),corpusFallback:'same-origin',projects:[{name:'reader-01',group:'corpus',baseUrl:'https://reader.example'}]}
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=String(input);if(url.endsWith('shamela-pages-release.json'))return new Response(JSON.stringify(config));if(url.endsWith('project-manifest.json'))return new Response(JSON.stringify({contract:'alkhizana-pages-project/1',releaseId:config.releaseId,project:'reader-01',group:'corpus',assets:[]}));if(url==='./library/shamela/batches/batch-0001/books/9.json')return new Response('verified original');return new Response(null,{status:404})}) as typeof fetch
 expect(await (await fetchPagesDataAsset('corpus','batch-0001/books/9.json','./library/shamela/batches/batch-0001/books/9.json',fetcher)).text()).toBe('verified original')
 expect(fetcher.mock.calls.some(call=>String(call[0]).endsWith('project-manifest.json'))).toBe(false)
 await expect(fetchPagesDataAsset('search','missing','./search-missing',fetcher)).rejects.toThrow('pages_asset_not_mapped')
})
it('keeps the existing search origin when only reader sidecars are mapped',async()=>{
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('shamela-pages-release.json')?new Response(JSON.stringify({contract:'alkhizana-pages-client/1',releaseId:'d'.repeat(24),corpusFallback:'same-origin',searchFallback:'same-origin',projects:[{name:'reader-01',group:'corpus',baseUrl:'https://reader.example'}]})):new Response('search origin')) as typeof fetch
 expect(await (await fetchPagesDataAsset('search','manifest.json','./library/shamela-search/manifest.json',fetcher)).text()).toBe('search origin')
 expect(fetcher.mock.calls.map(call=>String(call[0]))).toEqual(['./data/shamela-pages-release.json','./library/shamela-search/manifest.json'])
})
it('opens a pinned reader route and shard without downloading the large project manifest',async()=>{
 const route=new TextEncoder().encode('{"route":true}'),shard=new Uint8Array([31,139,8,0])
 const config={contract:'alkhizana-pages-client/1',releaseId:'e'.repeat(24),corpusFallback:'same-origin',projects:[{name:'reader-01',group:'corpus',baseUrl:'https://reader.example'}],directReaderShards:{project:'reader-01',catalogSha256:'f'.repeat(64),routeSha256:{'batch-0000/books/88/route.json':sha(route)}}}
 const calls:string[]=[]
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>{const url=String(input);calls.push(url);if(url.endsWith('shamela-pages-release.json'))return Response.json(config);if(url.endsWith('route.json'))return new Response(route);if(url.endsWith('pages-0004.json.gz'))return new Response(shard);throw Error(`unexpected:${url}`)}) as typeof fetch
 const loaded=await fetchPagesDataAsset('corpus','reader-shards/batch-0000/books/88/route.json','local',fetcher)
 expect(new Uint8Array(await loaded.arrayBuffer())).toEqual(route)
 const part=await fetchPagesDataAsset('corpus','reader-shards/batch-0000/books/88/pages-0004.json.gz','local',fetcher)
 expect(new Uint8Array(await part.arrayBuffer())).toEqual(shard)
 expect(calls).toEqual(['./data/shamela-pages-release.json',`https://reader.example/releases/${config.releaseId}/reader-shards/batch-0000/books/88/route.json`,`https://reader.example/releases/${config.releaseId}/reader-shards/batch-0000/books/88/pages-0004.json.gz`])
})
it('rejects a changed direct reader route before showing its pages',async()=>{
 const config={contract:'alkhizana-pages-client/1',releaseId:'e'.repeat(24),projects:[{name:'reader-01',group:'corpus',baseUrl:'https://reader.example'}],directReaderShards:{project:'reader-01',catalogSha256:'f'.repeat(64),routeSha256:{'batch-0000/books/88/route.json':'0'.repeat(64)}}}
 const fetcher=vi.fn(async(input:RequestInfo|URL)=>String(input).endsWith('shamela-pages-release.json')?Response.json(config):new Response('changed')) as typeof fetch
 await expect(fetchPagesDataAsset('corpus','reader-shards/batch-0000/books/88/route.json','local',fetcher)).rejects.toThrow('pages_direct_reader_integrity')
})
