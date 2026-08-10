import { describe, expect, it } from 'vitest'
import type { StoredBook } from './library_store'
import { indexedParagraphs } from './search_store'

describe('text source search indexing', () => {
  it('indexes UTF-8 paragraphs and never sends them through DOCX extraction', () => {
    const book = { id: 'text-1', sourceFormat: 'text', fileName: 'علم.txt', mimeType: 'text/plain', data: new TextEncoder().encode('باب العلم\n\nفضل التعلّم'), originalSha256: 'sha' } as StoredBook
    expect(indexedParagraphs(book)).toEqual([{ index: 0, text: 'باب العلم' }, { index: 1, text: 'فضل التعلّم' }])
  })
  it('does not claim searchable paragraphs for image-only PDF', () => {
    const book = { id: 'pdf-1', sourceFormat: 'pdf', fileName: 'scan.pdf', mimeType: 'application/pdf', data: new Uint8Array([1]), originalSha256: 'pdf-sha' } as StoredBook
    expect(indexedParagraphs(book)).toEqual([])
  })
})
