import { getBook, restoreArchivedBook, retirePublishedBook, type StoredBook } from './engine/library_store'
import { parseEpub } from './epub_import'
import { pdfFirstPageCover } from './pdf_import'
import { deterministicCoverHue, deterministicCoverTemplate } from './book_cover'
import { decodeUtf8Text } from './text_import'
import type { BookTag } from './book_tags'
import { ensureShamelaBookReady } from './shamela_pack_seed'
import { RETIRED_TEST_BOOK_IDS } from './retired_test_books'

export interface PublishedSource { format: 'word' | 'pdf' | 'epub' | 'shamela-bok' | 'markdown' | 'text'; role: 'primary' | 'alternate'; compression?: 'gzip'; path: string; parts?: Array<{ path:string; bytes:number; sha256:string }>; fileName: string; bytes: number; contentBytes?: number; contentSha256?: string; sha256: string }
export interface PublishedWork { id: string; title: string; author: string; status: 'ready' | 'pending-word-artifact' | 'blocked-security' | 'blocked-review'; security: { verdict: 'allow' | 'quarantine' | 'review'; reasons: string[] }; sources: PublishedSource[]; metadata: { publisher?: string; edition?: string; investigator?: string; description?: string; category?: string; tags?: BookTag[]; sourceCitation?: string }; coverStrategy: 'pdf-page-1' | 'generated'; wordArtifact?: { path: string; totalPages: number; paragraphCount: number; fragmentCount?: number }; wordFallback?: { paragraphCount: number; extractedTextSha256: string } }
export interface PublishedLibraryManifest { schemaVersion: 1; datasetVersion: string; sourceFileCount: number; workCount: number; readyCount: number; works: PublishedWork[] }

const MANIFEST_URL = './library/published/manifest.json'
const RETIREMENT_MARKER_PREFIX = 'alkhizana:published-retirement:v1:'

export async function fetchPublishedManifestForReader(id:string):Promise<PublishedLibraryManifest>{
  // A reader deep-link must not be decided by an older manifest retained by a
  // service worker/dev browser cache.  The work-specific query is intentionally
  // stable for the current route (so concurrent opens can still coalesce in the
  // browser), but differs from the catalogue seed URL which may predate a newly
  // added canonical tafsir.  Keep the ordinary URL as an offline fallback.
  const freshUrl=`${MANIFEST_URL}?readerWork=${encodeURIComponent(id)}`
  try {
    return await verifiedJsonResponse(await fetch(freshUrl,{credentials:'same-origin',cache:'no-store'}),'manifest') as PublishedLibraryManifest
  } catch (freshError) {
    if(freshError instanceof PublishedLibraryLoadError)throw freshError
    try {
      return await verifiedJsonResponse(await fetch(MANIFEST_URL,{credentials:'same-origin',cache:'no-cache'}),'manifest') as PublishedLibraryManifest
    } catch { throw freshError }
  }
}

export class PublishedLibraryLoadError extends Error { constructor(readonly code:string,cause?:unknown){super(code,{cause});this.name='PublishedLibraryLoadError'} }
async function verifiedJsonResponse(response:Response,kind:'manifest'|'artifact'):Promise<unknown>{
  if(!response.ok)throw new PublishedLibraryLoadError(`published_${kind}_http_${response.status}`)
  if(response.headers.get('content-type')?.toLowerCase().includes('text/html'))throw new PublishedLibraryLoadError(`published_${kind}_spa_fallback`)
  try{return await response.json()}catch(error){throw new PublishedLibraryLoadError(`published_${kind}_json_invalid`,error)}
}

