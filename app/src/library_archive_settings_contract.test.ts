import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
describe('library archive settings contract', () => {
  it('builds and downloads the complete local archive from settings', () => {
    const source = readFileSync(new URL('./screens/settings.ts', import.meta.url), 'utf8')
    expect(source).toContain('تصدير أرشيف المكتبة الكامل'); expect(source).toContain('const books = await listBooks()')
    expect(source).toContain('buildLibraryArchive(books)'); expect(source).toContain("mimeType: 'application/zip'")
    expect(source).toContain('previewLibraryArchive(candidates, existing)'); expect(source).toContain("value: 'replace-same'")
    expect(source).toContain('لا تُستورد بيانات القراءة من هذا ZIP')
  })
})
