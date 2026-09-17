import { getBook, restoreArchivedBook, type StoredBook } from './engine/library_store'
import { parseEpub } from './epub_import'
import { pdfFirstPageCover } from './pdf_import'
import { deterministicCoverHue, deterministicCoverTemplate } from './book_cover'
import { decodeUtf8Text } from './text_import'
import type { BookTag } from './book_tags'

export interface PublishedSource { format: 'word' | 'pdf' | 'epub' | 'shamela-bok' | 'markdown' | 'text'; role: 'primary' | 'alternate'; compression?: 'gzip'; path: string; fileName: string; bytes: number; contentBytes?: number; sha256: string }
export interface PublishedWork { id: string; title: string; author: string; status: 'ready' | 'pending-word-artifact' | 'blocked-security' | 'blocked-review'; security: { verdict: 'allow' | 'quarantine' | 'review'; reasons: string[] }; sources: PublishedSource[]; metadata: { publisher?: string; edition?: string; investigator?: string; description?: string; category?: string; tags?: BookTag[]; sourceCitation?: string }; coverStrategy: 'pdf-page-1' | 'generated'; wordArtifact?: { path: string; totalPages: number; paragraphCount: number } }
export interface PublishedLibraryManifest { schemaVersion: 1; datasetVersion: string; sourceFileCount: number; workCount: number; readyCount: number; works: PublishedWork[] }

const MANIFEST_URL = './library/published/manifest.json'

async function fetchVerifiedSource(source: PublishedSource): Promise<Uint8Array> {
  const response = await fetch(source.path, { credentials: 'same-origin', cache: 'force-cache' })
  if (!response.ok) throw new Error('published_source_unavailable')
  const data = new Uint8Array(await response.arrayBuffer())
  if (data.byteLength !== source.bytes) throw new Error('published_source_size_mismatch')
  const digest = await crypto.subtle.digest('SHA-256', new Uint8Array(data).buffer)
  const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
  if (hash !== source.sha256) throw new Error('published_source_checksum_mismatch')
  return data
}

export function installablePublishedWorks(manifest: PublishedLibraryManifest): PublishedWork[] {
  if (manifest.schemaVersion !== 1) return []
  return manifest.works.filter(work => {
    if (work.status !== 'ready' || work.security.verdict !== 'allow') return false
    const formats = work.sources.map(source => source.format)
    return (formats.length === 1 && (formats[0] === 'pdf' || formats[0] === 'epub' || formats[0] === 'shamela-bok' || formats[0] === 'markdown' || formats[0] === 'text'))
      || (formats.length === 2 && formats.includes('word') && formats.includes('pdf') && Boolean(work.wordArtifact))
  })
}

/** يصلح سجلات Alpha المدارة إذا تغيّر الأصل أو بقيت فيها خريطة قديمة/ناقصة. */
export function publishedBookNeedsRefresh(book: StoredBook, work: PublishedWork): boolean {
  if (book.managedSource !== 'published') return false
  const primary = work.sources.find(source => source.role === 'primary') ?? work.sources[0]
  if (!primary || book.originalSha256 !== primary.sha256) return true
  // لا تكفي بصمة البيانات الوصفية القديمة لإثبات أن البايتات اكتملت في
  // IndexedDB؛ قد تنقطع أول مزامنة ويب وتبقى البطاقة ببصمة صحيحة وPDF مبتور.
  if (book.data?.byteLength !== (primary.contentBytes ?? primary.bytes)) return true
  if (primary.format === 'pdf' && book.pdfData?.byteLength !== primary.bytes) return true
  for (const key of ['publisher', 'edition', 'investigator', 'description', 'category', 'sourceCitation'] as const) {
    if ((book[key] ?? '') !== (work.metadata[key] ?? '')) return true
  }
  const bookTags = (book.tags ?? []).map(tag => `${tag.name}\u0000${tag.source}`).sort()
  const workTags = (work.metadata.tags ?? []).map(tag => `${tag.name}\u0000${tag.source}`).sort()
  if (bookTags.length !== workTags.length || bookTags.some((tag, index) => tag !== workTags[index])) return true
  if (!work.wordArtifact) return false
  const map = book.wordPageMap
  if (!map || map.totalPages !== work.wordArtifact.totalPages || map.paragraphCount !== work.wordArtifact.paragraphCount) return true
  if (map.pages?.length) {
    const physical = new Set(map.pages.map(page => page.physicalPage))
    if (physical.size !== map.totalPages) return true
    for (let page = 1; page <= map.totalPages; page++) if (!physical.has(page)) return true
  }
  return false
}

