import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('author creation', () => {
  it('offers a real full author form from the permanent directory', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain("'إضافة مؤلف'")
    expect(source).toContain('authorCreatePanel')
    for (const label of ['اسم المؤلف *', 'الأسماء والكنى الأخرى', 'سنة الميلاد (هـ)', 'سنة الوفاة (هـ)', 'الترجمة', 'شيوخه', 'تلاميذه', 'أشهر مؤلفاته', 'مصدر الترجمة']) expect(source).toContain(label)
    expect(source).toContain('await saveAuthor({')
    expect(source).toContain('أُضيف المؤلف إلى دليل الخزانة')
  })
})
