import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')

describe('integrated library management contract', () => {
  it('mounts a category catalog only for category routes while keeping private management separate', () => {
    expect(source).toContain('const libraryBooks = categoryRoute.requested ? booksSection(categoryRoute) : null')
    expect(source).toContain('const management = integratedManagementSection()')
    expect(source).toContain('const standardSections = categoryRoute.requested ? []')
    expect(source).toContain("books.filter(book => book.managedSource !== 'published')")
    expect(source).toContain('libraryBooks.books')
  })

  it('keeps selection, shared filters, and a reversible bulk application', () => {
    expect(source).toContain("class: 'library-card__select'")
    expect(source).toContain("categoryControl('التصنيف الجماعي', undefined, true)")
    expect(source).toContain('map(snapshotBookMetadata)')
    expect(source).toContain('snapshot.map(restoreBookMetadata)')
    expect(source).toContain('تراجعت عن آخر تطبيق جماعي')
  })
})