export async function materializePublishedWork(work: PublishedWork, load = fetchVerifiedSource, loadJson: (path: string) => Promise<unknown> = async path => { const response = await fetch(path, { credentials: 'same-origin', cache: 'force-cache' }); if (!response.ok) throw new Error('published_artifact_unavailable'); return response.json() }): Promise<StoredBook> {
  if (!installablePublishedWorks({ schemaVersion: 1, datasetVersion: 'single', sourceFileCount: work.sources.length, workCount: 1, readyCount: 1, works: [work] }).length) throw new Error('published_work_not_installable')
  const source = work.sources.find(item => item.role === 'primary') ?? work.sources[0]!, packed = await load(source)
  const data = source.compression === 'gzip' ? (await import('fflate')).gunzipSync(packed) : packed
  if (source.contentBytes != null && data.byteLength !== source.contentBytes) throw new Error('published_source_content_size_mismatch')
  const now = Date.now()
  const common = {
    id: work.id, title: work.title, author: work.author, fileName: source.fileName,
    fileSize: data.byteLength, addedAt: now, data, originalSha256: source.sha256,
    pdfStatus: 'pending' as const, coverHue: deterministicCoverHue(work.title), coverTemplate: deterministicCoverTemplate(work.title),
    managedSource: 'published' as const,
    ...work.metadata,
  }
  if (source.format === 'pdf') {
    const cover = await pdfFirstPageCover(data).catch(() => undefined)
    return { ...common, sourceFormat: 'pdf', mimeType: 'application/pdf', pdfData: data, pdfFileName: source.fileName, pdfStatus: 'ready', pdfEngine: 'published-original-v1', ...(cover ? { customCoverData: cover.data, customCoverMimeType: cover.mimeType } : {}) }
  }
  if (source.format === 'epub') {
    const parsed = parseEpub(data, source.fileName)
    return { ...common, sourceFormat: 'epub', mimeType: 'application/epub+zip', extractedText: parsed.text, textToc: parsed.toc, ...(parsed.publisher && !work.metadata.publisher ? { publisher: parsed.publisher } : {}), ...(parsed.description && !work.metadata.description ? { description: parsed.description } : {}) }
  }
  if (source.format === 'shamela-bok') {
    // mdb-reader pulls Node compatibility shims while its module is evaluated.
    // Keep that work behind the explicit BOK path so the public shell can boot
    // without a global `process`, and so non-BOK readers do not pay its cost.
    const runtime = globalThis as typeof globalThis & { process?: { browser: true; env: Record<string, string | undefined>; version: string; nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void } }
    runtime.process ??= { browser: true, env: {}, version: '', nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)) }
    const { CURRENT_BOK_TEXT_VERSION, parseBok } = await import('./bok_import')
    const parsed = parseBok(data, source.fileName)
    return { ...common, sourceFormat: 'shamela-bok', mimeType: 'application/x-shamela-bok',
      extractedText: parsed.extractedText, bokPages: parsed.pages, bokToc: parsed.toc,
      bokTextVersion: CURRENT_BOK_TEXT_VERSION,
      ...(!work.metadata.publisher && parsed.publisher ? { publisher: parsed.publisher } : {}),
      ...(!work.metadata.edition && parsed.edition ? { edition: parsed.edition } : {}),
      ...(!work.metadata.investigator && parsed.investigator ? { investigator: parsed.investigator } : {}),
      ...(!work.metadata.description && parsed.description ? { description: parsed.description } : {}),
    }
  }
  if (source.format === 'markdown' || source.format === 'text') {
    const extractedText = decodeUtf8Text(data)
    return { ...common, sourceFormat: source.format, mimeType: source.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8', extractedText }
  }
  if (source.format === 'word' && work.wordArtifact) {
    const pdfSource = work.sources.find(item => item.format === 'pdf')
    if (!pdfSource) throw new Error('published_word_pdf_missing')
    const pdfData = await load(pdfSource), wordPageMap = await loadJson(work.wordArtifact.path) as StoredBook['wordPageMap']
    if (!wordPageMap || wordPageMap.totalPages !== work.wordArtifact.totalPages || wordPageMap.paragraphCount !== work.wordArtifact.paragraphCount) throw new Error('published_word_map_mismatch')
    const cover = await pdfFirstPageCover(pdfData).catch(() => undefined)
    return { ...common, sourceFormat: 'word', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', pdfData, pdfFileName: pdfSource.fileName, pdfStatus: 'ready', pdfEngine: 'published-original-v1', wordPageMap, physicalPageCount: wordPageMap.totalPages, ...(cover ? { customCoverData: cover.data, customCoverMimeType: cover.mimeType } : {}) }
  }
  throw new Error('published_format_requires_reviewed_derivatives')
}

export async function ensurePublishedLibrarySeeded(): Promise<{ installed: number; failed: number }> {
  let manifest: PublishedLibraryManifest
  try {
    const response = await fetch(MANIFEST_URL, { credentials: 'same-origin', cache: 'no-cache' })
    if (!response.ok) return { installed: 0, failed: 0 }
    manifest = await response.json() as PublishedLibraryManifest
  } catch { return { installed: 0, failed: 0 } }
  let installed = 0, failed = 0
  for (const work of installablePublishedWorks(manifest)) {
    const existing = await getBook(work.id)
    if (existing && !publishedBookNeedsRefresh(existing, work)) continue
    try { await restoreArchivedBook(await materializePublishedWork(work)); installed += 1 } catch { failed += 1 }
  }
  if (installed) window.dispatchEvent(new CustomEvent('library-changed'))
  return { installed, failed }
}

/** يضمن كتابًا منشورًا بعينه قبل فتح رابطه، بدل انتظار غرس المكتبة كلها. */
export async function ensurePublishedWorkSeeded(id: string): Promise<StoredBook | undefined> {
  const existing = await getBook(id)
  let manifest: PublishedLibraryManifest
  try {
    const response = await fetch(MANIFEST_URL, { credentials: 'same-origin', cache: 'no-cache' })
    if (!response.ok) return existing
    manifest = await response.json() as PublishedLibraryManifest
  } catch { return existing }
  const work = installablePublishedWorks(manifest).find(item => item.id === id)
  if (!work) return existing
  if (existing && !publishedBookNeedsRefresh(existing, work)) return existing
  try {
    await restoreArchivedBook(await materializePublishedWork(work))
    window.dispatchEvent(new CustomEvent('library-changed'))
    return getBook(id)
  } catch { return existing }
}
