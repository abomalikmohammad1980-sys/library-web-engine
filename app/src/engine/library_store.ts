/** مخزّن الكتب الدائم — IndexedDB لحفظ ملفات docx مع بياناتها الوصفية */

import type { DocumentModelV0 } from '@engine/ooxml-model'
import { clearCachedReaderPageCount } from '../book_page_count'
import { CURRENT_CONVERSION_ARTIFACT_VERSION } from '../conversion_artifact_version'
import { createTrackedObjectURL, revokeTrackedObjectURL } from '../resource_lifecycle'
import type { BookFormat } from '../book_format'
import type { BookTag } from '../book_tags'
import type { PaginationAuthority } from '../word_import_authority'

const DB_NAME = 'library'
const DB_VERSION = 3
const STORE = 'books'
const AUTHORS_STORE = 'authors'

export interface StoredBook {
  id: string
  /** كتاب أصلي صادر مع الخِزانة؛ لا يملك المستخدم حذفَه أو تعديل بياناته. */
  managedSource?: 'published'
  /** صيغة المصدر؛ السجلات القديمة تُستنتج من الاسم/MIME. */
  sourceFormat?: BookFormat
  /** نص مشتق آمن للصيغ الحاوية مثل EPUB؛ الأصل يبقى في data. */
  extractedText?: string
  /** صفحات وفهرس BOK كما وردت في قاعدة الشاملة، مع الجزء والصفحة الأصليين. */
  bokPages?: Array<{ id: number; text: string; part: number; page: number }>
  bokToc?: Array<{ id: number; title: string; level: number; parent: number }>
  textToc?: Array<{ title: string; paragraphIndex: number; level: number; bookmark?: string }>
  /** أصول Markdown المحلية المشار إليها نسبيًا؛ لا تشمل ملفات المجلد غير المستخدمة. */
  markdownAssets?: MarkdownAsset[]
  bokTextVersion?: number
  title: string
  author: string
  authorId?: string
  /** جميع أصحاب التأليف؛ يبقى author/authorId ممثلَين للمؤلف الأول توافقًا مع السجلات القديمة. */
  authors?: BookAuthorRef[]
  deathYearHijri?: number
  contemporary?: boolean
  category?: string
  /** وسوم دقيقة اختيارية؛ تختلف عن التصنيف العام وتحفظ مصدر الاقتراح وموضعه إن توفر. */
  tags?: BookTag[]
  publisher?: string
  edition?: string
  investigator?: string
  publicationYearHijri?: number
  description?: string
  /** إحالة منشأ النص الموثقة؛ لا تُملأ بالتخمين. */
  sourceCitation?: string
  /** بطاقة المصدر الخام (مثل Betaka في الشاملة) للحفظ والتدقيق دون عرضها كوصف. */
  rawSourceMetadata?: string
  volumeCount?: number
  seriesName?: string
  seriesOrder?: number
  /** مسار الوسيط داخل word/media؛ لا نكرر بايتات الغلاف في IndexedDB. */
  coverMediaPath?: string
  /** لون الغلاف الافتراضي المثبت وقت الحفظ. */
  coverHue?: number
  customCoverData?: Uint8Array
  customCoverMimeType?: string
  coverTemplate?: number
  fileName: string
  fileSize: number
  addedAt: number
  data: Uint8Array
  /** الأصل المرفوع عندما تكون نسخة العرض DOCX مشتقة من DOC/RTF. */
  sourceData?: Uint8Array
  sourceMimeType?: string
  mimeType: string
  originalSha256: string
  pdfData?: Uint8Array
  pdfFileName?: string
  /** إصدار المحرك المحلي الذي أنشأ PDF؛ يمنع تقديم نسخة قديمة ناقصة الخطوط. */
  pdfEngine?: string
  pdfStatus: 'pending' | 'converting' | 'ready' | 'failed'
  pdfError?: string
  wordPageMap?: WordPageMap
  paginationAuthority?: PaginationAuthority | undefined
  paginationOverride?: { consentAt: number; sourceFingerprint: string; operationId: string } | undefined
  /** عدد فتحات الصفحات التي بناها القارئ فعليًا؛ مصدر عداد الواجهة بعد أول ترسيم كامل. */
  readerPageCount?: number
  /** عدد أوراق Word الفيزيائية؛ منفصل عن أكبر رقم مطبوع/adjusted. */
  physicalPageCount?: number
  conversionArtifactVersion?: string
  conversionArtifactAttemptVersion?: string
  conversionArtifactAttemptedAt?: number
  conversionArtifactFailedAt?: number
  /** أجزاء الكتاب عند توافرها؛ الصفحات أرقام PDF/فيزيائية تبدأ من 1. */
  parts?: BookPart[]
  /** ملفات Word للأجزاء حين يمثل السجل كتابًا واحدًا متعدد الأجزاء. */
  volumes?: BookVolume[]
  /** نموذج OOXML المفكوك؛ يُحفظ بعد أول فتح لتجنب فك ملف Word في كل زيارة. */
  readerModel?: DocumentModelV0
}

