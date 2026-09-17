import { describe, expect, it } from 'vitest'
import { deriveSearchTerm, normalizeArabic, pageForParagraph, virtualRange } from './search_presentation'

describe('search presentation helpers', () => {
  it('normalizes Arabic marks and letter variants', () => {
    expect(normalizeArabic('إِلَى الـقُرْآنِ ـ ة')).toBe('الي القران ه')
  })

  it('يطبع نسخة البحث فقط ولا يغيّر النص الأصلي ذي الكشيدة', () => {
    const original = 'الرَّحـمٰن'
    expect(normalizeArabic(original)).toBe('الرحمن')
    expect(original).toBe('الرَّحـمٰن')
  })

  it('derives useful morphological and root terms', () => {
    expect(deriveSearchTerm('والقلوب', 'morphological')).toBe('قلوب')
    expect(deriveSearchTerm('والقلوب', 'root')).toBe('قلب')
  })

  it('maps a paragraph to the adjusted Word page', () => {
    const map = { totalPages: 2, paragraphCount: 8, starts: [
      { paragraphIndex: 0, physicalPage: 1, adjustedPage: 5 },
      { paragraphIndex: 4, physicalPage: 2, adjustedPage: 6 },
    ] }
    expect(pageForParagraph(map, 6)).toBe(6)
  })

  it('keeps the rendered window bounded for huge result sets', () => {
    const range = virtualRange(174 * 50_000, 100_000)
    expect(range.start).toBeGreaterThan(49_000)
    expect(range.end - range.start).toBeLessThanOrEqual(36)
  })
})
