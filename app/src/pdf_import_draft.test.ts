import { describe, expect, it } from 'vitest'
import { preparePdfImportDraft } from './pdf_import_draft'

function pdfFile(name = 'كتاب الاختبار - أحمد بن علي.pdf'): File {
  const bytes = new TextEncoder().encode('%PDF-1.7\n%%EOF')
  return { name, arrayBuffer: async () => bytes.buffer } as File
}

describe('PDF intake draft resilience', () => {
  it('keeps the original PDF ready for review when first-page cover rendering fails', async () => {
    const draft = await preparePdfImportDraft(pdfFile(), 'غير معروف', {
      metadata: async () => ({ title: 'عنوان داخلي غير معتمد', publisher: 'دار الاختبار' }),
      firstPageCover: async () => { throw new TypeError('Failed to fetch dynamically imported module: /node_modules/.vite/deps/pdfjs-dist.js?v=stale') },
    })

    expect(draft.format).toBe('pdf')
    expect(new TextDecoder().decode(draft.data)).toContain('%PDF-1.7')
    expect(draft.title).toBe('كتاب الاختبار')
    expect(draft.author).toBe('أحمد بن علي')
    expect(draft.publisher).toBe('دار الاختبار')
    expect(draft.pdfFirstPageCover).toBeUndefined()
    expect(draft.pdfHasTextLayer).toBeUndefined()
  })

  it('retains the extracted first page when the optional renderer succeeds', async () => {
    const cover = new Uint8Array([1, 2, 3])
    const draft = await preparePdfImportDraft(pdfFile('كتاب فقط.pdf'), 'مؤلف المجلد', {
      metadata: async () => ({ title: 'كتاب فقط' }),
      firstPageCover: async () => ({ data: cover, mimeType: 'image/webp', hasTextLayer: true }),
    })
    expect(draft.author).toBe('مؤلف المجلد')
    expect(draft.pdfFirstPageCover?.data).toEqual(cover)
    expect(draft.pdfHasTextLayer).toBe(true)
  })
})