export interface BookAuthorRef { name: string; id?: string }
export interface MarkdownAsset { path: string; data: Uint8Array; mimeType: string }

/** سجل مؤلف مستقل قابل للربط بعدد غير محدود من الكتب والاستيراد من فهارس موثوقة. */
export interface StoredAuthor {
  id: string
  name: string
  canonicalName: string
  aliases: string[]
  shamelaId?: string
  sourceUrl?: string
  researchSources?: Array<{ url: string; accessedAt: string }>
  metadataConfidence?: 'high' | 'medium' | 'low' | 'review' | 'unresolved'
  researchStatus?: 'verified' | 'review' | 'unresolved'
  birthYearHijri?: number
  deathYearHijri?: number
  contemporary?: boolean
  biography?: string
  country?: string
  madhhab?: string
  teachers?: string[]
  students?: string[]
  works?: string[]
  shamelaBooks?: Array<{ id: string; title: string }>
  shamelaBookCount?: number
  imageData?: Uint8Array
  imageMimeType?: string
  createdAt: number
  updatedAt: number
}

export interface BookPart { number: number; title?: string; startPage: number; endPage: number; wordStartPage?: number }
export interface BookVolume { number: number; fileName: string; data: Uint8Array; mimeType: string; sourceData?: Uint8Array; sourceMimeType?: string; wordPageMap?: WordPageMap }

export interface WordPageStart {
  paragraphIndex: number
  physicalPage: number
  adjustedPage: number
}

export interface WordPageMap {
  totalPages: number
  paragraphCount: number
  starts: WordPageStart[]
  pages?: WordPageAudit[]
  paragraphs?: WordParagraphAudit[]
}

export interface WordParagraphAudit {
  paragraphIndex: number
  physicalPage: number
  adjustedPage: number
  text: string
}

export interface WordPageAudit {
  physicalPage: number
  adjustedPage: number
  firstParagraphIndex: number
  lastParagraphIndex: number
  firstText: string
  lastText: string
}

export function normalizeLegacyStoredBook(value: StoredBook): StoredBook {
  const data = value.data instanceof Uint8Array ? value.data : new Uint8Array(value.data ?? [])
  return { ...value, data, fileName: value.fileName || 'book.docx', mimeType: value.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', fileSize: Number.isFinite(value.fileSize) ? value.fileSize : data.byteLength, addedAt: Number.isFinite(value.addedAt) ? value.addedAt : 0, originalSha256: value.originalSha256 || '', pdfStatus: value.pdfStatus || (value.pdfData ? 'ready' : 'pending') }
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        store.createIndex('author', 'author', { unique: false })
        store.createIndex('title', 'title', { unique: false })
        store.createIndex('addedAt', 'addedAt', { unique: false })
      }
      if (!db.objectStoreNames.contains(AUTHORS_STORE)) {
        const authors = db.createObjectStore(AUTHORS_STORE, { keyPath: 'id' })
        authors.createIndex('canonicalName', 'canonicalName', { unique: true })
        authors.createIndex('shamelaId', 'shamelaId', { unique: false })
        authors.createIndex('deathYearHijri', 'deathYearHijri', { unique: false })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** حفظ كتاب في IndexedDB */
export interface BookIntakeFields { title: string; author: string; authorId?: string; authors?: BookAuthorRef[]; deathYearHijri?: number; contemporary?: boolean; category?: string; tags?: BookTag[]; publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number; description?: string; rawSourceMetadata?: string; volumeCount?: number; coverMediaPath?: string; coverHue?: number; coverTemplate?: number; customCoverData?: Uint8Array; customCoverMimeType?: string }

export async function saveBook(book: BookIntakeFields & {
  fileName: string; data: Uint8Array; mimeType?: string; sourceData?: Uint8Array; sourceMimeType?: string; volumes?: BookVolume[]; sourceFormat?: BookFormat; paginationAuthority?: PaginationAuthority; paginationOverride?: StoredBook['paginationOverride']; wordPageMap?: WordPageMap
}): Promise<string> {
  const db = await openDb()
  const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
  const entry: StoredBook = {
    id, ...book,
    mimeType: book.mimeType ?? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    originalSha256: await sha256Hex(book.data),
    pdfStatus: 'pending',
    fileSize: book.volumes?.reduce((sum, volume) => sum + (volume.sourceData?.length ?? volume.data.length), 0) ?? book.sourceData?.length ?? book.data.length,
    addedAt: Date.now(),
  }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    tx.objectStore(STORE).put(entry)
    tx.oncomplete = () => {
      const authors = book.authors?.length ? book.authors : [{ name: book.author, ...(book.authorId ? { id: book.authorId } : {}) }]
      void Promise.all(authors.map((author, index) => ensureAuthorRecord(author.name, {
        id: author.id,
        ...(index === 0 ? { deathYearHijri: book.deathYearHijri, contemporary: book.contemporary } : {}),
      })))
      resolve(id)
    }
    tx.onerror = () => reject(tx.error)
  })
}

