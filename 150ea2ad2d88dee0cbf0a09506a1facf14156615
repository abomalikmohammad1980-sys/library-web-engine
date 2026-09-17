import type { BookFormat } from './book_format'

const labels: Record<BookFormat, string> = { word: 'DOCX', pdf: 'PDF', 'shamela-bok': 'BOK', epub: 'EPUB', markdown: 'Markdown', text: 'نصي UTF-8' }
export function invalidBookFormatMessage(format: BookFormat): string { return `الملف المرسل ليس ${labels[format]} صالحًا` }
export function hasBookFormatSignature(data: Uint8Array, format: BookFormat): boolean {
  if (!data.length) return false
  if (format === 'pdf') return new TextDecoder('latin1').decode(data.subarray(0, 5)) === '%PDF-'
  if (format === 'word' || format === 'epub') return data[0] === 0x50 && data[1] === 0x4b
  if (format === 'shamela-bok') return new TextDecoder('latin1').decode(data.subarray(4, 19)) === 'Standard Jet DB'
  try { new TextDecoder('utf-8', { fatal: true }).decode(data); return true } catch { return false }
}
export function assertBookFormat(data: Uint8Array, format: BookFormat): void { if (!hasBookFormatSignature(data, format)) throw new Error(invalidBookFormatMessage(format)) }
