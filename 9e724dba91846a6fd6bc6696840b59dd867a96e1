import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('co-author import contract', () => {
  it('offers a small add/remove control and persists linked author references', () => {
    const source = readFileSync(new URL('./book_import.ts', import.meta.url), 'utf8')
    expect(source).toContain("'إضافة مؤلف مشارك'")
    expect(source).toContain('reviewedAuthors(item.author, item.coAuthors, knownAuthors)')
    expect(source).toContain('authors,')
  })
})