async function fetchVerifiedSource(source: PublishedSource): Promise<Uint8Array> {
  // Some static servers transparently decode a `.gz` response before Fetch exposes
  // its body. Accept that representation only when the manifest carries an explicit
  // digest for the decoded bytes; otherwise keep the packed-byte verification below.
  if (source.compression === 'gzip' && !source.parts?.length) {
    let response = await fetch(source.path, { credentials: 'same-origin', cache: 'no-cache' })
    if ([408,429,500,502,503,504].includes(response.status)) response = await fetch(source.path, { credentials: 'same-origin', cache: 'reload' })
    if (!response.ok) throw new Error('published_source_unavailable')
    const bytes = new Uint8Array(await response.arrayBuffer())
    if (bytes.byteLength === source.contentBytes) {
      if (!source.contentSha256) throw new Error('published_source_content_checksum_missing')
      const digest = await crypto.subtle.digest('SHA-256', bytes.buffer)
      const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
      if (hash !== source.contentSha256) throw new Error('published_source_content_checksum_mismatch')
      return bytes
    }
    if (bytes.byteLength !== source.bytes) throw new Error('published_source_part_size_mismatch')
    const digest = await crypto.subtle.digest('SHA-256', bytes.buffer)
    const hash = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
    if (hash !== source.sha256) throw new Error('published_source_part_checksum_mismatch')
    return bytes
  }
  const chunks = await Promise.all((source.parts?.length ? source.parts : [{ path:source.path, bytes:source.bytes, sha256:source.sha256 }]).map(async part=>{
    let response=await fetch(part.path,{credentials:'same-origin',cache:'no-cache'})
    if([408,429,500,502,503,504].includes(response.status))response=await fetch(part.path,{credentials:'same-origin',cache:'reload'})
    if(!response.ok)throw new Error('published_source_unavailable')
    const bytes=new Uint8Array(await response.arrayBuffer())
    if(bytes.byteLength!==part.bytes)throw new Error('published_source_part_size_mismatch')
    const digest=await crypto.subtle.digest('SHA-256',bytes.buffer),hash=[...new Uint8Array(digest)].map(value=>value.toString(16).padStart(2,'0')).join('')
    if(hash!==part.sha256)throw new Error('published_source_part_checksum_mismatch')
    return bytes
  }))
  const data = new Uint8Array(source.bytes);let offset=0;for(const chunk of chunks){data.set(chunk,offset);offset+=chunk.byteLength}
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
      || (formats.length === 1 && formats[0] === 'word' && Boolean(work.wordArtifact || work.wordFallback))
      || (formats.length === 2 && formats.includes('word') && formats.includes('pdf') && Boolean(work.wordArtifact || work.wordFallback))
  })
}

export function activePublishedWorks(manifest:PublishedLibraryManifest):PublishedWork[]{return installablePublishedWorks(manifest).filter(work=>!RETIRED_TEST_BOOK_IDS.has(work.id))}

type RetirementStorage=Pick<Storage,'getItem'|'setItem'>

function readRetirementMarker(datasetVersion:string,storage:RetirementStorage):Set<string>{
  try {
    const parsed=JSON.parse(storage.getItem(`${RETIREMENT_MARKER_PREFIX}${datasetVersion}`)??'[]')
    return new Set(Array.isArray(parsed)?parsed.filter((id):id is string=>typeof id==='string'):[])
  } catch { return new Set() }
}

function writeRetirementMarker(datasetVersion:string,completed:Set<string>,storage:RetirementStorage):void{
  try { storage.setItem(`${RETIREMENT_MARKER_PREFIX}${datasetVersion}`,JSON.stringify([...completed].sort())) } catch { /* IndexedDB remains authoritative. */ }
}

/**
 * Retirement is idempotent per published dataset. A missing record or a record whose
 * managed identity differs is already safe and must not be retried on every page load:
 * aborting nine write transactions here used to compete with the first library read.
 */
