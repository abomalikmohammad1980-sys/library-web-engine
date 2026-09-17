import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('bulk library editing clarity', () => {
  it('explains the three real steps and prevents applying with no selection', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain('طريقة التعديل الجماعي')
    expect(source).toContain('ضع علامة على الكتب المطلوبة من بطاقاتها أدناه')
    expect(source).toContain("disabled: true }, 'تطبيق التغييرات'")
    expect(source).toContain('لا تتغير إلا الحقول التي حددتها هنا')
    expect(source).toContain("category.firstElementChild!.textContent = 'لا تغيّر التصنيف'")
  })
})
