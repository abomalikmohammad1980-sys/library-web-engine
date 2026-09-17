import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('search result taxonomy links', () => {
  it('uses the shared author destination instead of inert metadata text', () => {
    const source = readFileSync(new URL('./screens/search.ts', import.meta.url), 'utf8')
    expect(source).toContain("import { authorLink, bookAuthorLinks } from '../taxonomy_links'")
    expect(source).toContain('storedBook ? bookAuthorLinks(storedBook) : authorLink(result.author)')
    expect(source).not.toContain("const meta = [result.author || 'مؤلف غير معروف'")
  })
})
