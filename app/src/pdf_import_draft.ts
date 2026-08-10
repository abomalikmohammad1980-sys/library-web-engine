import { parseBookFileName } from './library_metadata'
import { pdfFirstPageCover, pdfProposedMetadata, type PdfProposedMetadata } from './pdf_import'

export interface PdfImportDraft {
  format: 'pdf'
  file: File
  data: Uint8Array
  title: string
  author: string
  description?: string
  publisher?: string
  edition?: string
  investigator?: string
  publicationYearHijri?: number
  pdfFirstPageCover?: { data: Uint8Array; mimeType: string }
  pdfHasTextLayer?: boolean
}

export interface PdfDraftDependencies {
  metadata: (data: Uint8Array, fileName: string) => Promise<PdfProposedMetadata>
  firstPageCover: (data: Uint8Array) => Promise<{ data: Uint8Array; mimeType: string; hasTextLayer: boolean } | undefined>
}

const defaultDependencies: PdfDraftDependencies = {
  metadata: pdfProposedMetadata,
  firstPageCover: pdfFirstPageCover,
}

/**
 * يبقى ملف PDF الأصلي هو سلطة الاستيراد. استخراج غلاف الصفحة الأولى تحسين
 * اختياري قد يفشل بسبب Canvas أو PDF.js أو إعادة تشغيل Vite، ولا يجوز أن
 * يمنع تكوين المسودة أو حفظ الملف الصحيح.
 */
export async function preparePdfImportDraft(
  file: File,
  fallbackAuthor: string,
  dependencies: PdfDraftDependencies = defaultDependencies,
): Promise<PdfImportDraft> {
  const data = new Uint8Array(await file.arrayBuffer())
  const fromName = parseBookFileName(file.name)
  const metadata = await dependencies.metadata(data, file.name)
  const firstPageCover = await dependencies.firstPageCover(data).catch(() => undefined)
  return {
    format: 'pdf',
    file,
    data,
    title: fromName.title,
    author: fromName.author || metadata.author || fallbackAuthor,
    ...(metadata.publisher ? { publisher: metadata.publisher } : {}),
    ...(metadata.edition ? { edition: metadata.edition } : {}),
    ...(metadata.investigator ? { investigator: metadata.investigator } : {}),
    ...(metadata.publicationYearHijri ? { publicationYearHijri: metadata.publicationYearHijri } : {}),
    ...(metadata.description ? { description: metadata.description } : {}),
    ...(firstPageCover ? { pdfFirstPageCover: firstPageCover, pdfHasTextLayer: firstPageCover.hasTextLayer } : {}),
  }
}
