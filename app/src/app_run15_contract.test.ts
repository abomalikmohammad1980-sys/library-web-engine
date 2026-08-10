import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const book = readFileSync(new URL('./screens/book.ts', import.meta.url), 'utf8')
const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const shell = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')

describe('run15 interface regression contract', () => {
  it('uses the normalized contiguous substring author filter', () => {
    expect(library).toContain('filterAuthorEntries(')
    expect(library).toContain('لا يوجد اسم مؤلف يحتوي هذا الجزء')
  })

  it('exposes an unambiguous settings gear and four mobile theme choices', () => {
    expect(shell).toContain("icon('settings', 20)")
    expect(shell).toContain("title: 'الإعدادات'")
    expect(shell).toContain("['original', 'light', 'dark', 'sepia']")
  })

  it('labels a standalone PDF with one simple download action in every surface', () => {
    for (const source of [library, book]) {
      expect(source).toContain("sourceIsPdf ? 'تحميل PDF'")
      expect(source).not.toContain("sourceIsPdf ? 'تحميل PDF الأصلي'")
    }
    expect(reader).toContain("format === 'pdf' ? 'تحميل PDF'")
    expect(reader).toContain("if (format === 'pdf')")
  })
})
