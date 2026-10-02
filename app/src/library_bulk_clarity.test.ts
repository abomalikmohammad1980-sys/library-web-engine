import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('private books management', () => {
  it('shows only editable user books and keeps bulk instructions in the info hint', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    const section = source.slice(source.indexOf('function integratedManagementSection'), source.indexOf('function booksSection'))
    expect(section).toContain("h('h2', { id: 'library-admin-title' }, 'كتبي الخاصة')")
    expect(section).toContain("icon('info', 20)")
    expect(section).toContain("books.filter(book => book.managedSource !== 'published')")
    expect(section).toContain("disabled: true }, 'تطبيق التغييرات'")
    expect(section).toContain('لا تتغير إلا الحقول التي حددتها هنا')
    expect(section).toContain('لا توجد كتب شخصية قابلة للتعديل الجماعي بعد')
    expect(section).toContain("category.firstElementChild!.textContent = 'لا تغيّر التصنيف'")
    expect(section).not.toContain('تحويل المحدد إلى BOK')
    expect(section).not.toContain('إلغاء التحويل')
  })
})
