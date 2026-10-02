import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('permanent author core catalog', () => {
  it('loads the heavy editable catalog lazily and recovers when IndexedDB was cleared alone', () => {
    const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')
    const catalog = readFileSync(new URL('./shamela_catalog.ts', import.meta.url), 'utf8')
    expect(main).not.toContain('ensureShamelaCatalogImported()')
    expect(catalog).toContain('listAuthorRecords(false)')
    expect(catalog).toContain("existing.some(author => Boolean(author.shamelaId))")
  })

  it('shows the complete catalog by default without precaching the 25 MB catalog', () => {
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
    expect(library).toContain("ownersOnly.checked = authorParams.get('owners') === 'books'")
    expect(library).toContain("owners: ownersOnly.checked ? 'books' : null")
    expect(worker).toMatch(/const CACHE = 'alkhizana-shell-v\d+'/u)
    expect(worker).toContain("const LARGE_CATALOG_PATH = '/data/shamela-authors.json'")
    const shellDeclaration = worker.match(/const SHELL = \[(.*?)\]/s)?.[1] ?? ''
    expect(shellDeclaration).not.toContain('shamela-authors.json')
    expect(worker).toContain('url.pathname.endsWith(LARGE_CATALOG_PATH)')
    expect(worker).toContain("caches.match(request).then(cached => cached || Response.error())")
    expect(worker).toContain("'./data/author-supplement.json'")
  })

  it('uses a lightweight home gateway while direct author pages own the core catalog', () => {
    const home = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(home).toContain("fetch('./data/shamela-gateways.json', { cache: 'force-cache' })")
    expect(home).not.toContain('loadShamelaAuthorIndex()')
    expect(home).not.toContain('Promise.all([listBooks(), listAuthorRecords()])')
    expect(home).toContain("'#/authors?owners=books', 100")
    const gateway=JSON.parse(readFileSync(new URL('../public/data/shamela-gateways.json',import.meta.url),'utf8')) as {authors:Array<{bookCount:number}>}
    expect(gateway.authors.length).toBeGreaterThan(0)
    expect(gateway.authors.every(author=>author.bookCount>0)).toBe(true)
    expect(home).toContain('index.authors.map')
    expect(home).toContain('matching.slice(0, visibleLimit)')
    expect(library).toContain("class: 'authors-section', 'aria-label': 'دليل المؤلفين'")
    expect(library).toContain('loadShamelaAuthorMetadata().then(async index =>')
    expect(library).toContain('Promise.allSettled([listBooks(), getAuthorRecord(entry.id), listAuthorRecords()])')
    expect(library).not.toContain('ensureShamelaCatalogImported().then(() => Promise.all')
  })
})
