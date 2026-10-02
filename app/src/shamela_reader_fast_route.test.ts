import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./shamela_pack_seed.ts', import.meta.url), 'utf8')
const readerSource = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('Shamela reader fast route', () => {
  it('overlaps public route metadata with visibility but keeps hydration after the visibility fence', () => {
    const ready = source.slice(source.indexOf('export async function ensureShamelaBookReady'))
    const parallel = ready.slice(ready.indexOf('Promise.all(['), ready.indexOf('const override='))
    expect(parallel).toContain('loadCentralBookOverrides(fetch,offline,sourceBookId)')
    expect(parallel).toContain('offline?Promise.resolve(undefined):locateShamelaBookFast')
    expect(parallel).not.toContain('hydrateEntry')
    expect(ready.indexOf("throw new ShamelaPackSeedError('shamela_pack_book_not_found')")).toBeLessThan(ready.indexOf('await hydrateEntry(located)'))
    expect(ready.indexOf("throw new ShamelaPackSeedError('shamela_pack_book_not_found')")).toBeLessThan(ready.indexOf('loadShamelaReaderWindow('))
    expect(ready.indexOf('loadShamelaReaderWindow(')).toBeLessThan(ready.indexOf('await reconcileCatalogEntry('))
    expect(ready.indexOf('loadShamelaReaderWindow(')).toBeLessThan(ready.indexOf('await hydrateEntry(located)'))
  })
  it('uses the preloaded author/book route index and one batch manifest before the full catalog fallback', () => {
    expect(source).toContain("loadShamelaAuthorMetadata()")
    expect(source).toContain("./library/shamela/batches/${batchId}/manifest.json")
    const ready = source.slice(source.indexOf('export async function ensureShamelaBookReady'))
    expect(ready.indexOf('locateShamelaBookFast')).toBeLessThan(ready.indexOf('sessionCatalog()'))
  })
  it('uses complete pinned manifests before fetching the all-author metadata index',()=>{
    const locate=source.slice(source.indexOf('async function locateShamelaBookFast'),source.indexOf('export function shamelaBookNeedsHydration'))
    expect(locate.indexOf('pinnedReaderBatch(sourceBookId)')).toBeLessThan(locate.indexOf('loadShamelaAuthorMetadata()'))
    expect(locate).toContain('!isUnknownShamelaAuthor(entry.catalog.author)')
    expect(locate).toContain('entry.catalog.category?.trim()')
    expect(locate.indexOf('return {entry,batchId:pinnedBatch')).toBeLessThan(locate.indexOf('loadShamelaAuthorMetadata()'))
  })

  it('only skips the source revision lookup offline, and reuses a matching digest online', () => {
    expect(source).toContain("if(offline&&existing?.bokPages?.length")
    expect(source).toContain('if(existing&&!shamelaBookNeedsHydration(existing,located.entry))return existing')
  })

  it('rehydrates a legacy fast record when its TOC field is missing', () => {
    expect(source).toContain('existing.bokToc===undefined')
    expect(source).toContain('existing.bokToc.length!==entry.counts.titles')
  })
  it('does not fetch the first page group solely to show a distant preview', () => {
    expect(readerSource).toContain('...(previewLoader?[]:[0,1,2])')
  })
  it('uses the early route for every sharded source, including compact books with thousands of pages', () => {
    const ready = source.slice(source.indexOf('export async function ensureShamelaBookReady'))
    expect(ready).toContain('const hasReaderShards=located.entry.byteLength>=2*1024*1024||located.entry.counts.pages>=2000')
    expect(ready).toContain('if(!offline&&onPreview&&hasReaderShards&&')
    expect(ready.indexOf('loadShamelaReaderEarlyWindow(')).toBeLessThan(ready.indexOf('await complete'))
  })
  it('keeps the verified sparse reader if full-pack hydration fails later', () => {
    const ready = source.slice(source.indexOf('export async function ensureShamelaBookReady'))
    expect(ready).toContain('verifiedPreview=book;onPreview(book)')
    expect(ready).toContain("if(verifiedPreview){console.warn('shamela_full_pack_background_failed',sourceBookId,error);return verifiedPreview}")
    expect(readerSource).toContain("!stored.data?.byteLength && !shamelaPreviewPageLoader(stored)")
  })
})
