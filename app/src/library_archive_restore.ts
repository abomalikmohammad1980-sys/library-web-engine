import { strFromU8, unzipSync } from 'fflate'
import { sha256Hex, type StoredBook } from './engine/library_store'
export type ArchiveConflictPolicy = 'skip' | 'replace-as-new' | 'replace-same'
export interface ArchivePreview { total: number; conflicts: number; newBooks: number }
export interface ArchiveRestoreReport { imported: number; skipped: number; failed: Array<{ id: string; message: string }> }
const object = (value: unknown): Record<string, any> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : {}
export const ARCHIVE_LIMITS = { compressedBytes: 512 * 1024 * 1024, expandedBytes: 2 * 1024 * 1024 * 1024, files: 50_000, books: 10_000, fileBytes: 512 * 1024 * 1024 } as const
const safePath = (path: unknown): path is string => {
  if (typeof path !== 'string' || !path.length || path.startsWith('/') || path.includes('\\') || /[\u0000-\u001f:]/.test(path)) return false
  const segments = path.split('/')
  return segments.every(segment => segment.length > 0 && segment !== '.' && segment !== '..')
}
export async function parseLibraryArchive(bytes: Uint8Array): Promise<StoredBook[]> {
  if (bytes.byteLength > ARCHIVE_LIMITS.compressedBytes) throw new Error('حجم ZIP يتجاوز الحد الآمن')
  let fileCount = 0, expandedBytes = 0
  let files: Record<string, Uint8Array>; try { files = unzipSync(bytes, { filter: file => { fileCount++; expandedBytes += file.originalSize; if (fileCount > ARCHIVE_LIMITS.files || file.originalSize > ARCHIVE_LIMITS.fileBytes || expandedBytes > ARCHIVE_LIMITS.expandedBytes) throw new Error('archive_limits'); return true } }) } catch (error) { if (error instanceof Error && error.message === 'archive_limits') throw new Error('محتوى ZIP يتجاوز الحدود الآمنة'); throw new Error('ملف ZIP غير صالح') }
  if (!files['manifest.json']) throw new Error('manifest.json مفقود')
  let manifest: Record<string, any>; try { manifest = object(JSON.parse(strFromU8(files['manifest.json']!))) } catch { throw new Error('manifest.json غير صالح') }
  if (manifest.format !== 'alkhizana-library-archive' || manifest.version !== 1 || !Array.isArray(manifest.books)) throw new Error('إصدار أرشيف المكتبة غير مدعوم')
  if (manifest.books.length > ARCHIVE_LIMITS.books) throw new Error('عدد الكتب في الأرشيف يتجاوز الحد الآمن')
  const ids = new Set<string>(), result: StoredBook[] = []
  for (const raw of manifest.books) {
    const item = object(raw); if (typeof item.id !== 'string' || !item.id.trim() || ids.has(item.id)) throw new Error('معرف كتاب مفقود أو مكرر في الأرشيف'); ids.add(item.id)
    if (typeof item.title !== 'string' || !item.title.trim() || typeof item.author !== 'string' || !item.author.trim() || !safePath(item.displayPath) || !files[item.displayPath]) throw new Error(`بيانات الكتاب ${item.id} ناقصة`)
    for (const path of [item.sourcePath, item.pdfPath].filter(Boolean)) if (!safePath(path) || !files[path]) throw new Error(`مسار ملف غير آمن أو مفقود للكتاب ${item.id}`)
    const volumeItems = Array.isArray(item.volumes) ? item.volumes : [], volumes = volumeItems.map((rawVolume: unknown) => { const volume = object(rawVolume); if (!safePath(volume.displayPath) || !files[volume.displayPath] || (volume.sourcePath && (!safePath(volume.sourcePath) || !files[volume.sourcePath]))) throw new Error(`مسار جزء غير آمن أو مفقود للكتاب ${item.id}`); return { number: Math.max(1, Number(volume.number) || 1), fileName: String(volume.fileName || 'volume.docx'), data: files[volume.displayPath]!, mimeType: String(volume.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), ...(volume.sourcePath ? { sourceData: files[volume.sourcePath]!, sourceMimeType: String(volume.sourceMimeType || 'application/octet-stream') } : {}) } })
    const data = files[item.displayPath]!, hash = await sha256Hex(data); if (typeof item.originalSha256 !== 'string' || hash !== item.originalSha256) throw new Error(`بصمة الكتاب ${item.id} غير مطابقة`)
    const optional = (name: string): Record<string, unknown> => item[name] === undefined || item[name] === null || item[name] === '' ? {} : { [name]: item[name] }
    result.push({ id: item.id, title: item.title.trim(), author: item.author.trim(), ...optional('authorId'), ...optional('deathYearHijri'), ...optional('contemporary'), ...optional('category'), ...optional('publisher'), ...optional('edition'), ...optional('investigator'), ...optional('publicationYearHijri'), ...optional('description'), ...optional('seriesName'), ...optional('seriesOrder'), fileName: String(item.fileName || 'book.docx'), fileSize: data.byteLength, addedAt: Number(item.addedAt) || Date.now(), data, mimeType: String(item.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), originalSha256: hash, pdfStatus: item.pdfPath ? 'ready' : 'pending', ...(item.sourcePath ? { sourceData: files[item.sourcePath]!, sourceMimeType: String(item.sourceMimeType || 'application/octet-stream') } : {}), ...(item.pdfPath ? { pdfData: files[item.pdfPath]!, pdfFileName: String(item.pdfFileName || `${item.title}.pdf`) } : {}), ...(Array.isArray(item.parts) ? { parts: item.parts } : {}), ...(volumes.length ? { volumes } : {}) } as StoredBook)
  }
  if (Number(manifest.bookCount) !== result.length) throw new Error('عدد الكتب في manifest لا يطابق محتواه')
  return result
}
export function previewLibraryArchive(books: readonly StoredBook[], existingIds: ReadonlySet<string>): ArchivePreview { const conflicts = books.filter(book => existingIds.has(book.id)).length; return { total: books.length, conflicts, newBooks: books.length - conflicts } }
export async function restoreLibraryArchive(books: readonly StoredBook[], existingIds: ReadonlySet<string>, policy: ArchiveConflictPolicy, persist: (book: StoredBook) => Promise<void>, now = Date.now()): Promise<ArchiveRestoreReport> {
  const report: ArchiveRestoreReport = { imported: 0, skipped: 0, failed: [] }
  const reservedIds = new Set(existingIds)
  for (let index = 0; index < books.length; index++) {
    const book = books[index]!, conflict = reservedIds.has(book.id)
    if (conflict && policy === 'skip') { report.skipped++; continue }
    let candidate = book
    if (conflict && policy === 'replace-as-new') {
      let suffix = 0, id = `${now}-${index}-restored`
      while (reservedIds.has(id)) id = `${now}-${index}-restored-${++suffix}`
      candidate = { ...book, id, addedAt: now }
    }
    try { await persist(candidate); reservedIds.add(candidate.id); report.imported++ } catch (error) { report.failed.push({ id: book.id, message: error instanceof Error ? error.message : 'فشل غير معروف' }) }
  }
  return report
}
