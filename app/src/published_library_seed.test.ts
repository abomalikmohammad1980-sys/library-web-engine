import { describe, expect, it, vi } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { installablePublishedWorks, materializePublishedWork, publishedBookNeedsRefresh, publishedWordPageMapComplete, type PublishedLibraryManifest, type PublishedWork } from './published_library_seed'
import { indexedParagraphs } from './engine/search_store'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/library/published/manifest.json'), 'utf8')) as PublishedLibraryManifest

describe('clean Alpha published library', () => {
  it('recovers when a hashed R2 source was negatively cached before its upload completed', async () => {
    const bytes = new TextEncoder().encode('نص تفسير موثق')
    const sha256 = [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(value => value.toString(16).padStart(2, '0')).join('')
    const work = { id: 'tafsir-cache-recovery', title: 'تفسير', author: 'مؤلف', status: 'ready', security: { verdict: 'allow', reasons: [] }, sources: [{ format: 'text', role: 'primary', path: './library/published/assets/recovered.txt', fileName: 'recovered.txt', bytes: bytes.length, sha256 }], metadata: {}, coverStrategy: 'generated' } as PublishedWork
    const originalFetch = globalThis.fetch
    const mocked = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => init?.cache === 'force-cache' ? new Response('', { status: 404 }) : new Response(bytes, { status: 200 }))
    globalThis.fetch = mocked as typeof fetch
    try {
      const book = await materializePublishedWork(work)
      expect(book.extractedText).toBe('نص تفسير موثق')
      expect(mocked).toHaveBeenNthCalledWith(1, work.sources[0]!.path, expect.objectContaining({ cache: 'no-cache' }))
      expect(mocked).toHaveBeenCalledTimes(1)
    } finally { globalThis.fetch = originalFetch }
  })

  it('reassembles split published PDF bytes and fails closed on a corrupt part', async () => {
    const bytes=new TextEncoder().encode('%PDF-split-test'),first=bytes.slice(0,5),second=bytes.slice(5)
    const hash=async(value:Uint8Array)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',value))].map(x=>x.toString(16).padStart(2,'0')).join('')
    const source:PublishedWork['sources'][number]={format:'pdf',role:'primary',path:'./whole.pdf',parts:[{path:'./a.bin',bytes:first.length,sha256:await hash(first)},{path:'./b.bin',bytes:second.length,sha256:await hash(second)}],fileName:'x.pdf',bytes:bytes.length,sha256:await hash(bytes)}
    const work={id:'split',title:'PDF',author:'A',status:'ready',security:{verdict:'allow',reasons:[]},sources:[source],metadata:{},coverStrategy:'pdf-page-1'} as PublishedWork
    const originalFetch=globalThis.fetch
    globalThis.fetch=vi.fn(async(input:RequestInfo|URL)=>new Response(String(input).endsWith('a.bin')?first:second)) as typeof fetch
    try{const book=await materializePublishedWork(work);expect(book.pdfData).toEqual(bytes);source.parts[1]!.sha256='0'.repeat(64);await expect(materializePublishedWork(work)).rejects.toThrow('part_checksum')}finally{globalThis.fetch=originalFetch}
  })
  it('keeps the Node-backed BOK parser out of the public boot bundle', () => {
    const source = fs.readFileSync(new URL('./published_library_seed.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/^import .* from ['"]\.\/bok_import['"]/m)
    expect(source.indexOf('runtime.process ??=')).toBeLessThan(source.indexOf("await import('./bok_import')"))
  })
  it('accounts for the reviewed baseline plus nine atomic Word imports without duplicate works', () => {
    expect(manifest.sourceFileCount).toBe(manifest.works.flatMap(work => work.sources).length)
    expect(manifest.workCount).toBe(manifest.works.length)
    expect(new Set(manifest.works.map(work => work.id)).size).toBe(manifest.works.length)
    expect(installablePublishedWorks(manifest)).toHaveLength(manifest.works.length)
    const newWorks = manifest.works.filter(work => work.id.startsWith('test-'))
    expect(newWorks).toHaveLength(13)
    expect(newWorks.every(work => work.metadata.category === 'غير مصنف' && (work.wordArtifact || work.wordFallback))).toBe(true)
    expect(installablePublishedWorks(manifest).every(work => work.security.verdict === 'allow')).toBe(true)
  })

  it('keeps all system tafsirs immutable with documented source metadata', () => {
    const tafsirs = manifest.works.filter(work => work.id.startsWith('tafsir-'))
    expect(tafsirs).toHaveLength(8)
    expect(tafsirs.every(work => work.metadata.description?.includes('مرتبط') && work.sources.every(source => /^[a-f0-9]{64}$/.test(source.sha256)))).toBe(true)
  })

  it('opens every newly published Word route from its authoritative Word asset and page map', async () => {
    const works = manifest.works.filter(work => work.id.startsWith('test-') && work.wordArtifact)
    const loadJson = async (file: string) => JSON.parse(fs.readFileSync(path.join(root, 'public', file.replace(/^\.\//, '')), 'utf8')) as unknown
    for (const work of works) {
      const book = await materializePublishedWork(
        work,
        async source => new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, '')))),
        loadJson,
      )
      expect(book.id).toBe(work.id)
      expect(book.title).toBe(work.title)
      expect(book.wordPageMap?.totalPages).toBe(work.wordArtifact?.totalPages)
      expect(book.data.byteLength).toBeGreaterThan(0)
      expect(work.sources.filter(source => source.format === 'word')).toHaveLength(1)
      const pdfSources = work.sources.filter(source => source.format === 'pdf')
      expect(pdfSources.length).toBeLessThanOrEqual(1)
      expect(book.pdfStatus).toBe(pdfSources.length ? 'ready' : 'pending')
    }
  })

  it('opens and indexes every truthful Word fallback without inventing page maps', async () => {
    const works = manifest.works.filter(work => work.id.startsWith('test-') && work.wordFallback)
    expect(works.map(work => work.title).sort()).toEqual(['سلسلة العلاقات الدولية في الإسلام', 'مجموع مؤلفات الشيخ فارس آل شويل', 'مسائل من فقه الجهاد'].sort())
    const load = async (source: PublishedWork['sources'][number]) => new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    for (const work of works) {
      const book = await materializePublishedWork(work, load)
      expect(book.wordPageMap).toBeUndefined()
      expect(book.readerModel?.paragraphs).toHaveLength(work.wordFallback!.paragraphCount)
      expect(book.extractedText?.length).toBeGreaterThan(100)
      const paragraphs = await indexedParagraphs(book)
      expect(paragraphs.length).toBeGreaterThan(0)
      const query = paragraphs.find(item => item.text.trim().length >= 12)!.text.trim().slice(0, 12)
      expect(paragraphs.some(item => item.text.includes(query))).toBe(true)
    }
  }, 120_000)

  it('materializes a tafsir Markdown source through the ordinary textual-book path', async () => {
    const work = manifest.works.find(item => item.id === 'tafsir-saadi')!
    const source = work.sources[0]!
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const book = await materializePublishedWork(work, async () => bytes)
    expect(book.sourceFormat).toBe('markdown')
    expect(book.extractedText).toContain('# تفسير السعدي')
    expect(book.managedSource).toBe('published')
  })

  it('keeps Word/PDF as one work and gates it until authoritative artifacts arrive', () => {
    const paired = manifest.works.find(work => work.title.startsWith('خالعة القلوب'))!
    expect(paired.sources.map(source => source.format).sort()).toEqual(['pdf', 'word'])
    expect(paired.status).toBe('ready')
    expect(paired.wordArtifact?.totalPages).toBe(34)
    expect(installablePublishedWorks(manifest)).toContain(paired)
  })

  it('admits all verified Jet BOK records through the dedicated parser', () => {
    const bok = manifest.works.filter(work => work.sources.some(source => source.format === 'shamela-bok'))
    expect(bok).toHaveLength(6)
    expect(bok.every(work => work.status === 'ready' && work.security.verdict === 'allow')).toBe(true)
  })

  it('materializes an EPUB with searchable text, TOC, format badge identity, and deterministic cover', async () => {
    const work = installablePublishedWorks(manifest).find(item => item.sources[0]?.format === 'epub')!
    const source = work.sources[0]!, bytes = new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const book = await materializePublishedWork(work, async () => bytes)
    expect(book.sourceFormat).toBe('epub')
    expect(book.extractedText?.length).toBeGreaterThan(1000)
    expect(book.textToc?.length).toBeGreaterThan(0)
    expect(book.coverHue).toBeTypeOf('number')
  })

  it('materializes a published BOK with its original pages and TOC', async () => {
    const work = installablePublishedWorks(manifest).find(item => item.sources[0]?.format === 'shamela-bok')!
    const source = work.sources[0]!
    const bytes = new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const book = await materializePublishedWork(work, async () => bytes)
    expect(book.sourceFormat).toBe('shamela-bok')
    expect(book.bokPages?.length).toBeGreaterThan(10)
    expect(book.bokToc?.length).toBeGreaterThan(0)
    expect(book.managedSource).toBe('published')
  })

  it('materializes a reviewed Word/PDF pair as one book with its authoritative page map', async () => {
    const work = installablePublishedWorks(manifest).find(item => item.title === 'خالعة القلوب')!
    const load = async (source: PublishedWork['sources'][number]) => new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const loadJson = async (file: string) => JSON.parse(fs.readFileSync(path.join(root, 'public', file.replace(/^\.\//, '')), 'utf8')) as unknown
    const book = await materializePublishedWork(work, load, loadJson)
    expect(book.sourceFormat).toBe('word')
    expect(book.pdfData?.length).toBeGreaterThan(1000)
    expect(book.wordPageMap?.totalPages).toBe(34)
    expect(book.physicalPageCount).toBe(34)
  })

  it('refreshes only managed published Word records with stale authority data', async () => {
    const work = installablePublishedWorks(manifest).find(item => item.title === 'إبهاج أهل الصناعة بدراسة حديث بعثت بالسيف بين يدي الساعة')!
    const load = async (source: PublishedWork['sources'][number]) => new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const loadJson = async (file: string) => JSON.parse(fs.readFileSync(path.join(root, 'public', file.replace(/^\.\//, '')), 'utf8')) as unknown
    const book = await materializePublishedWork(work, load, loadJson)
    expect(publishedBookNeedsRefresh(book, work)).toBe(false)
    expect(book.category).toBe('الحديث وعلومه')
    expect(book.tags?.map(tag => tag.name)).toEqual(['تخريج الحديث', 'نقد الأسانيد', 'بعثت بالسيف'])
    expect(publishedBookNeedsRefresh({ ...book, category: undefined, tags: undefined }, work)).toBe(true)
    expect(publishedBookNeedsRefresh({ ...book, wordPageMap: { ...book.wordPageMap!, totalPages: 34 } }, work)).toBe(true)
    const { managedSource: _managedSource, ...unmanaged } = book
    expect(publishedBookNeedsRefresh(unmanaged, work)).toBe(false)
  })

  it('requires a complete persisted page audit before offline reuse of the same, adjacent, or final page', async () => {
    const work = installablePublishedWorks(manifest).find(item => item.wordArtifact)!
    const mapPath = path.join(root, 'public', work.wordArtifact!.path.replace(/^\.\//, ''))
    const complete = JSON.parse(fs.readFileSync(mapPath, 'utf8'))
    expect(publishedWordPageMapComplete(complete, work.wordArtifact!)).toBe(true)
    expect(publishedWordPageMapComplete({ ...complete, pages: undefined }, work.wordArtifact!)).toBe(false)
    expect(publishedWordPageMapComplete({ ...complete, pages: complete.pages.slice(0, -1) }, work.wordArtifact!)).toBe(false)

    const load = async (source: PublishedWork['sources'][number]) => new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const book = await materializePublishedWork(work, load, async () => complete)
    expect(publishedBookNeedsRefresh({ ...book, wordPageMap: { ...book.wordPageMap!, pages: undefined } }, work)).toBe(true)
    await expect(materializePublishedWork(work, load, async () => ({ ...complete, pages: complete.pages.slice(0, -1) })))
      .rejects.toThrow('published_word_map_incomplete')
  })
  it('refreshes the Diwan when IndexedDB still holds its legacy map without measured fragments', async () => {
    const work = installablePublishedWorks(manifest).find(item => item.id === 'test-4a3e61ab3b660a72')!
    const load = async (source: PublishedWork['sources'][number]) => new Uint8Array(fs.readFileSync(path.join(root, 'public', source.path.replace(/^\.\//, ''))))
    const loadJson = async (file: string) => JSON.parse(fs.readFileSync(path.join(root, 'public', file.replace(/^\.\//, '')), 'utf8')) as unknown
    const book = await materializePublishedWork(work, load, loadJson)
    expect(book.wordPageMap?.fragments).toHaveLength(6_720)
    expect(publishedBookNeedsRefresh(book, work)).toBe(false)
    const { fragments: _fragments, ...legacyMap } = book.wordPageMap!
    expect(publishedBookNeedsRefresh({ ...book, wordPageMap: legacyMap }, work)).toBe(true)
  })

  it('rejects a non-ready or multi-source record before fetching bytes', async () => {
    const work = { ...manifest.works[0]!, status: 'pending-word-artifact' } as PublishedWork
    let fetched = false
    await expect(materializePublishedWork(work, async () => { fetched = true; return new Uint8Array() })).rejects.toThrow('not_installable')
    expect(fetched).toBe(false)
  })
})