/** يحفظ PDF كمصدر قراءة مستقل، لا كمشتق Word. */
export async function savePdfBook(book: BookIntakeFields & { fileName: string; data: Uint8Array }): Promise<string> {
  const id = await saveBook({ ...book, sourceFormat: 'pdf', mimeType: 'application/pdf' })
  await saveUploadedPdf(id, book.data, book.fileName)
  return id
}

/** يحفظ نص UTF-8 كمصدر مستقل قابل للقراءة والفهرسة. */
export async function saveTextBook(book: BookIntakeFields & { fileName: string; data: Uint8Array; toc?: NonNullable<StoredBook['textToc']>; sourceFormat?: 'text' | 'markdown'; markdownAssets?: MarkdownAsset[] }): Promise<string> {
  const id = await saveBook({ ...book, sourceFormat: book.sourceFormat ?? 'text', mimeType: book.sourceFormat === 'markdown' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8' })
  const toc = book.toc
  if (toc?.length || book.markdownAssets?.length) await updateBook(id, stored => { if (toc?.length) stored.textToc = toc; if (book.markdownAssets?.length) stored.markdownAssets = book.markdownAssets.map(asset => ({ ...asset, data: new Uint8Array(asset.data) })) })
  return id
}

export async function saveEpubBook(book: BookIntakeFields & { fileName: string; data: Uint8Array; extractedText: string; toc?: NonNullable<StoredBook['textToc']> }): Promise<string> {
  const id = await saveBook({ ...book, sourceFormat: 'epub', mimeType: 'application/epub+zip' })
  const toc = book.toc
  await updateBook(id, stored => { stored.extractedText = book.extractedText; if (toc?.length) stored.textToc = toc })
  return id
}

export async function saveBokBook(book: BookIntakeFields & { fileName: string; data: Uint8Array; extractedText: string; pages: NonNullable<StoredBook['bokPages']>; toc: NonNullable<StoredBook['bokToc']> }): Promise<string> {
  const id = await saveBook({ ...book, sourceFormat: 'shamela-bok', mimeType: 'application/x-shamela-bok' })
  await updateBook(id, stored => {
    stored.extractedText = book.extractedText
    stored.bokPages = book.pages
    stored.bokToc = book.toc
    stored.bokTextVersion = 3
    if (book.description) stored.description = book.description
  })
  return id
}

export async function replaceBookCover(id: string, cover?: { data: Uint8Array; mimeType: string }): Promise<void> {
  await updateBook(id, stored => {
    delete stored.coverMediaPath
    if (cover) {
      stored.customCoverData = new Uint8Array(cover.data)
      stored.customCoverMimeType = cover.mimeType
    } else {
      delete stored.customCoverData
      delete stored.customCoverMimeType
    }
  })
}

export async function updateBokDerivedText(id: string, derived: { extractedText: string; pages: NonNullable<StoredBook['bokPages']>; toc: NonNullable<StoredBook['bokToc']>; version: number }): Promise<void> {
  await updateBook(id, stored => {
    stored.extractedText = derived.extractedText
    stored.bokPages = derived.pages
    stored.bokToc = derived.toc
    stored.bokTextVersion = derived.version
  })
}

export async function setPdfConverting(id: string): Promise<void> {
  await updateBook(id, (book) => { book.pdfStatus = 'converting'; delete book.pdfError })
}

export async function saveBookPdf(id: string, data: Uint8Array, fileName: string, wordPageMap?: WordPageMap, pdfEngine?: string, parts?: BookPart[], volumeMaps?: Array<WordPageMap | undefined>): Promise<void> {
  await updateBook(id, (book) => {
    book.pdfData = data
    book.pdfFileName = fileName
    book.pdfStatus = 'ready'
    if (pdfEngine) book.pdfEngine = pdfEngine
    else delete book.pdfEngine
    if (wordPageMap) {
      book.wordPageMap = wordPageMap
      book.paginationAuthority = 'word-map'
      delete book.paginationOverride
      delete book.readerPageCount
      book.physicalPageCount = wordPageMap.totalPages
      clearCachedReaderPageCount(id)
    }
    if (parts) book.parts = parts
    if (volumeMaps && book.volumes) {
      book.volumes = book.volumes.map((volume, index) => ({ ...volume, ...(volumeMaps[index] ? { wordPageMap: volumeMaps[index] } : {}) }))
      if (volumeMaps.length === book.volumes.length && volumeMaps.every(map => map && map.totalPages > 0 && map.starts.length > 0)) {
        book.paginationAuthority = 'word-map'
        delete book.paginationOverride
        book.physicalPageCount = volumeMaps.reduce((sum, map) => sum + (map?.totalPages ?? 0), 0)
      }
    }
    book.conversionArtifactVersion = CURRENT_CONVERSION_ARTIFACT_VERSION
    book.conversionArtifactAttemptVersion = CURRENT_CONVERSION_ARTIFACT_VERSION
    delete book.conversionArtifactAttemptedAt
    delete book.conversionArtifactFailedAt
    delete book.pdfError
  })
}

/** إرفاق PDF جاهز اختاره المستخدم بدل التحويل الآلي، مع خريطة أجزاء اختيارية. */
export async function saveUploadedPdf(id: string, data: Uint8Array, fileName: string, parts?: BookPart[]): Promise<void> {
  await saveBookPdf(id, data, fileName, undefined, 'manual-upload-v1', parts)
}

/** تثبيت نموذج القراءة المفكوك في IndexedDB كي يبدأ الفتح التالي من الصفحة لا من ZIP/XML. */
export async function saveReaderModel(id: string, model: DocumentModelV0): Promise<void> {
  await updateBook(id, (book) => { book.readerModel = model })
}

/** يبطل مشتقات القارئ فقط ويحتفظ بملف Word وبيانات الكتاب وPDF الجاهز. */
export async function resetBookReaderArtifacts(id: string): Promise<void> {
  await updateBook(id, book => {
    delete book.readerModel
    delete book.wordPageMap
    delete book.readerPageCount
    delete book.physicalPageCount
  })
  clearCachedReaderPageCount(id)
}

export async function saveReaderPageCount(id: string, count: number): Promise<void> {
  if (!Number.isInteger(count) || count < 1) return
  await persistAndVerifyReaderPageCount(id, count,
    async (bookId, value) => updateBook(bookId, book => { book.readerPageCount = value; book.physicalPageCount = value }),
    getBook,
  )
}

export async function markConversionArtifactAttempt(id: string, version: string, attemptedAt: number): Promise<void> {
  await updateBook(id, book => { book.conversionArtifactAttemptVersion = version; book.conversionArtifactAttemptedAt = attemptedAt; delete book.conversionArtifactFailedAt })
}

export async function markConversionArtifactCurrent(id: string, version: string): Promise<StoredBook> {
  await updateBook(id, book => { book.conversionArtifactVersion = version; book.conversionArtifactAttemptVersion = version; delete book.conversionArtifactAttemptedAt; delete book.conversionArtifactFailedAt })
  const book = await getBook(id)
  if (!book) throw new Error('الكتاب غير موجود بعد تحديث المشتقات')
  return book
}

export async function markConversionArtifactFailure(id: string, version: string, failedAt: number): Promise<void> {
  await updateBook(id, book => { book.conversionArtifactAttemptVersion = version; book.conversionArtifactFailedAt = failedAt })
}

export async function persistAndVerifyReaderPageCount(
  id: string,
  count: number,
  write: (id: string, count: number) => Promise<void>,
  read: (id: string) => Promise<Pick<StoredBook, 'readerPageCount' | 'physicalPageCount'> | undefined>,
): Promise<void> {
  await write(id, count)
  const stored = await read(id)
  if (stored?.physicalPageCount !== count && stored?.readerPageCount !== count) throw new Error('تعذّر تثبيت عدد صفحات القارئ')
}

export async function setPdfFailed(id: string, error: string): Promise<void> {
  await updateBook(id, (book) => { book.pdfStatus = 'failed'; book.pdfError = error })
}

async function updateBook(id: string, mutate: (book: StoredBook) => void): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const req = store.get(id)
    req.onsuccess = () => {
      const book = req.result as StoredBook | undefined
      if (!book) { tx.abort(); reject(new Error('الكتاب غير موجود')); return }
      mutate(book)
      store.put(book)
    }
    req.onerror = () => reject(req.error)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export interface BookMetadataUpdate {
  title?: string
  author?: string
  deathYearHijri?: number
  contemporary?: boolean
  category?: string | null
  authorId?: string
  publisher?: string
  edition?: string
  investigator?: string
  publicationYearHijri?: number
  description?: string
  seriesName?: string
  seriesOrder?: number | null
}

export interface BookMetadataSnapshot {
  id: string
  author: string
  authorId?: string
  category?: string
  contemporary?: boolean
  deathYearHijri?: number
}

export function snapshotBookMetadata(book: StoredBook): BookMetadataSnapshot {
  return { id: book.id, author: book.author, ...(book.authorId === undefined ? {} : { authorId: book.authorId }), ...(book.category === undefined ? {} : { category: book.category }), ...(book.contemporary === undefined ? {} : { contemporary: book.contemporary }), ...(book.deathYearHijri === undefined ? {} : { deathYearHijri: book.deathYearHijri }) }
}

export function restoreBookMetadataSnapshot(book: StoredBook, snapshot: BookMetadataSnapshot): void {
  book.author = snapshot.author
  if (snapshot.authorId === undefined) delete book.authorId; else book.authorId = snapshot.authorId
  if (snapshot.category === undefined) delete book.category; else book.category = snapshot.category
  if (snapshot.contemporary === undefined) delete book.contemporary; else book.contemporary = snapshot.contemporary
  if (snapshot.deathYearHijri === undefined) delete book.deathYearHijri; else book.deathYearHijri = snapshot.deathYearHijri
}

export async function restoreBookMetadata(snapshot: BookMetadataSnapshot): Promise<void> {
  await updateBook(snapshot.id, book => restoreBookMetadataSnapshot(book, snapshot))
}

export async function updateBookMetadata(id: string, values: BookMetadataUpdate): Promise<void> {
  if ((await getBook(id))?.managedSource === 'published') throw new Error('لا يمكن تعديل بيانات كتاب صادر مع الخِزانة')
  await updateBook(id, (book) => {
    if (values.title?.trim()) book.title = values.title.trim()
    if (values.author?.trim()) book.author = values.author.trim()
    if (values.authorId !== undefined) book.authorId = values.authorId
    if (values.category === null) delete book.category
    else if (values.category?.trim()) book.category = values.category.trim()
    if (values.publisher !== undefined) book.publisher = values.publisher.trim()
    if (values.edition !== undefined) book.edition = values.edition.trim()
    if (values.investigator !== undefined) book.investigator = values.investigator.trim()
    if (values.publicationYearHijri !== undefined) book.publicationYearHijri = values.publicationYearHijri
    if (values.description !== undefined) book.description = values.description.trim()
    if (values.seriesName !== undefined) { const name = values.seriesName.trim(); if (name) book.seriesName = name; else delete book.seriesName }
    if (values.seriesOrder === null) delete book.seriesOrder
    else if (values.seriesOrder !== undefined) book.seriesOrder = Math.max(1, Math.round(values.seriesOrder))
    if (values.contemporary !== undefined) book.contemporary = values.contemporary
    if (values.contemporary) delete book.deathYearHijri
    else if (values.deathYearHijri !== undefined) book.deathYearHijri = values.deathYearHijri
  })
  if (values.author?.trim()) await ensureAuthorRecord(values.author, { id: values.authorId, deathYearHijri: values.deathYearHijri, contemporary: values.contemporary })
}

/** يستبدل أصل Word مع إبقاء هوية الكتاب وبياناته الإدارية. لا نثبت البديل إلا
 * بعد أن يجهزه المستدعي كـDOCX صالح؛ وكل مشتق قديم يُبطل كي لا يختلط إصداران. */
export async function replaceBookWord(id: string, replacement: {
  fileName: string; data: Uint8Array; mimeType: string; sourceData?: Uint8Array; sourceMimeType?: string;
  coverMediaPath?: string; coverHue?: number;
}): Promise<void> {
  const hash = await sha256Hex(replacement.data)
  await updateBook(id, (book) => applyBookWordReplacement(book, replacement, hash))
  clearCachedReaderPageCount(id)
}

export function applyBookWordReplacement(book: StoredBook, replacement: {
  fileName: string; data: Uint8Array; mimeType: string; sourceData?: Uint8Array; sourceMimeType?: string;
  coverMediaPath?: string; coverHue?: number;
}, hash: string): void {
    book.fileName = replacement.fileName
    book.data = replacement.data
    book.mimeType = replacement.mimeType
    book.originalSha256 = hash
    book.fileSize = replacement.sourceData?.length ?? replacement.data.length
    if (replacement.sourceData) book.sourceData = replacement.sourceData
    else delete book.sourceData
    if (replacement.sourceMimeType) book.sourceMimeType = replacement.sourceMimeType
    else delete book.sourceMimeType
    if (replacement.coverMediaPath) book.coverMediaPath = replacement.coverMediaPath
    else delete book.coverMediaPath
    if (replacement.coverHue !== undefined) book.coverHue = replacement.coverHue
    delete book.pdfData; delete book.pdfFileName; delete book.pdfEngine; delete book.pdfError
    delete book.wordPageMap; delete book.readerModel; delete book.readerPageCount; delete book.physicalPageCount; delete book.parts; delete book.volumes
    delete book.conversionArtifactVersion; delete book.conversionArtifactAttemptVersion; delete book.conversionArtifactAttemptedAt; delete book.conversionArtifactFailedAt
    book.pdfStatus = 'pending'
}

export async function sha256Hex(data: Uint8Array): Promise<string> {
  const copy = new Uint8Array(data)
  const digest = await crypto.subtle.digest('SHA-256', copy.buffer)
  return [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, '0')).join('')
}

export function downloadBytes(data: Uint8Array, fileName: string, mimeType: string): void {
  const blob = new Blob([new Uint8Array(data)], { type: mimeType })
  const url = createTrackedObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => revokeTrackedObjectURL(url), 0)
}

