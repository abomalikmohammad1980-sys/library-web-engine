import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('scientific series end-to-end contract', () => {
  it('edits explicit series metadata and exposes a routed ordered center', () => {
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8'), book = readFileSync(new URL('./screens/book.ts', import.meta.url), 'utf8'), router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/series.ts', import.meta.url), 'utf8')
    expect(library).toContain("'اسم السلسلة العلمية'"); expect(library).toContain('seriesOrder: Number(seriesOrder.value)')
    expect(book).toContain("href: `#/series?name=${encodeURIComponent(book.seriesName)}`")
    expect(router).toContain("first === 'series'"); expect(screen).toContain('groupBookSeries(await listBooks())')
  })
})
