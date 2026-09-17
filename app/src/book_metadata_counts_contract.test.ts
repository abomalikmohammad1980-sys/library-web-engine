import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const read = (path: string): string => readFileSync(new URL(path, import.meta.url), 'utf8')

describe('book metadata count UI', () => {
  it('applies the same fail-closed category and count labels to reader and book profile', () => {
    for (const source of [read('./screens/reader.ts'), read('./screens/book.ts')]) {
      expect(source).toContain('effectiveBookCategory(book)')
      expect(source).toContain('عدد الصفحات')
      expect(source).toContain('عدد الأجزاء')
      expect(source).toContain('bookVolumeCount(metadataBook)')
      expect(source).toContain('withExtractedEditionMetadata(book)')
    }
  })

  it('shows parts only above one and keeps a page row even when no count is known', () => {
    const reader = read('./screens/reader.ts')
    expect(reader).toContain('if (volumeCount > 1)')
    expect(reader).toContain("pageCount > 0 ? arabicNum(pageCount) : 'غير متاح'")
    const profile = read('./screens/book.ts')
    expect(profile).toContain('bookVolumeCount(metadataBook) > 1')
    expect(profile).toContain("pageCount(book) > 0 ?")
  })
})
