import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('central search gateway', () => {
  it('routes header and home search to the full search screen without a result popup', () => {
    const source = readFileSync(new URL('./live_search.ts', import.meta.url), 'utf8')
    expect(source).toContain('location.hash = `#/search?q=${encodeURIComponent(query)}`')
    expect(source).toContain("event.key === 'Enter'")
    expect(source).not.toContain("class: 'live-search'")
    expect(source).not.toContain('searchAllBooks')
  })
})