/** جلب كل الكتب */
export async function listBooks(): Promise<StoredBook[]> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).getAll()
    req.onsuccess = () => resolve((req.result as StoredBook[]).map(normalizeLegacyStoredBook))
    req.onerror = () => reject(req.error)
  })
}

/** جلب كتاب بمعرّفه */
export async function getBook(id: string): Promise<StoredBook | undefined> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly')
    const req = tx.objectStore(STORE).get(id)
    req.onsuccess = () => resolve(req.result ? normalizeLegacyStoredBook(req.result as StoredBook) : undefined)
    req.onerror = () => reject(req.error)
  })
}

/** حذف كتاب */
export async function deleteBook(id: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    const request = store.get(id)
    request.onsuccess = () => {
      const book = request.result as StoredBook | undefined
      if (book?.managedSource === 'published') { tx.abort(); reject(new Error('لا يمكن حذف كتاب صادر مع الخِزانة')); return }
      store.delete(id)
    }
    request.onerror = () => { tx.abort(); reject(request.error) }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** يستعيد سجل أرشيف مكتبة مكتمل في معاملة كتاب واحدة؛ المستدعي يتحقق من manifest والبصمة قبل الكتابة. */
export async function restoreArchivedBook(book: StoredBook): Promise<void> {
  const db = await openDb()
  await new Promise<void>((resolve, reject) => { const tx = db.transaction(STORE, 'readwrite'); tx.objectStore(STORE).put(book); tx.oncomplete = () => resolve(); tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error ?? new Error('أُلغيت معاملة استعادة الكتاب')) })
  void ensureAuthorRecord(book.author, { id: book.authorId, deathYearHijri: book.deathYearHijri, contemporary: book.contemporary })
  clearCachedReaderPageCount(book.id)
}

