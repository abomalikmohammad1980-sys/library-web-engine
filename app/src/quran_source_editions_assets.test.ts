import {readFileSync,existsSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {resolve} from 'node:path'
import {afterEach,expect,it,vi} from 'vitest'
import {SOURCE_EDITION_TAFSIRS,loadSourceEditionTafsir} from './quran_source_editions'
import {SELECTABLE_TAFSIRS} from './quran_tafsir_registry'
import packs from './quran_source_packs.generated.json'

// Restored editions are shipped as immutable packs, not duplicate loose JSON.
const assetRoots=[resolve('app/public'),resolve(process.env.KHIZANA_TAFSIR_ASSET_ROOT??'.artifacts/batch55/deploy/pages-dist')]
function asset(path:string){
 const relative=new URL(path,'https://fixture.invalid/').pathname.replace(/^\//,'')
 const file=assetRoots.map(root=>resolve(root,relative)).find(existsSync)
 if(!file)throw Error(`Missing published tafsir fixture: ${relative}`)
 return readFileSync(file)
}
function sourcePayload(definition:typeof SOURCE_EDITION_TAFSIRS[number],file:typeof SOURCE_EDITION_TAFSIRS[number]['files'][number]){
 const location=(packs as Record<string,Record<string,{path:string;offset:number;bytes:number}>>)[definition.slug]?.[file.file]
 const prefix='/quran/resources/source-editions/'+definition.slug+'/'
 const bytes=location?asset(prefix+location.path).subarray(location.offset,location.offset+location.bytes):asset(prefix+file.file)
 expect(bytes.length).toBe(file.byteSize)
 expect(createHash('sha256').update(bytes).digest('hex')).toBe(file.checksumSha256)
 return JSON.parse(bytes.toString('utf8'))
}

it('connects every installed source edition without losing the original eleven',()=>{
 for(const definition of SOURCE_EDITION_TAFSIRS)expect(SELECTABLE_TAFSIRS).toContain(definition)
 expect(SOURCE_EDITION_TAFSIRS.filter(item=>!item.slug.startsWith('shuoun-'))).toHaveLength(17)
 expect(SOURCE_EDITION_TAFSIRS.find(item=>item.slug==='shuoun-wahidy')).toBeDefined()
 expect(new Set(SOURCE_EDITION_TAFSIRS.map(item=>item.slug)).size).toBe(SOURCE_EDITION_TAFSIRS.length)
 expect(SELECTABLE_TAFSIRS.filter(item=>'kind' in item&&item.kind==='source-edition-tafsir')).toHaveLength(SOURCE_EDITION_TAFSIRS.length)
})
afterEach(()=>vi.unstubAllGlobals())
it.each(SOURCE_EDITION_TAFSIRS)('$slug loads verified first/middle/last covered source positions, never a false book URL',async definition=>{
 vi.stubGlobal('document',{baseURI:'https://fixture.invalid/'})
 vi.stubGlobal('fetch',vi.fn(async(path:string|URL,init?:RequestInit)=>{
  const bytes=asset(String(path)),range=new Headers(init?.headers).get('range')
  if(!range)return new Response(bytes)
  const [,a,b]=range.match(/^bytes=(\d+)-(\d+)$/)!;return new Response(bytes.subarray(Number(a),Number(b)+1),{status:206,headers:{'content-range':`bytes ${a}-${b}/${bytes.length}`}})
 }))
 const files=definition.files.filter(f=>f.records>0)
 for(const f of [files[0]!,files[Math.floor(files.length/2)]!,files.at(-1)!]){
  vi.mocked(fetch).mockClear()
  const payload=sourcePayload(definition,f),row=payload.records[Math.floor(payload.records.length/2)]
  const result=await loadSourceEditionTafsir(definition,f.surah,row.ayah)
  const quarantined=definition.slug==='manar'&&f.surah===114&&row.ayah===1&&f.checksumSha256==='f24247fe72cf153adac65325a799d907acb8fa1675bcd7f04dcd519a934d95d7'
  expect(result.hasDirectCommentary).toBe(!quarantined);expect(result.sourceSegments).toEqual(quarantined?[]:row.fragmentRefs.map((i:number)=>payload.fragments[i]));expect(result.html).toBe(result.sourceSegments.map(s=>s.text).join('<hr>'));expect(result).not.toHaveProperty('readerHref')
  const location=(packs as Record<string,Record<string,{path:string}>>)[definition.slug]?.[f.file]
  expect(fetch).toHaveBeenCalledTimes(1);expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe(location?'https://fixture.invalid/quran/resources/source-editions/'+definition.slug+'/'+location.path:'./quran/resources/source-editions/'+definition.slug+'/'+f.file)
 }
},30000)
it('rejects a tampered local response before returning text',async()=>{
 vi.stubGlobal('fetch',vi.fn(async()=>new Response('{}')))
 await expect(loadSourceEditionTafsir(SOURCE_EDITION_TAFSIRS[0]!,1,1)).rejects.toThrow('source_edition_size')
})
it('keeps every installed surah below the verified Cloudflare Pages 25 MiB asset limit',()=>{
 expect(SOURCE_EDITION_TAFSIRS.length).toBeGreaterThanOrEqual(12)
 for(const definition of SOURCE_EDITION_TAFSIRS)for(const file of definition.files)expect(file.byteSize).toBeLessThanOrEqual(25*1024*1024)
})
it('rejects same-size tampering by checksum and unknown source identities before fetch',async()=>{
 const definition=SOURCE_EDITION_TAFSIRS[0]!,file=definition.files.find(f=>f.surah===1)!,fetcher=vi.fn(async()=>new Response(new Uint8Array(file.byteSize)))
 vi.stubGlobal('fetch',fetcher)
 await expect(loadSourceEditionTafsir(definition,1,1)).rejects.toThrow('source_edition_checksum')
 fetcher.mockClear();await expect(loadSourceEditionTafsir({...definition,bookId:-1},1,1)).rejects.toThrow('source_edition_unknown');expect(fetcher).not.toHaveBeenCalled()
})
it('returns an honest no-commentary state for a real uncovered surah in a partial source',async()=>{
 const definition=SOURCE_EDITION_TAFSIRS.find(d=>d.slug==='manar')!,file=definition.files.find(f=>f.records===0)!
 expect(file).toBeDefined();vi.stubGlobal('fetch',vi.fn(async(path:string)=>new Response(readFileSync(resolve('app/public',path.replace(/^\.\//,''))))))
 const result=await loadSourceEditionTafsir(definition,file.surah,1);expect(result.hasDirectCommentary).toBe(false);expect(result.html).toBe('');expect(result.sourceSegments).toEqual([])
})