export async function retireManifestTestBooks(
  manifest:PublishedLibraryManifest,
  readBook:(id:string)=>Promise<StoredBook|undefined>=getBook,
  retire:(id:string,sha256:string)=>Promise<boolean>=retirePublishedBook,
  storage:RetirementStorage=localStorage,
):Promise<void>{
  const completed=readRetirementMarker(manifest.datasetVersion,storage)
  let changed=false
  for(const work of manifest.works){
    if(!RETIRED_TEST_BOOK_IDS.has(work.id)||completed.has(work.id))continue
    const primary=work.sources.find(source=>source.role==='primary')??work.sources[0]
    if(!primary)continue
    try {
      const current=await readBook(work.id)
      if(current?.managedSource==='published'&&current.originalSha256===primary.sha256)await retire(work.id,primary.sha256)
      completed.add(work.id);changed=true
    } catch(error){console.warn('published_test_book_retirement_deferred',work.id,error)}
  }
  if(changed)writeRetirementMarker(manifest.datasetVersion,completed,storage)
}

export function publishedWordPageMapComplete(
  map: StoredBook['wordPageMap'],
  artifact: NonNullable<PublishedWork['wordArtifact']>,
): boolean {
  if (!map || map.totalPages !== artifact.totalPages || map.paragraphCount !== artifact.paragraphCount) return false
  if (!Array.isArray(map.starts) || !map.starts.length) return false
  if (artifact.fragmentCount !== undefined && map.fragments?.length !== artifact.fragmentCount) return false
  if (!Array.isArray(map.pages) || map.pages.length !== map.totalPages) return false
  const physical = new Set(map.pages.map(page => page.physicalPage))
  if (physical.size !== map.totalPages) return false
  for (let page = 1; page <= map.totalPages; page++) if (!physical.has(page)) return false
  return true
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
  // سجل BOK المنشور قد يكون من غرس قديم حفظ الأصل والفهرس ولم يثبت إصدار
  // المشتقات. لا نترك القارئ يعيد تحليل Jet القديم عند كل فتح؛ أعد بناء
  // السجل مرة واحدة من الأصل الموثق ثم افتحه من الصفحات الجاهزة.
  if (primary.format === 'shamela-bok' && (book.bokTextVersion !== 4 || !book.bokPages?.length || book.extractedText == null)) return true
  for (const key of ['publisher', 'edition', 'investigator', 'description', 'sourceCitation'] as const) {
    if ((book[key] ?? '') !== (work.metadata[key] ?? '')) return true
  }
  const bookTags = (book.tags ?? []).map(tag => `${tag.name}\u0000${tag.source}`).sort()
  const workTags = (work.metadata.tags ?? []).map(tag => `${tag.name}\u0000${tag.source}`).sort()
  if (bookTags.length !== workTags.length || bookTags.some((tag, index) => tag !== workTags[index])) return true
  if (!work.wordArtifact) return false
  return !publishedWordPageMapComplete(book.wordPageMap, work.wordArtifact)
}

