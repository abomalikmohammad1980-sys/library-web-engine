import { inferBookFormat, type BookFormat } from './book_format'
import { hasPdfSignature } from './engine/word_pdf'

export const ORIGINAL_PDF_MISSING_TOOLTIP = 'ملف PDF الأصلي لم يُرفق مع هذا الكتاب'
type PdfBook = { sourceFormat?: BookFormat; fileName?: string; mimeType?: string; data?: Uint8Array; pdfData?: Uint8Array; pdfEngine?: string }
export type PdfButtonAction = 'original' | 'formatted' | 'unavailable'

export function hasOriginalBookPdf(book: PdfBook): boolean {
  const format = inferBookFormat(book)
  if (format === 'pdf') return hasPdfSignature(book.data) || hasPdfSignature(book.pdfData)
  return hasPdfSignature(book.pdfData) && (!book.pdfEngine || book.pdfEngine.startsWith('manual-upload') || book.pdfEngine.startsWith('published-original'))
}

export function pdfButtonAction(book: PdfBook, surface: 'standard' | 'pdf-text'): PdfButtonAction {
  if (hasOriginalBookPdf(book)) return 'original'
  if (surface === 'pdf-text') return 'unavailable'
  return ['shamela-bok', 'epub', 'html', 'markdown', 'text'].includes(inferBookFormat(book)) ? 'formatted' : 'unavailable'
}
