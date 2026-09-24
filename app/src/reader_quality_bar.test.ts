import { describe, expect, it } from 'vitest'
import { readerQualitySummary } from './reader_quality_bar'
import type { StoredBook } from './engine/library_store'

function book(overrides: Partial<StoredBook> = {}): StoredBook {
  return {
    id: 'quality-1', title: 'كتاب', author: 'مؤلف', fileName: 'book.bin', fileSize: 3,
    addedAt: 1, data: new Uint8Array([1, 2, 3]), mimeType: 'application/octet-stream',
    originalSha256: 'abc', pdfStatus: 'pending', ...overrides,
  }
}

describe('reader quality summary', () => {
  it('describes a direct PDF without claiming an unmeasured text conversion', () => {
    const result = readerQualitySummary(book({ sourceFormat: 'pdf', mimeType: 'application/pdf' }))
    expect(result.facts.map(fact => fact.label)).toEqual(expect.arrayContaining([
      'عرض مباشر من PDF الأصلي', 'الأصل محفوظ على هذا الجهاز', 'نسخة PDF متاحة',
    ]))
    expect(result.facts.join(' ')).not.toContain('كامل')
  })

  it('reports BOK page evidence and converter version exactly', () => {
    const result = readerQualitySummary(book({
      sourceFormat: 'shamela-bok', managedSource: 'published', bokTextVersion: 4,
      bokPages: [{ id: 1, text: 'نص', part: 1, page: 1 }],
    }))
    expect(result.facts.map(fact => fact.label)).toEqual(expect.arrayContaining([
      'نسخة منشورة من الخزانة', 'نص BOK متاح (1 صفحة مسجلة)', 'محول BOK — إصدار 4',
    ]))
  })

  it('does not call Word pagination verified when no map exists', () => {
    const result = readerQualitySummary(book({ sourceFormat: 'word', fileName: 'book.docx' }))
    expect(result.facts.map(fact => fact.label)).toContain('مطابقة الصفحات غير متحققة')
    expect(result.facts.map(fact => fact.label)).not.toContain('خريطة صفحات Word مرفقة')
  })
})
