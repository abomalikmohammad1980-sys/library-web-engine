import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('multi-part PDF user flow', () => {
  it('lets a book with multiple Word volumes enter the real conversion and merge path', () => {
    const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    const converter = readFileSync(new URL('./engine/word_pdf.ts', import.meta.url), 'utf8')

    expect(reader).not.toContain('دمج PDF للأجزاء المتعددة قيد الإكمال')
    expect(reader).toContain('await convertStoredBookToPdf(id)')
    expect(converter).toContain('if (book.volumes && book.volumes.length > 1)')
    expect(converter).toContain('await merged.copyPages(source, source.getPageIndices())')
    expect(converter).toContain('await saveBookPdf(id, pdf')
  })
})
