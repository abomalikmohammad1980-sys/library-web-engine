import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')

describe('filtered library management UI contract', () => {
  it('offers select-all, clear, bulk metadata/shelf actions and confirmed deletion', () => {
    expect(source).toContain('تحديد كل نتائج التصفية')
    expect(source).toContain('مسح التحديد')
    expect(source).toContain('تطبيق على المحدد')
    expect(source).toContain('نقل إلى الرف')
    expect(source).toMatch(/if \(!confirm\(`حذف/)
    expect(source).toContain('bulkDeleteBooks([...selected]')
  })

  it('excludes published system books from every bulk entry path', () => {
    expect(source).toContain('bulkSelectableIds(visibleBooks)')
    expect(source).toContain('known = bulkSelectableIds(books)')
    expect(source).toContain("book.managedSource === 'published' ? { disabled: true }")
  })

  it('collapses the bulk toolbar to one column on narrow mobile', () => {
    expect(css).toContain('@media (max-width: 620px)')
    expect(css).toMatch(/\.library-admin__filters, \.library-admin__bulk, \.library-admin__editor \{ position: static; grid-template-columns: 1fr; \}/)
  })
})
