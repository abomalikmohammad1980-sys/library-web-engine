import { describe, expect, it } from 'vitest'
import { BOOK_FORMATS, formatLabel, inferBookFormat } from './book_format'
describe('multi-format domain contract', () => {
  it('infers legacy records without a migration', () => { expect(inferBookFormat({ fileName: 'كتاب.docx' })).toBe('word'); expect(formatLabel({ fileName: 'طبعة.pdf' })).toBe('PDF'); expect(inferBookFormat({ sourceFormat: 'epub', fileName: 'x.bin' })).toBe('epub'); expect(inferBookFormat({ sourceFormat: 'text', fileName: 'بحث.md' })).toBe('markdown') })
  it('keeps capabilities truthful', () => { expect(BOOK_FORMATS.pdf.capabilities.searchable).toBe('when-text-layer'); expect(BOOK_FORMATS.epub.capabilities.status).toBe('available'); expect(BOOK_FORMATS.markdown.capabilities.status).toBe('available'); expect(BOOK_FORMATS['shamela-bok'].capabilities.status).toBe('available') })
})
