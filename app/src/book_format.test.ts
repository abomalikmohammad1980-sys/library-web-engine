import { describe, expect, it } from 'vitest'
import { BOOK_FORMATS, formatLabel, inferBookFormat, isTextualReaderFormat } from './book_format'
describe('multi-format domain contract', () => {
  it('recognizes JPG originals without pretending OCR exists',()=>{expect(inferBookFormat({fileName:'page.JPEG'})).toBe('jpeg');expect(formatLabel({mimeType:'image/jpeg'})).toBe('JPG');expect(BOOK_FORMATS.jpeg.capabilities.searchable).toBe(false)})
  it('recognizes HTML originals with a searchable inert reading view',()=>{expect(inferBookFormat({fileName:'book.HTM'})).toBe('html');expect(formatLabel({mimeType:'text/html; charset=utf-8'})).toBe('HTML');expect(BOOK_FORMATS.html.capabilities.searchable).toBe(true)})
  it('routes HTML and other textual books away from the Word parser',()=>{expect(['text','markdown','epub','html','shamela-bok'].every(format=>isTextualReaderFormat(format as Parameters<typeof isTextualReaderFormat>[0]))).toBe(true);expect(isTextualReaderFormat('word')).toBe(false);expect(isTextualReaderFormat('pdf')).toBe(false)})
  it('infers legacy records without a migration', () => { expect(inferBookFormat({ fileName: 'كتاب.docx' })).toBe('word'); expect(formatLabel({ fileName: 'طبعة.pdf' })).toBe('PDF'); expect(inferBookFormat({ sourceFormat: 'epub', fileName: 'x.bin' })).toBe('epub'); expect(inferBookFormat({ sourceFormat: 'text', fileName: 'بحث.md' })).toBe('markdown') })
  it('keeps capabilities truthful', () => { expect(BOOK_FORMATS.pdf.capabilities.searchable).toBe('when-text-layer'); expect(BOOK_FORMATS.epub.capabilities.status).toBe('available'); expect(BOOK_FORMATS.markdown.capabilities.status).toBe('available'); expect(BOOK_FORMATS['shamela-bok'].capabilities.status).toBe('available') })
})
