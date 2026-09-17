import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('permanent author core catalog', () => {
  it('loads with the application and recovers when IndexedDB was cleared alone', () => {
    const main = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')
    const catalog = readFileSync(new URL('./shamela_catalog.ts', import.meta.url), 'utf8')
    expect(main).toContain('ensureShamelaCatalogImported()')
    expect(catalog).toContain('listAuthorRecords(false)')
    expect(catalog).toContain("existing.some(author => Boolean(author.shamelaId))")
  })

  it('shows the complete catalog by default without precaching the 25 MB catalog', () => {
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    const worker = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
    expect(library).toContain("ownersOnly.checked = authorParams.get('owners') === 'books'")
    expect(library).toContain("owners: ownersOnly.checked ? 'books' : null")
    expect(worker).toContain("const CACHE = 'alkhizana-shell-v8'")
    expect(worker).toContain("const LARGE_CATALOG_PATH = '/data/shamela-authors.json'")
    const shellDeclaration = worker.match(/const SHELL = \[(.*?)\]/s)?.[1] ?? ''
    expect(shellDeclaration).not.toContain('shamela-authors.json')
    expect(worker).toContain('url.pathname.endsWith(LARGE_CATALOG_PATH)')
    expect(worker).toContain("caches.match(request).then(cached => cached || Response.error())")
    expect(worker).toContain("'./data/author-supplement.json'")
  })

  it('uses the core catalog in the home gateway and direct author pages', () => {
    const home = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(home).toContain('Promise.all([listBooks(), listAuthorRecords()])')
    expect(home).toContain("'#/authors', 50")
    expect(home).toContain('matching.slice(0, visibleLimit)')
    expect(library).toContain('دليل مؤلفي الخزانة')
    expect(library).toContain('ensureShamelaCatalogImported().then(() => Promise.all')
  })
})
