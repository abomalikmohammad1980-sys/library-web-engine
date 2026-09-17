import { pdfJsLocalAssets } from './pdfjs_assets'

const PDF_SIGNATURE = '%PDF-'
export const MAX_DIRECT_PDF_BYTES = 200 * 1024 * 1024

export function validateDirectPdf(data: Uint8Array, fileName: string): void {
  if (!fileName.toLocaleLowerCase().endsWith('.pdf')) throw new Error('اختر ملف PDF صحيحًا')
  if (!data.length) throw new Error('ملف PDF فارغ')
  if (data.length > MAX_DIRECT_PDF_BYTES) throw new Error('حجم PDF يتجاوز 200 ميجابايت')
  const signature = String.fromCharCode(...data.slice(0, PDF_SIGNATURE.length))
  if (signature !== PDF_SIGNATURE) throw new Error('توقيع ملف PDF غير صحيح')
}

export function pdfTitleFromFileName(fileName: string): string { return fileName.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim() || 'كتاب PDF' }

export interface PdfProposedMetadata { title: string; author?: string; publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number; description?: string }

export function parsePdfPublishingMetadata(subject = ''): Omit<PdfProposedMetadata, 'title' | 'author'> {
  const result: Omit<PdfProposedMetadata, 'title' | 'author'> = {}
  const description: string[] = []
  for (const rawLine of subject.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const labelled = line.match(/^([^:：]{2,24})\s*[:：]\s*(.+)$/u)
    if (!labelled) { description.push(line); continue }
    const label = labelled[1]!.replace(/\s+/g, ' ').trim(), value = labelled[2]!.trim()
    if (/^(?:الناشر|دار النشر)$/u.test(label)) result.publisher ??= value
    else if (/^(?:الطبعة|رقم الطبعة)$/u.test(label)) result.edition ??= value
    else if (/^(?:المحقق|تحقيق|المراجع)$/u.test(label)) result.investigator ??= value
    else if (/^(?:سنة النشر|تاريخ النشر)$/u.test(label)) {
      const hijri = value.match(/(?:^|\D)(1[234]\d{2})\s*هـ?/u)?.[1]
      if (hijri) result.publicationYearHijri ??= Number(hijri)
      else description.push(line)
    } else description.push(line)
  }
  if (description.length) result.description = description.join('\n')
  return result
}

export async function pdfProposedMetadata(data: Uint8Array, fileName: string): Promise<PdfProposedMetadata> {
  validateDirectPdf(data, fileName)
  try {
    const { PDFDocument } = await import('pdf-lib')
    const document = await PDFDocument.load(data, { updateMetadata: false })
    const title = document.getTitle()?.trim()
    const author = document.getAuthor()?.trim()
    const publishing = parsePdfPublishingMetadata(document.getSubject()?.trim())
    return { title: title && title.length <= 180 ? title : pdfTitleFromFileName(fileName), ...(author && author.length <= 100 ? { author } : {}), ...publishing }
  } catch { return { title: pdfTitleFromFileName(fileName) } }
}

export async function pdfFirstPageCover(data: Uint8Array): Promise<{ data: Uint8Array; mimeType: string; hasTextLayer: boolean } | undefined> {
  if (typeof document === 'undefined') return undefined
  const pdfjs = await import('pdfjs-dist')
  const worker = await import('pdfjs-dist/build/pdf.worker.min.mjs?url')
  pdfjs.GlobalWorkerOptions.workerSrc = worker.default
  const task = pdfjs.getDocument({ data: new Uint8Array(data), disableFontFace: true, useSystemFonts: false, useWasm: true, ...pdfJsLocalAssets() })
  try {
    const pdf = await task.promise
    const page = await pdf.getPage(1)
    const text = await page.getTextContent()
    const hasTextLayer = text.items.some(item => 'str' in item && Boolean(item.str.trim()))
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.5, 720 / Math.max(1, base.width))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.ceil(viewport.width)); canvas.height = Math.max(1, Math.ceil(viewport.height))
    const context = canvas.getContext('2d')
    if (!context) return undefined
    await page.render({ canvas, canvasContext: context, viewport }).promise
    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/webp', .82))
    if (!blob || blob.size > 900 * 1024) return undefined
    return { data: new Uint8Array(await blob.arrayBuffer()), mimeType: 'image/webp', hasTextLayer }
  } catch { return undefined } finally { await task.destroy() }
}