/** جلب جميع المؤلفين الفريدين */
export async function listAuthors(): Promise<string[]> {
  return (await listAuthorRecords()).map(author => author.name)
}

export function canonicalAuthorName(name: string): string {
  return name.trim().replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').toLocaleLowerCase('ar')
}

function authorIdFromName(name: string): string {
  let hash = 2166136261
  for (const char of canonicalAuthorName(name)) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) }
  return `author-${(hash >>> 0).toString(36)}`
}

export async function saveAuthor(author: Omit<StoredAuthor, 'id' | 'canonicalName' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
  const db = await openDb()
  const canonicalName = canonicalAuthorName(author.name)
  const existing = (await listAuthorRecords(false)).find(item => item.canonicalName === canonicalName || (author.shamelaId && item.shamelaId === author.shamelaId))
  const now = Date.now()
  const entry: StoredAuthor = { ...existing, ...author, id: author.id || existing?.id || authorIdFromName(author.name), canonicalName, aliases: [...new Set([...(existing?.aliases ?? []), ...(author.aliases ?? [])])], createdAt: existing?.createdAt ?? now, updatedAt: now }
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUTHORS_STORE, 'readwrite')
    tx.objectStore(AUTHORS_STORE).put(entry)
    tx.oncomplete = () => resolve(entry.id)
    tx.onerror = () => reject(tx.error)
  })
}

