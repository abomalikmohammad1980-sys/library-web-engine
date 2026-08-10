import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { installablePublishedWorks, materializePublishedWork, publishedBookNeedsRefresh, type PublishedLibraryManifest, type PublishedWork } from './published_library_seed'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'public/library/published/manifest.json'), 'utf8')) as PublishedLibraryManifest

describe('clean Alpha published library', () => {
  it('keeps the Node-backed BOK parser out of the public boot bundle', () => {
    const source = fs.readFileSync(new URL('./published_library_seed.ts', import.meta.url), 'utf8')
    expect(source).not.toMatch(/^import .* from ['"]\.\/bok_import['"]/m)
    expect(source.indexOf('runtime.process ??=')).toBeLessThan(source.indexOf("await import('./bok_import')"))
  })
  it('deduplicates the corpus and includes four tafsirs as ordinary managed books', () => {
    expect(manifest.sourceFileCount).toBe(33)
    expect(manifest.workCount).toBe(27)
    expect(manifest.works).toHaveLength(27)
    expect(new Set(manifest.works.map(work => work.id)).size).toBe(27)
    expect(installablePublishedWorks(manifest)).toHaveLength(27)
    expect(installablePublishedWorks(manifest).every(work => work.security.verdict === 'allow')).toBe(true)
  })

  it('keeps all system tafsirs immutable with documented source metadata', () => {
    const tafsirs = manifest.works.filter(work => work.id.startsWith('tafsir-'))
    expect(tafsirs).toHaveLength(4)
    expect(tafsirs.every(work => work.metadata.sourceCitation?.includes('الموسوعة القرآنية'))).toBe(true)
  })

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

  it('admits the five verified Jet BOK records through the dedicated parser', () => {
    const bok = manifest.works.filter(work => work.sources.some(source => source.format === 'shamela-bok'))
    expect(bok).toHaveLength(5)
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

  it('rejects a non-ready or multi-source record before fetching bytes', async () => {
    const work = { ...manifest.works[0]!, status: 'pending-word-artifact' } as PublishedWork
    let fetched = false
    await expect(materializePublishedWork(work, async () => { fetched = true; return new Uint8Array() })).rejects.toThrow('not_installable')
    expect(fetched).toBe(false)
  })
})
