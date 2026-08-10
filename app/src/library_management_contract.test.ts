import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')

describe('integrated library management contract', () => {
  it('mounts management beside the single visible books section', () => {
    expect(source.match(/const books = booksSection\(\)/g)).toHaveLength(1)
    expect(source).toContain('const management = integratedManagementSection(books)')
    expect(source).toContain("booksHost.querySelectorAll<HTMLElement>('.library-card[data-book-id]')")
  })

  it('keeps selection, shared filters, and a reversible bulk application', () => {
    expect(source).toContain("class: 'library-card__select'")
    expect(source).toContain("categoryControl('التصنيف الجماعي')")
    expect(source).toContain('map(snapshotBookMetadata)')
    expect(source).toContain('snapshot.map(restoreBookMetadata)')
    expect(source).toContain('تراجعت عن آخر تطبيق جماعي')
  })
})
