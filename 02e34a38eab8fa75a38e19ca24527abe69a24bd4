import { describe, expect, it } from 'vitest'
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate'
import { buildLibraryArchive } from './library_archive'
import { parseLibraryArchive, previewLibraryArchive, restoreLibraryArchive } from './library_archive_restore'
import type { StoredBook } from './engine/library_store'
const book = { id: 'b', title: 'كتاب', author: 'أحمد', fileName: 'book.docx', data: new Uint8Array([1, 2]), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalSha256: '', pdfStatus: 'pending', fileSize: 2, addedAt: 1 } as StoredBook
async function archive(): Promise<Uint8Array> { const digest = await crypto.subtle.digest('SHA-256', book.data.slice().buffer); book.originalSha256 = [...new Uint8Array(digest)].map(n => n.toString(16).padStart(2, '0')).join(''); return buildLibraryArchive([book]) }
describe('library archive restore', () => {
  it('round-trips export and validates preview conflicts', async () => { const parsed = await parseLibraryArchive(await archive()); expect(parsed[0]?.data).toEqual(book.data); expect(previewLibraryArchive(parsed, new Set(['b']))).toEqual({ total: 1, conflicts: 1, newBooks: 0 }) })
  it('rejects traversal, duplicate ids and hash mismatches before persistence', async () => {
    const files = unzipSync(await archive()), manifest = JSON.parse(strFromU8(files['manifest.json']!)); manifest.books[0].displayPath = '../evil.docx'; files['manifest.json'] = strToU8(JSON.stringify(manifest)); await expect(parseLibraryArchive(zipSync(files))).rejects.toThrow('ناقصة')
    for (const unsafe of ['C:/evil.docx', './evil.docx', 'books//evil.docx', 'books\\evil.docx']) { const unsafeFiles = unzipSync(await archive()), unsafeManifest = JSON.parse(strFromU8(unsafeFiles['manifest.json']!)); unsafeFiles[unsafe] = book.data; unsafeManifest.books[0].displayPath = unsafe; unsafeFiles['manifest.json'] = strToU8(JSON.stringify(unsafeManifest)); await expect(parseLibraryArchive(zipSync(unsafeFiles))).rejects.toThrow('ناقصة') }
    const duplicateFiles = unzipSync(await archive()), duplicateManifest = JSON.parse(strFromU8(duplicateFiles['manifest.json']!)); duplicateManifest.books.push(duplicateManifest.books[0]); duplicateManifest.bookCount = 2; duplicateFiles['manifest.json'] = strToU8(JSON.stringify(duplicateManifest)); await expect(parseLibraryArchive(zipSync(duplicateFiles))).rejects.toThrow('مكرر')
    const badHashFiles = unzipSync(await archive()), badHashManifest = JSON.parse(strFromU8(badHashFiles['manifest.json']!)); badHashManifest.books[0].originalSha256 = 'deadbeef'; badHashFiles['manifest.json'] = strToU8(JSON.stringify(badHashManifest)); await expect(parseLibraryArchive(zipSync(badHashFiles))).rejects.toThrow('بصمة')
  })
  it('reports partial per-book failures and honors every conflict policy', async () => {
    const second = { ...book, id: 'c', title: 'ثان' }, persisted: string[] = []
    const report = await restoreLibraryArchive([book, second], new Set(['b']), 'replace-same', async candidate => { if (candidate.id === 'c') throw new Error('disk'); persisted.push(candidate.id) })
    expect(report).toEqual({ imported: 1, skipped: 0, failed: [{ id: 'c', message: 'disk' }] }); expect(persisted).toEqual(['b'])
    expect((await restoreLibraryArchive([book], new Set(['b']), 'skip', async () => {})).skipped).toBe(1)
    let newId = ''; await restoreLibraryArchive([book], new Set(['b']), 'replace-as-new', async candidate => { newId = candidate.id }, 10); expect(newId).toBe('10-0-restored')
  })
})
