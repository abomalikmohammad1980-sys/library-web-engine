import { describe, expect, it } from 'vitest'
import { parsePdfPublishingMetadata, pdfTitleFromFileName, validateDirectPdf } from './pdf_import'
describe('direct PDF import', () => {
  it('accepts a signed PDF and derives an editable title', () => { expect(() => validateDirectPdf(new TextEncoder().encode('%PDF-1.7\n'), 'فقه.pdf')).not.toThrow(); expect(pdfTitleFromFileName('فقه_العبادات.pdf')).toBe('فقه العبادات') })
  it('rejects misleading and empty files', () => { expect(() => validateDirectPdf(new Uint8Array(), 'x.pdf')).toThrow('فارغ'); expect(() => validateDirectPdf(new TextEncoder().encode('not pdf'), 'x.pdf')).toThrow('توقيع') })
  it('distributes labelled PDF subject metadata into review fields', () => {
    expect(parsePdfPublishingMetadata('الناشر: دار العلم\nالطبعة: الثانية\nالمحقق: أحمد\nسنة النشر: 1442 هـ\nتنبيه باق')).toEqual({ publisher: 'دار العلم', edition: 'الثانية', investigator: 'أحمد', publicationYearHijri: 1442, description: 'تنبيه باق' })
  })
})