export interface AuthorCatalogRecord {
  id?: string
  name: string
  aliases?: string[]
  shamelaId?: string
  sourceUrl?: string
  researchSources?: Array<{ url: string; accessedAt: string }>
  metadataConfidence?: 'high' | 'medium' | 'low' | 'review' | 'unresolved'
  researchStatus?: 'verified' | 'review' | 'unresolved'
  birthYearHijri?: number
  deathYearHijri?: number
  contemporary?: boolean
  biography?: string
  country?: string
  madhhab?: string
  teachers?: string[]
  students?: string[]
  works?: string[]
  shamelaBooks?: Array<{ id: string; title: string }>
  shamelaBookCount?: number
}

/** استيراد كتالوج كبير في معاملة واحدة مع الدمج بالاسم المعياري أو معرف الشاملة. */
export async function importAuthorCatalog(input: AuthorCatalogRecord[]): Promise<{ imported: number; merged: number; rejected: number }> {
  const valid = input.filter(record => typeof record?.name === 'string' && record.name.trim().length >= 2)
  const rejected = input.length - valid.length
  const existing = await listAuthorRecords(false)
  const byCanonical = new Map(existing.map(author => [author.canonicalName, author]))
  const byShamela = new Map(existing.filter(author => author.shamelaId).map(author => [author.shamelaId!, author]))
  const now = Date.now()
  let imported = 0
  let merged = 0
  const pending = new Map<string, StoredAuthor>()
  for (const source of valid) {
    const name = source.name.trim()
    const canonicalName = canonicalAuthorName(name)
    const previous = pending.get(canonicalName) ?? byCanonical.get(canonicalName) ?? (source.shamelaId ? byShamela.get(String(source.shamelaId)) : undefined)
    const entry: StoredAuthor = {
      ...(previous ?? {} as StoredAuthor),
      id: previous?.id ?? source.id ?? authorIdFromName(name),
      name,
      canonicalName,
      aliases: [...new Set([...(previous?.aliases ?? []), ...(source.aliases ?? [])].map(value => value.trim()).filter(Boolean))],
      createdAt: previous?.createdAt ?? now,
      updatedAt: now,
      ...(source.shamelaId ? { shamelaId: String(source.shamelaId) } : {}),
      ...(source.sourceUrl ? { sourceUrl: source.sourceUrl } : {}),
      ...(source.researchSources ? { researchSources: source.researchSources } : {}),
      ...(source.metadataConfidence ? { metadataConfidence: source.metadataConfidence } : {}),
      ...(source.researchStatus ? { researchStatus: source.researchStatus } : {}),
      ...(source.birthYearHijri !== undefined ? { birthYearHijri: source.birthYearHijri } : {}),
      ...(source.deathYearHijri !== undefined ? { deathYearHijri: source.deathYearHijri } : {}),
      ...(source.contemporary !== undefined ? { contemporary: source.contemporary } : {}),
      ...(source.biography ? { biography: source.biography } : {}),
      ...(source.country ? { country: source.country } : {}),
      ...(source.madhhab ? { madhhab: source.madhhab } : {}),
      ...(source.teachers ? { teachers: source.teachers } : {}),
      ...(source.students ? { students: source.students } : {}),
      ...(source.works ? { works: source.works } : {}),
      ...(source.shamelaBooks ? { shamelaBooks: source.shamelaBooks } : {}),
      ...(source.shamelaBookCount !== undefined ? { shamelaBookCount: source.shamelaBookCount } : {}),
    }
    pending.set(canonicalName, entry)
    if (previous) merged++; else imported++
  }
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(AUTHORS_STORE, 'readwrite')
    const store = tx.objectStore(AUTHORS_STORE)
    for (const author of pending.values()) store.put(author)
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
  return { imported, merged, rejected }
}

