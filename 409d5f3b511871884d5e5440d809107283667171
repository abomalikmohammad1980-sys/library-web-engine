import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('BOK and EPUB formatted PDF title page', () => {
  it('prepends an unnumbered metadata title page and offers formatted PDF saving', () => {
    const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
    const book = readFileSync(new URL('./screens/book.ts', import.meta.url), 'utf8')
    const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    const css = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')
    expect(reader).toContain("prepend(textBookTitlePage(stored))")
    expect(reader).toContain("new URLSearchParams(query).get('print') !== '1'")
    expect(reader).toContain('window.print()')
    expect(book).toContain("'حفظ PDF منسق'")
    expect(library).toContain("'حفظ PDF منسق'")
    expect(css).toContain('@media print')
    expect(css).toContain('.reader__text-title-page')
  })
})