export async function materializePublishedWork(work: PublishedWork, load = fetchVerifiedSource, loadJson: (path: string) => Promise<unknown> = async path => verifiedJsonResponse(await fetch(path, { credentials: 'same-origin', cache: 'force-cache' }),'artifact')): Promise<StoredBook> {
  if (!installablePublishedWorks({ schemaVersion: 1, datasetVersion: 'single', sourceFileCount: work.sources.length, workCount: 1, readyCount: 1, works: [work] }).length) throw new Error('published_work_not_installable')
  const source = work.sources.find(item => item.role === 'primary') ?? work.sources[0]!
  // Reviewed Word assets are independent: do not serialize three network trips
  // before the first page. Promise.all observes every rejection; all original
  // byte/hash and page-map checks still apply before exposing the book.
  const pairedPdf = source.format === 'word' ? work.sources.find(item => item.format === 'pdf') : undefined
  const [packed, reviewedMap, pairedPdfData] = await Promise.all([
    load(source),
    source.format === 'word' && work.wordArtifact ? loadJson(work.wordArtifact.path) : Promise.resolve(undefined),
    pairedPdf ? load(pairedPdf) : Promise.resolve(undefined),
  ])
  const data = source.compression === 'gzip' && packed.byteLength !== source.contentBytes ? (await import('fflate')).gunzipSync(packed) : packed
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
    // The ordinary import limit protects user-selected files. Published assets have
    // already passed exact size and SHA-256 verification, so their reviewed manifest
    // size is the authoritative ceiling (large tafsir works legitimately exceed 20MB).
    const extractedText = decodeUtf8Text(data, Math.max(data.byteLength, source.contentBytes ?? 0))
    return { ...common, sourceFormat: source.format, mimeType: source.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'text/plain; charset=utf-8', extractedText }
  }
  if (source.format === 'word' && work.wordArtifact) {
    const pdfSource = work.sources.find(item => item.format === 'pdf')
    const wordPageMap = reviewedMap as StoredBook['wordPageMap']
    if (!publishedWordPageMapComplete(wordPageMap, work.wordArtifact)) throw new Error('published_word_map_incomplete')
    const completeWordPageMap = wordPageMap!
    const pdfData = pairedPdfData
    const cover = pdfData ? await pdfFirstPageCover(pdfData).catch(() => undefined) : undefined
    return { ...common, sourceFormat: 'word', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', wordPageMap: completeWordPageMap, physicalPageCount: completeWordPageMap.totalPages,
      ...(pdfSource && pdfData ? { pdfData, pdfFileName: pdfSource.fileName, pdfStatus: 'ready' as const, pdfEngine: 'published-original-v1' } : {}),
      ...(cover ? { customCoverData: cover.data, customCoverMimeType: cover.mimeType } : {}) }
  }
  if (source.format === 'word' && work.wordFallback) {
    const { loadBookFromBuffer } = await import('./engine/bridge')
    const loaded = loadBookFromBuffer(data)
    const extractedText = loaded.model.paragraphs.filter(p => !p.excluded && !p.tableCell).map(p => p.text.trim()).filter(Boolean).join('\n\n')
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(extractedText))
    const extractedTextSha256 = [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, '0')).join('')
    if (loaded.model.paragraphs.length !== work.wordFallback.paragraphCount || extractedTextSha256 !== work.wordFallback.extractedTextSha256) throw new Error('published_word_fallback_mismatch')
    const pdfSource = work.sources.find(item => item.format === 'pdf'), pdfData = pairedPdfData
    const cover = pdfData ? await pdfFirstPageCover(pdfData).catch(() => undefined) : undefined
    return { ...common, sourceFormat: 'word', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', readerModel: loaded.model, readerPageCount: loaded.pages.length, extractedText,
      ...(pdfSource && pdfData ? { pdfData, pdfFileName: pdfSource.fileName, pdfStatus: 'ready' as const, pdfEngine: 'published-original-v1' } : {}),
      ...(cover ? { customCoverData: cover.data, customCoverMimeType: cover.mimeType } : {}) }
  }
  throw new Error('published_format_requires_reviewed_derivatives')
}