type AuthorUpdate = Partial<Omit<StoredAuthor, 'id' | 'canonicalName' | 'createdAt' | 'updatedAt' | 'imageData' | 'imageMimeType'>> & {
  imageData?: Uint8Array | null
  imageMimeType?: string | null
}

export async function updateAuthor(id: string, values: AuthorUpdate): Promise<void> {
  const current = await getAuthorRecord(id)
  if (!current) throw new Error('المؤلف غير موجود')
  const next: StoredAuthor = { ...current, ...values, id: current.id, name: values.name?.trim() || current.name, aliases: values.aliases ?? current.aliases } as StoredAuthor
  if (values.imageData === null) delete next.imageData
  if (values.imageMimeType === null) delete next.imageMimeType
  await saveAuthor(next)
}

/** يبني السجل النهائي عند دمج مؤلف مكرر، مع إبقاء هوية السجل الأساس. */
export function mergeAuthorRecords(primary: StoredAuthor, duplicate: StoredAuthor, now = Date.now()): StoredAuthor {
  const prefer = <T>(first: T | undefined, second: T | undefined): T | undefined => first ?? second
  const merged: StoredAuthor = {
    ...duplicate,
    ...primary,
    id: primary.id,
    name: primary.name,
    canonicalName: primary.canonicalName,
    aliases: [...new Set([
      ...primary.aliases,
      duplicate.name,
      ...duplicate.aliases,
    ].map(value => value.trim()).filter(value => value && canonicalAuthorName(value) !== primary.canonicalName))],
    teachers: [...new Set([...(primary.teachers ?? []), ...(duplicate.teachers ?? [])])],
    students: [...new Set([...(primary.students ?? []), ...(duplicate.students ?? [])])],
    works: [...new Set([...(primary.works ?? []), ...(duplicate.works ?? [])])],
    shamelaBooks: [...new Map([...(primary.shamelaBooks ?? []), ...(duplicate.shamelaBooks ?? [])].map(book => [book.id, book])).values()],
    createdAt: Math.min(primary.createdAt, duplicate.createdAt),
    updatedAt: now,
  }
  const copyPreferred = <K extends keyof StoredAuthor>(key: K): void => {
    const value = prefer(primary[key], duplicate[key])
    if (value !== undefined) Object.assign(merged, { [key]: value })
  }
  for (const key of ['shamelaId', 'sourceUrl', 'birthYearHijri', 'deathYearHijri', 'contemporary', 'biography', 'country', 'madhhab', 'imageData', 'imageMimeType'] as const) copyPreferred(key)
  const bookCount = Math.max(primary.shamelaBookCount ?? 0, duplicate.shamelaBookCount ?? 0)
  if (bookCount) merged.shamelaBookCount = bookCount
  return merged
}

