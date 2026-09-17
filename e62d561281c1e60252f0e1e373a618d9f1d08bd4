import { describe, expect, it } from 'vitest'
import { strFromU8, unzipSync } from 'fflate'
import { buildLibraryArchive } from './library_archive'
import type { StoredBook } from './engine/library_store'
describe('full library archive', () => {
  it('packages an open manifest, Word source/display, PDF and every volume', () => {
    const book = { id: 'b', title: 'كتاب', author: 'أحمد', fileName: 'book.docx', data: new Uint8Array([1]), sourceData: new Uint8Array([2]), sourceMimeType: 'application/msword', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalSha256: 'hash', pdfStatus: 'ready', pdfData: new Uint8Array([3]), pdfFileName: 'book.pdf', fileSize: 1, addedAt: 1, volumes: [{ number: 1, fileName: 'v1.docx', data: new Uint8Array([4]), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' }] } as StoredBook
    const files = unzipSync(buildLibraryArchive([book], new Date('2026-08-08T00:00:00Z'))), manifest = JSON.parse(strFromU8(files['manifest.json']!))
    expect(manifest.format).toBe('alkhizana-library-archive'); expect(manifest.bookCount).toBe(1)
    expect(files[manifest.books[0].displayPath]).toEqual(new Uint8Array([1])); expect(files[manifest.books[0].sourcePath]).toEqual(new Uint8Array([2]))
    expect(files[manifest.books[0].pdfPath]).toEqual(new Uint8Array([3])); expect(files[manifest.books[0].volumes[0].displayPath]).toEqual(new Uint8Array([4]))
    expect(files['README.txt']).toBeTruthy()
  })
})
