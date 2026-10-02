import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('search result taxonomy links', () => {
  it('uses the shared author destination instead of inert metadata text', () => {
    const source = readFileSync(new URL('./screens/search.ts', import.meta.url), 'utf8')
    const taxonomyImports = source.match(/import\s*\{([^}]+)\}\s*from\s*['"]\.\.\/taxonomy_links['"]/)?.[1]
    expect(taxonomyImports?.split(',').map(name => name.trim())).toEqual(expect.arrayContaining(['authorLink', 'bookAuthorLinks']))
    expect(source).toContain('storedBook ? bookAuthorLinks(storedBook) : authorLink(result.author)')
    expect(source).not.toContain("const meta = [result.author || 'مؤلف غير معروف'")
  })
})
