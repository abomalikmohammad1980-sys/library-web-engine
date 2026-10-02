import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import { hasKnownSunnahAuthor, isSunnahLibraryBook, readCachedSunnahScope, resolveSunnahScreenSources, SUNNAH_SCOPE_CACHE_KEY, writeCachedSunnahScope } from './screens/sunnah'

describe('Sunnah section', () => {
  it('refreshes an old session scope before deciding search coverage',async()=>{
    const stale={contract:'sunnah-global-search-scope/1',books:[{publicId:'410000735',sourceBookId:'735',title:'البخاري',author:'البخاري',category:'كتب السنة'}]}
    vi.stubGlobal('localStorage',{getItem:()=>JSON.stringify(stale)})
    const fetcher=vi.fn(async(input:RequestInfo|URL)=>new Response(JSON.stringify(String(input).endsWith('catalog.json')?{batches:[{manifest:'./batch.json'}]}:{books:[{bookId:'735',catalog:{title:'البخاري',author:'البخاري',category:'كتب السنة'}},{bookId:'1727',catalog:{title:'مسلم',author:'مسلم',category:'كتب السنة'}}]}))) as typeof fetch
    try{const actual=await resolveSunnahScreenSources(Promise.resolve([]),Promise.resolve({records:[]} as never),fetcher);expect(actual.indexedScope.books.map(b=>b.sourceBookId)).toEqual(['735','1727'])}finally{vi.unstubAllGlobals()}
  })
  it('matches classified hadith books without treating unrelated uses of السنة as a corpus', () => {
    expect(isSunnahLibraryBook({ title: 'شرح صحيح البخاري', category: 'شروح الحديث' })).toBe(true)
    expect(isSunnahLibraryBook({ title: 'نزهة النظر', tags: [{ name: 'مصطلح الحديث', source: 'manual' }] })).toBe(true)
    expect(isSunnahLibraryBook({ title: 'السنة الدراسية الجديدة', category: 'كتب عامة' })).toBe(false)
  })

  it('has a visible route between Quran and the personal library', () => {
    const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8')
    expect(shell).toContain("['quran', 'sunnah', 'library', 'authors']")
    expect(router).toContain("if (first === 'sunnah') return { name: 'sunnah' }")
    expect(router).toContain("sunnah: async () => ({ content: (await import('./screens/sunnah')).sunnahScreen(), activeHash: '#/sunnah' })")
    expect(router).toContain('appFrame(content, activeHash)')
  })

  it('does not expose a link for missing or placeholder authors', () => {
    expect(hasKnownSunnahAuthor({ author: '-', authors: [] })).toBe(false)
    expect(hasKnownSunnahAuthor({ author: 'غير معروف', authors: [] })).toBe(false)
    expect(hasKnownSunnahAuthor({ author: 'الإمام مسلم', authors: [] })).toBe(true)
  })

  it('يفتح 2035 كتابًا في خمس إعادات تحميل نظيفة ولو تعذر IndexedDB وcorpus',async()=>{
    const books=Array.from({length:2035},(_,index)=>({bookId:String(index+1),catalog:{title:`كتاب ${index+1}`,category:'كتب السنة'}}))
    const fetcher=(async(input:RequestInfo|URL)=>String(input).endsWith('catalog.json')
      ?new Response(JSON.stringify({batches:[{manifest:'./batch.json'}]}),{status:200})
      :new Response(JSON.stringify({books}),{status:200})) as typeof fetch
    const warn=console.warn;console.warn=()=>undefined
    try{for(let run=0;run<5;run++){
      const state=await resolveSunnahScreenSources(Promise.reject(new Error('indexeddb opening')),Promise.reject(new Error('corpus optional')),fetcher)
      expect(state.indexedScope.books).toHaveLength(2035)
      expect(state.localBooks).toEqual([])
      expect(state.verifiedRecords).toEqual([])
    }}finally{console.warn=warn}
  })

  it('يعرض snapshot الكتالوج الموثق فورًا في إعادة التحميل ويرفض cache غير canonical', () => {
    const scope = {
      contract: 'sunnah-global-search-scope/1' as const,
      books: [{ publicId: '410000735', sourceBookId: '735', title: 'صحيح البخاري', author: 'البخاري', category: 'كتب السنة' }],
    }
    const values = new Map<string, string>()
    const storage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value) },
    }
    writeCachedSunnahScope(scope, storage)
    expect(values.has(SUNNAH_SCOPE_CACHE_KEY)).toBe(true)
    expect(readCachedSunnahScope(storage)).toEqual(scope)
    values.set(SUNNAH_SCOPE_CACHE_KEY, JSON.stringify({ ...scope, books: [{ ...scope.books[0], author: '' }] }))
    expect(readCachedSunnahScope(storage)).toBeUndefined()
    values.set(SUNNAH_SCOPE_CACHE_KEY, JSON.stringify({ ...scope, books: [{ ...scope.books[0], publicId: 'bad' }] }))
    expect(readCachedSunnahScope(storage)).toBeUndefined()
  })
})
