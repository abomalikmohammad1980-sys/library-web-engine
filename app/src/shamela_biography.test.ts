import {readFileSync} from 'node:fs'
import {it,expect,vi,afterEach} from 'vitest'
import {withShamelaBiography,resetShamelaBiographyForTests} from './shamela_biography'
import type {ShamelaAuthorIndexEntry} from './shamela_author_index'
import {createHash} from 'node:crypto'
import {SHAMELA_AUTHOR_METADATA_SHA} from './shamela_author_metadata'
import {SHAMELA_BIOGRAPHY_MANIFEST_SHA} from './shamela_biography'
const root=new URL('../public/data/',import.meta.url),metadata=JSON.parse(readFileSync(new URL('shamela-author-metadata.json',root),'utf8')),manifest=JSON.parse(readFileSync(new URL('shamela-biographies.manifest.json',root),'utf8'))
afterEach(()=>{resetShamelaBiographyForTests();vi.unstubAllGlobals()})
it('binds verified biography manifest to the exact current metadata and runtime pin',()=>{
 const hash=(name:string)=>createHash('sha256').update(readFileSync(new URL(name,root))).digest('hex')
 expect(hash('shamela-author-metadata.json')).toBe(SHAMELA_AUTHOR_METADATA_SHA)
 expect(manifest.metadataSha256).toBe(SHAMELA_AUTHOR_METADATA_SHA)
 expect(hash('shamela-biographies.manifest.json')).toBe(SHAMELA_BIOGRAPHY_MANIFEST_SHA)
})
function mock(){const fetcher=vi.fn(async(input:RequestInfo|URL)=>new Response(readFileSync(new URL(String(input).replace('./data/','').split('?')[0]!,root))));vi.stubGlobal('fetch',fetcher);return fetcher}
it('fetches only declaration and selected verified biography, retaining text and identity',async()=>{
 const fetcher=mock(),entry=metadata.authors.find((a:ShamelaAuthorIndexEntry)=>a.authorId==='215'),result=await withShamelaBiography(entry)
 expect(result.biography).toContain('البخاري');expect(result.books).toEqual(entry.books);expect(result.biographyProvenance?.sourceUrl).toBe('https://shamela.ws/author/215');expect(fetcher).toHaveBeenCalledTimes(2)
 await withShamelaBiography(entry);expect(fetcher).toHaveBeenCalledTimes(2);expect(fetcher.mock.calls.every(([url])=>!String(url).includes('shamela-author-index'))).toBe(true)
})
it('distinguishes declared absence from corrupt or wrong author assets',async()=>{
 const fetcher=mock(),absent=metadata.authors.find((a:ShamelaAuthorIndexEntry)=>a.authorId===manifest.unavailableAuthorIds[0]);expect((await withShamelaBiography(absent)).biography).toBeUndefined();expect(fetcher).toHaveBeenCalledTimes(1)
 const entry=metadata.authors.find((a:ShamelaAuthorIndexEntry)=>a.authorId==='215');await expect(withShamelaBiography({...entry,id:'wrong'})).rejects.toThrow('shamela_biography_identity')
 fetcher.mockImplementation(async()=>new Response('{}'));await expect(withShamelaBiography(entry)).rejects.toThrow('shamela_biography_integrity')
})