/** Catalogue entries have no source bytes until their reader is explicitly opened. */
export function publishedCatalogueEntry(work: PublishedWork): StoredBook {
  const source=work.sources.find(item=>item.role==='primary')??work.sources[0]!
  const mime={word:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',pdf:'application/pdf',epub:'application/epub+zip','shamela-bok':'application/octet-stream',markdown:'text/markdown',text:'text/plain'}
  return {id:work.id,title:work.title,author:work.author,fileName:source.fileName,
    fileSize:source.contentBytes??source.bytes,data:new Uint8Array(),originalSha256:source.sha256,
    addedAt:0,managedSource:'published',sourceFormat:source.format,mimeType:mime[source.format],pdfStatus:'pending',
    coverHue:deterministicCoverHue(work.title),coverTemplate:deterministicCoverTemplate(work.title),...work.metadata}
}

import {waitForBackgroundDataInteraction} from './background_data_scheduler'
export async function ensurePublishedLibrarySeeded(): Promise<{ installed: number; failed: number }> {
  let manifest: PublishedLibraryManifest
  try {
    const response = await fetch(MANIFEST_URL, { credentials: 'same-origin', cache: 'no-cache' })
    if (!response.ok) return { installed: 0, failed: 0 }
    manifest = await response.json() as PublishedLibraryManifest
  } catch { return { installed: 0, failed: 0 } }
  let installed = 0, failed = 0
  await waitForBackgroundDataInteraction()
  await retireManifestTestBooks(manifest)
  for (const work of activePublishedWorks(manifest)) {
    await waitForBackgroundDataInteraction()
    const existing = await getBook(work.id)
    // Never replace a downloaded copy or repeatedly rewrite a catalogue stub.
    // Verification and refreshing source bytes belong to the explicit reader path.
    if (existing) continue
    try { await restoreArchivedBook(publishedCatalogueEntry(work)); installed += 1 } catch { failed += 1 }
  }
  if (installed) window.dispatchEvent(new CustomEvent('library-changed'))
  return { installed, failed }
}

/** يضمن كتابًا منشورًا بعينه قبل فتح رابطه، بدل انتظار غرس المكتبة كلها. */
const pendingPublishedOpens=new Map<string,Promise<StoredBook|undefined>>()
export function ensurePublishedWorkSeeded(id:string,onPreview?:(book:StoredBook)=>void,requestedPageIndex=0):Promise<StoredBook|undefined>{
  const pending=pendingPublishedOpens.get(id);if(pending)return pending
  const task=loadPublishedWorkForOpen(id,onPreview,requestedPageIndex).finally(()=>{if(pendingPublishedOpens.get(id)===task)pendingPublishedOpens.delete(id)})
  pendingPublishedOpens.set(id,task);return task
}
async function loadPublishedWorkForOpen(id: string,onPreview?:(book:StoredBook)=>void,requestedPageIndex=0): Promise<StoredBook | undefined> {
  const existing = await getBook(id)
  if (/^(?:shamela-\d+|410\d+)$/u.test(id)) {
    return ensureShamelaBookReady(id,onPreview,requestedPageIndex)
  }
  let manifest: PublishedLibraryManifest
  try { manifest=await fetchPublishedManifestForReader(id) } catch(error) {
    if(error instanceof PublishedLibraryLoadError)throw error
    return existing
  }
  const work = activePublishedWorks(manifest).find(item => item.id === id)
  if (!work) return existing
  if (existing && !publishedBookNeedsRefresh(existing, work)) return existing
  return materializePublishedWorkForReader(work, existing)
}

/**
 * فتح الكتاب الموثق لا يتوقف على نجاح كتابة IndexedDB. قد تكون الحصة ممتلئة
 * أو تكون معاملة الغرس الأولى ما تزال متنافسة مع فتح القارئ؛ في الحالتين
 * تبقى البايتات التي اجتازت الحجم والبصمة أصلًا صالحًا للقراءة في الجلسة.
 */
export async function materializePublishedWorkForReader(
  work: PublishedWork,
  existing?: StoredBook,
  deps: {
    materialize?: (work: PublishedWork) => Promise<StoredBook>
    persist?: (book: StoredBook) => Promise<void>
    read?: (id: string) => Promise<StoredBook | undefined>
    notify?: () => void
  } = {},
): Promise<StoredBook | undefined> {
  const materialize = deps.materialize ?? materializePublishedWork
  const persist = deps.persist ?? restoreArchivedBook
  const read = deps.read ?? getBook
  const notify = deps.notify ?? (() => { if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('library-changed')) })
  let seeded: StoredBook
  try {
    seeded = await materialize(work)
  } catch (error) {
    console.warn('published_reader_materialization_failed', work.id, error)
    return existing
  }
  if (existing?.categoryOverride?.source === 'user') seeded.categoryOverride = existing.categoryOverride
  try {
    await persist(seeded)
    notify()
    return await read(work.id) ?? seeded
  } catch (error) {
    console.warn('published_reader_persistence_deferred', work.id, error)
    return seeded
  }
}


