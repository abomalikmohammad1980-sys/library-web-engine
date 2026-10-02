import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('editions center contract', () => {
  it('provides a routed comparison using real bibliographic fields and book links', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/editions.ts', import.meta.url), 'utf8')
    expect(router).toContain("first === 'editions'"); expect(screen).toContain('groupBookEditions((await listBooks()).map(book=>withExtractedEditionMetadata(book)))')
    for (const feature of ['editionDifferences', 'compareEditionTexts', 'aria-label', 'edition-table__row--different']) expect(screen).toContain(feature)
    expect(screen).toContain('`#/reader/${book.id}`'); expect(screen).toContain("editionLink(a,'الطبعة الأولى')"); expect(screen).toContain("editionLink(b,'الطبعة الثانية')")
    expect(screen).toContain('for(const [index,group] of groups.entries())')
    expect(screen).toContain('ordinal=bookOrdinal(index)')
    expect(screen).toContain('authorLink(group.author,undefined,book.authorId)')
    expect(screen).toContain('categoryLink(effectiveBookCategory(book))')
    const css=readFileSync(new URL('./styles/screens.css',import.meta.url),'utf8');expect(css).toContain('@media (max-width:620px)');expect(css).toContain('.edition-table__row')
  })
})
