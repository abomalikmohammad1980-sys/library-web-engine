import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { assertConvertedPdfPageCardinality, BROWSER_PDF_ENGINE_VERSION, hasPdfSignature, needsPdfRefresh, PDF_ENGINE_VERSION, pdfCreationOptions } from './word_pdf'

const pdf = new TextEncoder().encode('%PDF-1.7\n')

describe('PDF refresh integrity', () => {
  it('does not trust non-PDF bytes merely because an engine marked them ready', () => {
    const invalid = new TextEncoder().encode('PK\u0003\u0004')
    expect(hasPdfSignature(invalid)).toBe(false)
    expect(needsPdfRefresh({ pdfData: invalid, pdfEngine: PDF_ENGINE_VERSION })).toBe(true)
    expect(needsPdfRefresh({ pdfData: invalid, pdfEngine: 'manual-upload-v1' })).toBe(true)
  })

  it('accepts an actual PDF from a current or original engine', () => {
    expect(hasPdfSignature(pdf)).toBe(true)
    expect(needsPdfRefresh({ pdfData: pdf, pdfEngine: PDF_ENGINE_VERSION })).toBe(false)
    expect(needsPdfRefresh({ pdfData: pdf, pdfEngine: 'published-original-v1' })).toBe(false)
    expect(needsPdfRefresh({ pdfData: pdf, pdfEngine: BROWSER_PDF_ENGINE_VERSION })).toBe(false)
  })

  it('requires a real PDF signature for original-PDF books too', () => {
    expect(needsPdfRefresh({ sourceFormat: 'pdf', pdfData: new Uint8Array([1, 2, 3]) })).toBe(true)
    expect(needsPdfRefresh({ sourceFormat: 'pdf', pdfData: pdf })).toBe(false)
  })

  it('keeps browser creation available without claiming a local Office helper', () => {
    expect(pdfCreationOptions({ wordPdfConversionAvailable: false })).toEqual({
      primaryLabel: 'إنشاء PDF من عرض المتصفح', browserAvailable: true, officeHelperAvailable: false,
    })
  })

  it('exposes Office only as a detected higher-accuracy option', () => {
    expect(pdfCreationOptions({ wordPdfConversionAvailable: true })).toEqual({
      primaryLabel: 'إنشاء PDF من عرض المتصفح', browserAvailable: true, officeHelperAvailable: true,
      officeLabel: 'إنشاء PDF عالي الدقة عبر Word',
    })
  })

  it('يرفض PDF ناقص الصفحات بدل وسمه جاهزًا اعتمادًا على ترويسة Word', async () => {
    const document = await PDFDocument.create()
    document.addPage(); document.addPage()
    const bytes = new Uint8Array(await document.save())
    await expect(assertConvertedPdfPageCardinality(bytes, { totalPages: 2 })).resolves.toBe(2)
    await expect(assertConvertedPdfPageCardinality(bytes, { totalPages: 3 }))
      .rejects.toThrow('أعاد المحوّل 2 صفحة بينما ملف Word يحتوي 3 صفحة')
  })

  it('يرفض ملفًا يحمل توقيع PDF فقط إذا لم يكن قابلاً للقراءة', async () => {
    await expect(assertConvertedPdfPageCardinality(pdf)).rejects
      .toThrow('استجابة المحوّل ليست ملف PDF صالحًا')
  })

  it('يفحص الناتج النهائي بخريطة الكتاب السلطوية في المتصفح وOffice قبل الحفظ',()=>{
    const source=readFileSync(new URL('./word_pdf.ts',import.meta.url),'utf8')
    expect(source).toContain('await assertConvertedPdfPageCardinality(converted.pdf, book.wordPageMap ?? converted.wordPageMap)')
    expect(source.indexOf('await assertConvertedPdfPageCardinality(converted.pdf, book.wordPageMap ?? converted.wordPageMap)'))
      .toBeLessThan(source.indexOf('await saveBookPdf(id, converted.pdf, pdfName'))
  })
})
