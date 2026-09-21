import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./shamela_pack_seed.ts', import.meta.url), 'utf8')

describe('Shamela reader fast route', () => {
  it('overlaps public route metadata with visibility but keeps hydration after the visibility fence', () => {
    const ready = source.slice(source.indexOf('export async function ensureShamelaBookReady'))
    const parallel = ready.slice(ready.indexOf('Promise.all(['), ready.indexOf('const override='))
    expect(parallel).toContain('loadCentralBookOverrides(fetch,offline)')
    expect(parallel).toContain('offline?Promise.resolve(undefined):locateShamelaBookFast')
    expect(parallel).not.toContain('hydrateEntry')
    expect(ready.indexOf("throw new ShamelaPackSeedError('shamela_pack_book_not_found')")).toBeLessThan(ready.indexOf('await hydrateEntry(located)'))
  })
  it('uses the preloaded author/book route index and one batch manifest before the full catalog fallback', () => {
    expect(source).toContain("loadShamelaAuthorMetadata()")
    expect(source).toContain("./library/shamela/batches/${ref.batchId}/manifest.json")
    const ready = source.slice(source.indexOf('export async function ensureShamelaBookReady'))
    expect(ready.indexOf('locateShamelaBookFast')).toBeLessThan(ready.indexOf('sessionCatalog()'))
  })

  it('only skips the source revision lookup offline, and reuses a matching digest online', () => {
    expect(source).toContain("if(offline&&existing?.bokPages?.length")
    expect(source).toContain('if(existing&&!shamelaBookNeedsHydration(existing,located.entry))return existing')
  })

  it('rehydrates a legacy fast record when its TOC field is missing', () => {
    expect(source).toContain('existing.bokToc===undefined')
    expect(source).toContain('existing.bokToc.length!==entry.counts.titles')
  })
})
