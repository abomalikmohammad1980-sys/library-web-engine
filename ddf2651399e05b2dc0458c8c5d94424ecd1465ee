import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('editions center contract', () => {
  it('provides a routed comparison using real bibliographic fields and book links', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/editions.ts', import.meta.url), 'utf8')
    expect(router).toContain("first === 'editions'"); expect(screen).toContain('groupBookEditions(await listBooks())')
    for (const field of ['book.publisher', 'book.edition', 'book.investigator', 'book.publicationYearHijri']) expect(screen).toContain(field)
    expect(screen).toContain('`#/reader/${book.id}`')
  })
})
