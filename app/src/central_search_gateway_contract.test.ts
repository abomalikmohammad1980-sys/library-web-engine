import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('central search gateway', () => {
  it('filters book and author suggestions, while Enter routes to the full search screen', () => {
    const source = readFileSync(new URL('./live_search.ts', import.meta.url), 'utf8')
    expect(source).toContain('const params = new URLSearchParams({ q: query })')
    expect(source).toContain("if (scope.category) params.set('category', scope.category)")
    expect(source).toContain('routeLocation.hash = `#/search?${params.toString()}`')
    expect(source).toContain("event.key === 'Enter'")
    expect(source).toContain("panel.className = scope.inline ? 'live-search live-search--inline' : 'live-search'")
    expect(source).toContain('liveMetadataSuggestions')
    expect(source).toContain('اختر كتابًا')
    expect(source).toContain("ordinal.className = 'live-search__ordinal'")
    expect(source).not.toContain('searchAllBooks')
  })
})
