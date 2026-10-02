import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('data quality center contract', () => {
  it('routes an actionable audit with kind filters and repair links', () => {
    const router = readFileSync(new URL('./router.ts', import.meta.url), 'utf8'), screen = readFileSync(new URL('./screens/data_quality.ts', import.meta.url), 'utf8')
    expect(router).toContain("first === 'data-quality'"); expect(screen).toContain('issues = auditLibraryData(books)')
    expect(screen).toContain("value: 'identity'"); expect(screen).toContain("value: 'series'")
    expect(screen).toContain('`#/library?adminQ=${encodeURIComponent(issue.bookTitle)}`')
    expect(screen).toContain('for (const [index, issue] of shown.entries())')
    expect(screen).toContain('ordinal = bookOrdinal(index)')
    expect(screen).toContain("class: 'quality-issue__surface'")
    expect(screen).toContain('authorLink(book.author, undefined, book.authorId)')
    expect(screen).toContain('categoryLink(effectiveBookCategory(book))')
  })
})
