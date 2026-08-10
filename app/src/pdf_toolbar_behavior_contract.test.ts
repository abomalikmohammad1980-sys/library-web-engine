import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('standalone PDF toolbar behavior', () => {
  it('persists and announces every current PDF page for bookmarks and notes', () => {
    expect(source).toContain("localStorage.setItem(`alkhizana:reading-position:${id}`, String(pageIndex))")
    expect(source).toContain('announceReaderPage(pageIndex, total)')
    expect(source).toContain('currentPageIndex(bookId)')
  })

  it('jumps from a PDF annotation to its recorded page without leaving the reader', () => {
    expect(source).toContain("const READER_PAGE_REQUEST_EVENT = 'alkhizana:reader-page-request'")
    expect(source).toContain('new CustomEvent(READER_PAGE_REQUEST_EVENT')
    expect(source).toContain('setPage(index, true)')
  })

  it('removes meaningless DOM flow/search actions but keeps serenity visible', () => {
    expect(source).toContain("'[data-reader-action=\"flow\"]')?.remove()")
    expect(source).toContain("'[data-reader-action=\"search\"]')?.remove()")
    expect(css).toContain('.reader--pdf-source.reader--serenity .reader__info--pdf { display: flex !important; }')
  })

  it('keeps book information as an in-reader dialog with a close control', () => {
    expect(source).toContain("class: 'reader__book-card-close'")
    expect(source).toContain("role: 'dialog'")
    expect(source).toContain('toggleBookInfoDialog(bookCardEl)')
  })
})
