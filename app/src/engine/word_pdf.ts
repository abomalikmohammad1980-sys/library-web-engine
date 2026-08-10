import { getBook, saveBookPdf, setPdfConverting, setPdfFailed, type WordPageMap } from './library_store'
import { getRuntimeCapabilities } from '../runtime_capabilities'

// v3 يبطل النسخ القديمة التي كان عارض PDF.js يستبدل بعض خطوطها العربية.
export const PDF_ENGINE_VERSION = 'microsoft-word-com-visual-v3'

export function needsPdfRefresh(book: { pdfData?: Uint8Array; pdfEngine?: string; sourceFormat?: string }): boolean {
  if (book.sourceFormat === 'pdf') return !book.pdfData?.length
  return !book.pdfData?.length || (!book.pdfEngine?.startsWith('manual-upload') && !book.pdfEngine?.startsWith('published-original') && book.pdfEngine !== PDF_ENGINE_VERSION)
}

const conversions = new Map<string, Promise<void>>()

export function convertStoredBookToPdf(id: string): Promise<void> {
  const active = conversions.get(id)
  if (active) return active
  const task = performConversion(id).finally(() => conversions.delete(id))
  conversions.set(id, task)
  return task
}

async function performConversion(id: string): Promise<void> {
  const capabilities = await getRuntimeCapabilities()
  if (!capabilities.wordPdfConversionAvailable) {
    throw new Error('إنشاء PDF من Word يتطلب تشغيل الخِزانة المحلي؛ لم تتغير بيانات الكتاب.')
  }
  const book = await getBook(id)
  if (!book) throw new Error('الكتاب غير موجود')
  await setPdfConverting(id)
  try {
    if (book.volumes && book.volumes.length > 1) {
      const { PDFDocument } = await import('pdf-lib')
      const merged = await PDFDocument.create()
      const parts = []
      const maps: Array<WordPageMap | undefined> = []
      let nextPdfPage = 1
      for (const volume of [...book.volumes].sort((a, b) => a.number - b.number)) {
        const converted = await convertBytes(volume.data, volume.mimeType)
        const source = await PDFDocument.load(converted.pdf)
        const copied = await merged.copyPages(source, source.getPageIndices())
        for (const page of copied) merged.addPage(page)
        parts.push({ number: volume.number, title: `الجزء ${volume.number}`, startPage: nextPdfPage, endPage: nextPdfPage + copied.length - 1, wordStartPage: 1 })
        nextPdfPage += copied.length
        maps.push(converted.wordPageMap)
      }
      const pdf = new Uint8Array(await merged.save({ useObjectStreams: true }))
      await saveBookPdf(id, pdf, `${book.title}.pdf`, undefined, PDF_ENGINE_VERSION, parts, maps)
      return
    }
    const converted = await convertBytes(book.data, book.mimeType)
    const pdfName = book.fileName.replace(/\.(docx|doc|rtf)$/i, '') + '.pdf'
    await saveBookPdf(id, converted.pdf, pdfName, converted.wordPageMap, converted.engine)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await setPdfFailed(id, message)
    throw error
  }
}

async function convertBytes(data: Uint8Array, mimeType: string): Promise<{ pdf: Uint8Array; wordPageMap?: WordPageMap; engine: string }> {
    const response = await fetch('/api/convert/docx-to-pdf', {
      method: 'POST',
      headers: { 'Content-Type': mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' },
      body: new Uint8Array(data),
    })
    if (!response.ok) {
      let message = `فشل التحويل (${response.status})`
      try { message = (await response.json() as { error?: string }).error ?? message } catch { /* نص غير JSON */ }
      throw new Error(message)
    }
    const pdf = new Uint8Array(await response.arrayBuffer())
    if (pdf.length < 5 || new TextDecoder('ascii').decode(pdf.slice(0, 5)) !== '%PDF-') {
      throw new Error('استجابة المحوّل ليست ملف PDF صالحًا')
    }
    const encodedMap = response.headers.get('X-Word-Page-Map')
    const wordPageMap = encodedMap ? decodePageMap(encodedMap) : undefined
    const engine = response.headers.get('X-PDF-Engine') || PDF_ENGINE_VERSION
    return { pdf, ...(wordPageMap ? { wordPageMap } : {}), engine }
}

function decodePageMap(encoded: string): WordPageMap | undefined {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as WordPageMap
    if (!Number.isInteger(parsed.totalPages) || !Number.isInteger(parsed.paragraphCount)
        || !Array.isArray(parsed.starts)) return undefined
    return parsed
  } catch { return undefined }
}
