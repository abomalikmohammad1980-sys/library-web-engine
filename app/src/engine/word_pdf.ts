import { getBook, saveBookPdf, setPdfConverting, setPdfFailed, type WordPageMap } from './library_store'
import { getRuntimeCapabilities } from '../runtime_capabilities'

// v3 يبطل النسخ القديمة التي كان عارض PDF.js يستبدل بعض خطوطها العربية.
export const PDF_ENGINE_VERSION = 'microsoft-word-com-visual-v3'
export const BROWSER_PDF_ENGINE_VERSION = 'browser-scene-raster-v1'

export type PdfConversionMode = 'browser' | 'office'

export function pdfCreationOptions(capabilities: { wordPdfConversionAvailable: boolean }) {
  return {
    primaryLabel: 'إنشاء PDF من عرض المتصفح',
    browserAvailable: true,
    officeHelperAvailable: capabilities.wordPdfConversionAvailable,
    ...(capabilities.wordPdfConversionAvailable ? { officeLabel: 'إنشاء PDF عالي الدقة عبر Word' } : {}),
  }
}

export function hasPdfSignature(data?: Uint8Array): boolean {
  return Boolean(data && data.length >= 5 && data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46 && data[4] === 0x2d)
}

/** لا نعتمد PDF صادرًا إذا أسقط المحول ورقةً من خريطة Word السلطوية. */
export async function assertConvertedPdfPageCardinality(
  pdf: Uint8Array,
  wordPageMap?: Pick<WordPageMap, 'totalPages'>,
): Promise<number> {
  const { PDFDocument } = await import('pdf-lib')
  let count: number
  try { count = (await PDFDocument.load(pdf)).getPageCount() }
  catch { throw new Error('استجابة المحوّل ليست ملف PDF صالحًا') }
  if (count < 1) throw new Error('المحوّل أعاد PDF بلا صفحات')
  if (wordPageMap && count !== wordPageMap.totalPages) {
    throw new Error(`فشل حفظ PDF: أعاد المحوّل ${count} صفحة بينما ملف Word يحتوي ${wordPageMap.totalPages} صفحة`)
  }
  return count
}

export function needsPdfRefresh(book: { pdfData?: Uint8Array; pdfEngine?: string; sourceFormat?: string }): boolean {
  if (book.sourceFormat === 'jpeg') return !hasPdfSignature(book.pdfData)
  if (book.sourceFormat === 'pdf') return !hasPdfSignature(book.pdfData)
  return !hasPdfSignature(book.pdfData) || (!book.pdfEngine?.startsWith('manual-upload') && !book.pdfEngine?.startsWith('published-original') && book.pdfEngine !== 'microsoft-word-companion-v1' && book.pdfEngine !== PDF_ENGINE_VERSION && book.pdfEngine !== BROWSER_PDF_ENGINE_VERSION)
}

const conversions = new Map<string, { mode: PdfConversionMode; task: Promise<void> }>()

export function convertStoredBookToPdf(id: string, mode: PdfConversionMode = 'browser'): Promise<void> {
  const active = conversions.get(id)
  if (active?.mode === mode) return active.task
  // Different engines must not share results or write competing derivatives.
  // A failed earlier conversion does not cancel the explicitly requested next mode.
  const previous = active ? active.task.catch(() => undefined) : Promise.resolve()
  const task = previous.then(() => performConversion(id, mode)).finally(() => {
    if (conversions.get(id)?.task === task) conversions.delete(id)
  })
  conversions.set(id, { mode, task })
  return task
}

async function performConversion(id: string, mode: PdfConversionMode): Promise<void> {
  const capabilities = await getRuntimeCapabilities()
  if (mode === 'office' && !capabilities.wordPdfConversionAvailable) {
    throw new Error('مساعد Word المحلي غير متاح؛ استخدم إنشاء PDF من عرض المتصفح.')
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
        const converted = mode === 'office' ? await convertBytesWithOffice(volume.data, volume.mimeType) : await convertBytesInBrowser(volume.data)
        const source = await PDFDocument.load(converted.pdf)
        const copied = await merged.copyPages(source, source.getPageIndices())
        for (const page of copied) merged.addPage(page)
        parts.push({ number: volume.number, title: `الجزء ${volume.number}`, startPage: nextPdfPage, endPage: nextPdfPage + copied.length - 1, wordStartPage: 1 })
        nextPdfPage += copied.length
        maps.push(converted.wordPageMap)
      }
      const pdf = new Uint8Array(await merged.save({ useObjectStreams: true }))
      await saveBookPdf(id, pdf, `${book.title}.pdf`, undefined, mode === 'office' ? PDF_ENGINE_VERSION : BROWSER_PDF_ENGINE_VERSION, parts, maps)
      return
    }
    const converted = mode === 'office' ? await convertBytesWithOffice(book.data, book.mimeType) : await convertBytesInBrowser(book.data)
    // خريطة الكتاب المحلية هي السلطة؛ قد يغفل مساعد Office ترويسة الخريطة،
    // ومسار المتصفح لا يرسل ترويسات أصلًا. لا نحفظ مشتقًا أسقط ورقةً حتى
    // لو كان ملف PDF نفسه صالح البنية.
    await assertConvertedPdfPageCardinality(converted.pdf, book.wordPageMap ?? converted.wordPageMap)
    const pdfName = book.fileName.replace(/\.(docx|doc|rtf)$/i, '') + '.pdf'
    await saveBookPdf(id, converted.pdf, pdfName, converted.wordPageMap, converted.engine)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await setPdfFailed(id, message)
    throw error
  }
}

