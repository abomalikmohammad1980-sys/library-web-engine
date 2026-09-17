import { describe, expect, it } from 'vitest'

const { readFileSync } = process.getBuiltinModule('node:fs') as typeof import('node:fs')
const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')

describe('reader action accessible names', () => {
  it('gives selection actions explicit contextual names', () => {
    for (const label of [
      'نسخ النص المحدد',
      'نسخ النص المحدد مع توثيقه',
      'تظليل النص المحدد',
      'حفظ النص المحدد اقتباسًا',
      'البحث عن النص المحدد في الخزانة',
      'البحث عن النص المحدد في Google',
      'ترجمة النص المحدد',
    ]) expect(reader).toMatch(new RegExp(`'aria-label':\\s*'${label}'`))
  })

  it('names navigation, recovery, annotation, and source actions explicitly', () => {
    for (const label of [
      'إعادة محاولة فتح الكتاب',
      'إعادة معالجة الملف الأصلي',
      'عرض النص الاحتياطي للكتاب',
      'الانتقال إلى الصفحة المحددة',
      'الانتقال إلى صفحة PDF المحددة',
      'حفظ الملاحظة',
      'فتح فهرس الكتاب',
    ]) expect(reader).toContain(`'aria-label': '${label}'`)
    expect(reader).toContain("'aria-label': sourceLabel")
    expect(reader).toContain("'aria-label': pdfLabel")
    expect(reader).toContain("'aria-label': downloadLabel")
  })

  it('hides decorative color indicators from assistive technology', () => {
    expect(reader).toContain("class: 'highlight-dot', 'aria-hidden': 'true'")
    expect(reader).toContain("h('span', { 'aria-hidden': 'true' }), color.label")
  })
})
