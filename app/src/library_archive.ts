import { strToU8, zipSync } from 'fflate'
import type { StoredBook } from './engine/library_store'
const safe = (value: string): string => value.replace(/[\u202A-\u202E\u2066-\u2069]/g, '').replace(/[\u0000-\u001f\\/:*?"<>|]/g, '-').replace(/\s+/g, ' ').trim().slice(0, 180) || 'book'
export function buildLibraryArchive(books: readonly StoredBook[], exportedAt = new Date()): Uint8Array {
  const files: Record<string, Uint8Array> = {}, entries = books.map(book => {
    const base = `books/${safe(book.id)}`, displayPath = `${base}/display-${safe(book.fileName)}`; files[displayPath] = book.data
    const sourcePath = book.sourceData ? `${base}/original-${safe(book.fileName)}` : undefined; if (sourcePath) files[sourcePath] = book.sourceData!
    const pdfPath = book.pdfData ? `${base}/${safe(book.pdfFileName ?? `${book.title}.pdf`)}` : undefined; if (pdfPath) files[pdfPath] = book.pdfData!
    const volumes = book.volumes?.map(volume => { const displayPath = `${base}/volumes/${volume.number}-display-${safe(volume.fileName)}`; files[displayPath] = volume.data; const sourcePath = volume.sourceData ? `${base}/volumes/${volume.number}-original-${safe(volume.fileName)}` : undefined; if (sourcePath) files[sourcePath] = volume.sourceData!; return { number: volume.number, fileName: volume.fileName, mimeType: volume.mimeType, displayPath, sourcePath, sourceMimeType: volume.sourceMimeType } }) ?? []
    return { id: book.id, title: book.title, author: book.author, authorId: book.authorId, deathYearHijri: book.deathYearHijri, contemporary: book.contemporary, category: book.category, publisher: book.publisher, edition: book.edition, investigator: book.investigator, publicationYearHijri: book.publicationYearHijri, description: book.description, seriesName: book.seriesName, seriesOrder: book.seriesOrder, addedAt: book.addedAt, originalSha256: book.originalSha256, fileName: book.fileName, mimeType: book.mimeType, displayPath, sourcePath, sourceMimeType: book.sourceMimeType, pdfPath, pdfFileName: book.pdfFileName, parts: book.parts, volumes }
  })
  const manifest = { format: 'alkhizana-library-archive', version: 1, exportedAt: exportedAt.toISOString(), bookCount: entries.length, books: entries }
  files['manifest.json'] = strToU8(JSON.stringify(manifest, null, 2)); files['README.txt'] = strToU8('أرشيف الخِزانة المفتوح\nmanifest.json يصف الكتب، ومجلد books يحوي ملفات Word الأصلية/المهيأة وPDF المتاحة. لا يحتوي الأرشيف كلمات مرور أو بيانات سحابية.\n')
  return zipSync(files, { level: 6 })
}
