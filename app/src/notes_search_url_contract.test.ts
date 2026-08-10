import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('reading memory search URL contract', () => {
  it('restores q on load and replaces it as the search changes', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain("search.value = currentHashQuery().get('q') ?? ''")
    expect(source).toContain("replaceHashQuery({ q: search.value.trim() || null })")
  })

  it('preserves the independent kind query contract', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain("replaceHashQuery({ kind: id === 'all' ? null : id })")
  })

  it('offers an explicit clear action that removes q and restores focus', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain("'مسح البحث'")
    expect(source).toContain('clearSearch.hidden = !query')
    expect(source).toContain("search.value = ''; replaceHashQuery({ q: null }); render(); search.focus()")
  })
})