/** يدمج سجلين وينقل الكتب المرتبطة بالمكرر إلى السجل الأساس في معاملة واحدة. */
export async function mergeAuthors(primaryId: string, duplicateId: string): Promise<void> {
  if (primaryId === duplicateId) throw new Error('اختر مؤلفين مختلفين للدمج')
  const [primary, duplicate, books] = await Promise.all([getAuthorRecord(primaryId), getAuthorRecord(duplicateId), listBooks()])
  if (!primary || !duplicate) throw new Error('تعذّر العثور على أحد سجلي المؤلفين')
  const merged = mergeAuthorRecords(primary, duplicate)
  const db = await openDb()
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction([AUTHORS_STORE, STORE], 'readwrite')
    const authorStore = tx.objectStore(AUTHORS_STORE)
    const bookStore = tx.objectStore(STORE)
    authorStore.put(merged)
    authorStore.delete(duplicate.id)
    for (const book of books) {
      if (book.authorId !== duplicate.id && canonicalAuthorName(book.author) !== duplicate.canonicalName) continue
      bookStore.put({
        ...book,
        authorId: primary.id,
        author: primary.name,
        ...(merged.deathYearHijri !== undefined ? { deathYearHijri: merged.deathYearHijri } : {}),
        ...(merged.contemporary !== undefined ? { contemporary: merged.contemporary } : {}),
      })
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

export async function ensureAuthorRecord(name: string, seed: { id?: string | undefined; deathYearHijri?: number | undefined; contemporary?: boolean | undefined } = {}): Promise<string | undefined> {
  if (!name.trim()) return undefined
  return saveAuthor({
    name: name.trim(), aliases: [],
    ...(seed.id ? { id: seed.id } : {}),
    ...(seed.deathYearHijri !== undefined ? { deathYearHijri: seed.deathYearHijri } : {}),
    ...(seed.contemporary !== undefined ? { contemporary: seed.contemporary } : {}),
  })
}

export async function listAuthorRecords(syncBooks = true): Promise<StoredAuthor[]> {
  const db = await openDb()
  const records = await new Promise<StoredAuthor[]>((resolve, reject) => {
    const tx = db.transaction(AUTHORS_STORE, 'readonly')
    const req = tx.objectStore(AUTHORS_STORE).getAll()
    req.onsuccess = () => resolve(req.result as StoredAuthor[])
    req.onerror = () => reject(req.error)
  })
  if (syncBooks) {
    const books = await listBooks()
    const known = new Set(records.map(item => item.canonicalName))
    const missing = new Map<string, StoredBook>()
    for (const book of books) if (book.author?.trim() && !known.has(canonicalAuthorName(book.author))) missing.set(canonicalAuthorName(book.author), book)
    if (missing.size) {
      await Promise.all([...missing.values()].map(book => ensureAuthorRecord(book.author, { id: book.authorId, deathYearHijri: book.deathYearHijri, contemporary: book.contemporary })))
      return listAuthorRecords(false)
    }
  }
  return records.sort((a, b) => (a.deathYearHijri ?? Number.MAX_SAFE_INTEGER) - (b.deathYearHijri ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, 'ar'))
}

export async function getAuthorRecord(idOrName: string): Promise<StoredAuthor | undefined> {
  const records = await listAuthorRecords()
  const canonical = canonicalAuthorName(idOrName)
  return records.find(author => author.id === idOrName || author.canonicalName === canonical || author.aliases.some(alias => canonicalAuthorName(alias) === canonical))
}

/** الكتب حسب المؤلف */
export async function booksByAuthor(author: string): Promise<StoredBook[]> {
  const all = await listBooks()
  return all.filter((b) => b.author === author).sort((a, b) => b.addedAt - a.addedAt)
}