async function convertBytesWithOffice(data: Uint8Array, mimeType: string): Promise<{ pdf: Uint8Array; wordPageMap?: WordPageMap; engine: string }> {
    const response = await fetch('/api/convert/docx-to-pdf', {
      method: 'POST',
      headers: { 'Content-Type': mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', Accept: 'multipart/form-data' },
      body: new Uint8Array(data),
    })
    if (!response.ok) {
      let message = `فشل التحويل (${response.status})`
      try { message = (await response.json() as { error?: string }).error ?? message } catch { /* نص غير JSON */ }
      throw new Error(message)
    }
    let pdf: Uint8Array
    let wordPageMap: WordPageMap | undefined
    if (response.headers.get('Content-Type')?.toLowerCase().startsWith('multipart/form-data')) {
      const parts = await response.formData()
      const pdfPart = parts.get('pdf'), mapPart = parts.get('pageMap')
      if (!(pdfPart instanceof Blob) || !(mapPart instanceof Blob)) {
        throw new Error('استجابة Word لا تتضمن ملف PDF وخريطة الصفحات معًا')
      }
      pdf = new Uint8Array(await pdfPart.arrayBuffer())
      wordPageMap = parsePageMap(await mapPart.text())
      if (!wordPageMap) throw new Error('خريطة صفحات Word غير صالحة')
    } else {
      // Compatibility with older local helpers; new helpers use body parts.
      pdf = new Uint8Array(await response.arrayBuffer())
      const encodedMap = response.headers.get('X-Word-Page-Map')
      wordPageMap = encodedMap ? decodePageMap(encodedMap) : undefined
    }
    if (pdf.length < 5 || new TextDecoder('ascii').decode(pdf.slice(0, 5)) !== '%PDF-') {
      throw new Error('استجابة المحوّل ليست ملف PDF صالحًا')
    }
    await assertConvertedPdfPageCardinality(pdf, wordPageMap)
    const engine = response.headers.get('X-PDF-Engine') || PDF_ENGINE_VERSION
    return { pdf, ...(wordPageMap ? { wordPageMap } : {}), engine }
}

async function convertBytesInBrowser(data: Uint8Array): Promise<{ pdf: Uint8Array; wordPageMap?: WordPageMap; engine: string }> {
  const [{ extractFromDocx }, { registryProvider }, { buildScene }, { renderDocumentToPdf }] = await Promise.all([
    import('@engine/ooxml-model'), import('@engine/font-system'), import('@engine/scene'), import('@engine/paint'),
  ])
  const [regularResponse, boldResponse] = await Promise.all([
    fetch('/fonts/Al-Jazeera-Arabic-Regular.ttf'), fetch('/fonts/Al-Jazeera-Arabic-Bold.ttf'),
  ])
  if (!regularResponse.ok) throw new Error('تعذّر تحميل خط PDF المتصفحي')
  const regular = new Uint8Array(await regularResponse.arrayBuffer())
  const bold = boldResponse.ok ? new Uint8Array(await boldResponse.arrayBuffer()) : regular
  const provider = registryProvider({
    'al-jazeera-arabic-regular': regular, 'al-jazeera arabic': regular,
    'al-jazeera-arabic-bold': bold, 'al-jazeera arabic bold': bold,
  }, 'Al-Jazeera-Arabic-Regular')
  const scene = await buildScene(extractFromDocx(data), provider, { cooperativeBudgetMs: 12 })
  if (!scene.pages.length) throw new Error('لم ينتج عرض المتصفح صفحات قابلة للتصدير')
  return { pdf: await renderDocumentToPdf(scene, { scale: 1.5, quality: 0.9 }), engine: BROWSER_PDF_ENGINE_VERSION }
}

function decodePageMap(encoded: string): WordPageMap | undefined {
  try {
    const base64 = encoded.replace(/-/g, '+').replace(/_/g, '/')
    const padded = base64 + '='.repeat((4 - base64.length % 4) % 4)
    const binary = atob(padded)
    const bytes = Uint8Array.from(binary, (ch) => ch.charCodeAt(0))
    return parsePageMap(new TextDecoder().decode(bytes))
  } catch { return undefined }
}

function parsePageMap(json: string): WordPageMap | undefined {
  try {
    const parsed = JSON.parse(json) as WordPageMap
    if (!Number.isInteger(parsed.totalPages) || !Number.isInteger(parsed.paragraphCount)
        || !Array.isArray(parsed.starts)) return undefined
    return parsed
  } catch { return undefined }
}
