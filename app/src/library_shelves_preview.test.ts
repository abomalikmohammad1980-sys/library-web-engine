import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('library shelves preview', () => {
  it('shows only the three most used shelves and links to full management', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain('.slice(0, 3)')
    expect(source).toContain("href: '#/shelves'")
    expect(source).toContain("h('h2', { id: 'library-shelves-title' }, 'رفوفي')")
  })
})
