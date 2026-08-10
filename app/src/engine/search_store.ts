/** فهرس النص الكامل للكتب — بحث في كل الكتب المحفوظة */

import { extractFromDocx } from '@engine/ooxml-model'
import { listAuthorRecords, listBooks, type StoredBook } from './library_store'
import { inferBookFormat } from '../book_format'
import { decodeUtf8Text, textParagraphs } from '../text_import'
import { searchAuthorChronology } from '../search_author_metadata'
import { createSearchYieldScheduler } from './search_yield'

interface IndexedParagraph { index: number; text: string }
const paragraphCache = new Map<string, IndexedParagraph[]>()
const persistentLoads = new Map<string, Promise<IndexedParagraph[]>>()
const SEARCH_DB = 'alkhizana-search-index'
const SEARCH_STORE = 'paragraphs'
const SEARCH_VERSION = 1
interface PersistentIndexEntry { key: string; bookId: string; fingerprint: string; paragraphs: IndexedParagraph[]; updatedAt: number }
let searchDbPromise: Promise<IDBDatabase> | undefined

export interface SearchResult {
  bookId: string
  title: string
  author: string
  authors: string[]
  category?: string
  deathYearHijri?: number
  contemporary?: boolean
  tags: string[]
  /** رقم الفقرة المطابقة (0-based) */
  paraIndex: number
  /** النص المحيط (مع سياق) */
  snippet: string
  /** النص الكامل للفقرة */
  matchText: string
  /** الحقل الذي أنتج المطابقة. */
  field: SearchField
}

export type SearchField = 'body' | 'heading' | 'tag' | 'card'

export interface SearchQueryOptions {
  bookIds?: string[]
  authors?: string[]
  categories?: string[]
  deathFrom?: number
  deathTo?: number
  deathState?: 'pre-hijra' | 'contemporary'
  fields?: SearchField[]
}

/** بحث في كل الكتب. يُرجع النتائج مرتبة حسب الملاءمة. */
export async function searchAllBooks(query: string, options: SearchQueryOptions = {}): Promise<SearchResult[]> {
  const q = query.trim()
  if (!q || q.length < 2) return []
  const normalizedQuery = normalize(q)

  const fields = new Set<SearchField>(options.fields ?? ['body', 'heading', 'tag', 'card'])
  const [allBooks, authorRecords] = await Promise.all([listBooks(), listAuthorRecords(false)])
  const books = allBooks.filter(book => {
    const authors = book.authors?.length ? book.authors.map(author => author.name) : [book.author]
    if (options.bookIds?.length && !options.bookIds.includes(book.id)) return false
    if (options.authors?.length && !options.authors.some(author => authors.includes(author))) return false
    if (options.categories?.length && (!book.category || !options.categories.includes(book.category))) return false
    if (options.deathState === 'contemporary' && !book.contemporary) return false
    if (options.deathState === 'pre-hijra' && (book.contemporary || (book.deathYearHijri ?? 0) >= 1)) return false
    if (options.deathFrom && (book.contemporary || (book.deathYearHijri ?? 0) < options.deathFrom)) return false
    if (options.deathTo && (book.contemporary || (book.deathYearHijri ?? Number.POSITIVE_INFINITY) > options.deathTo)) return false
    return true
  })
  void cleanRemovedBookIndexes(new Set(allBooks.map(book => book.id)))
  const results: SearchResult[] = []
  const scheduler = createSearchYieldScheduler()

  for (const book of books) {
    // نحافظ على استجابة الواجهة بميزانية زمنية، لا بمؤقت لكل كتاب. المؤقت لكل
    // كتاب كان يضيف حدًا أدنى ضخمًا للزمن عند فهرسة كتالوج الشاملة كاملًا.
    await scheduler.checkpoint()
    const authors = book.authors?.length ? book.authors.map(author => author.name) : [book.author]
    const tags = book.tags?.map(tag => tag.name) ?? []
    const headings = book.tags?.filter(tag => tag.source === 'toc').map(tag => tag.name) ?? []
    const manualTags = book.tags?.filter(tag => tag.source === 'manual').map(tag => tag.name) ?? []
    const chronology = searchAuthorChronology(book, authorRecords)
    const metadata = { authors, tags, ...(book.category ? { category: book.category } : {}), ...chronology }
    const cardText = [book.description, book.publisher, book.investigator, book.edition, book.publicationYearHijri, book.rawSourceMetadata].filter(Boolean).join(' ')
    const metadataFields: Array<[SearchField, string]> = [['heading', headings.join(' ')], ['tag', manualTags.join(' ')], ['card', cardText]]
    for (const [field, value] of metadataFields) {
      if (field === 'heading' && fields.has('body')) continue
      if (!fields.has(field) || !value || !normalize(value).includes(normalizedQuery)) continue
      results.push({ bookId: book.id, title: book.title, author: book.author, ...metadata, paraIndex: -1, snippet: `${book.title} — ${authors.join('، ')}${tags.length ? ` · ${tags.map(tag => `#${tag}`).join(' ')}` : ''}`, matchText: value, field })
    }
    if (!fields.has('body')) continue
    for (const p of await persistentIndexedParagraphs(book)) {
      const idx = normalize(p.text).indexOf(normalizedQuery)
      if (idx === -1) continue

      // سياق: 40 حرفًا قبل وبعد
      const start = Math.max(0, idx - 40)
      const end = Math.min(p.text.length, idx + normalizedQuery.length + 40)
      const snippet = (start > 0 ? '…' : '') + p.text.slice(start, end) + (end < p.text.length ? '…' : '')

      results.push({
        bookId: book.id,
        title: book.title,
        author: book.author,
        ...metadata,
        paraIndex: p.index,
        snippet,
        matchText: p.text,
        field: 'body',
      })
    }
  }

  // ترتيب: الكتب التي تطابق أكثر في المقدمة
  results.sort((a, b) => {
    const aCount = a.matchText.split(q).length - 1
    const bCount = b.matchText.split(q).length - 1
    return bCount - aCount
  })

  return results
}

export async function persistentIndexedParagraphs(book: StoredBook): Promise<IndexedParagraph[]> {
  const fingerprint = book.originalSha256 || `${book.id}:${book.fileSize}`
  const key = `${book.id}:${fingerprint}`
  const memory = paragraphCache.get(fingerprint)
  if (memory) return memory
  const active = persistentLoads.get(key)
  if (active) return active
  const load = (async () => {
    if (typeof indexedDB === 'undefined') return indexedParagraphs(book)
    try {
      const db = await openSearchDb()
      const stored = await idbRequest<PersistentIndexEntry | undefined>(db.transaction(SEARCH_STORE, 'readonly').objectStore(SEARCH_STORE).get(key))
      if (stored?.fingerprint === fingerprint && Array.isArray(stored.paragraphs)) {
        paragraphCache.set(fingerprint, stored.paragraphs)
        return stored.paragraphs
      }
      const paragraphs = indexedParagraphs(book)
      await writePersistentIndex(db, { key, bookId: book.id, fingerprint, paragraphs, updatedAt: Date.now() })
      return paragraphs
    } catch {
      // امتلاء التخزين أو منع IndexedDB لا يعطل البحث؛ يبقى كاش الجلسة صالحًا.
      return indexedParagraphs(book)
    }
  })().finally(() => persistentLoads.delete(key))
  persistentLoads.set(key, load)
  return load
}

function openSearchDb(): Promise<IDBDatabase> {
  searchDbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(SEARCH_DB, SEARCH_VERSION)
    request.onupgradeneeded = () => {
      if (request.result.objectStoreNames.contains(SEARCH_STORE)) return
      const store = request.result.createObjectStore(SEARCH_STORE, { keyPath: 'key' })
      store.createIndex('bookId', 'bookId', { unique: false })
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  return searchDbPromise
}

function idbRequest<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
}

function writePersistentIndex(db: IDBDatabase, entry: PersistentIndexEntry): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SEARCH_STORE, 'readwrite')
    const store = tx.objectStore(SEARCH_STORE)
    store.put(entry)
    const cursor = store.index('bookId').openCursor(IDBKeyRange.only(entry.bookId))
    cursor.onsuccess = () => {
      const value = cursor.result
      if (!value) return
      if (value.primaryKey !== entry.key) value.delete()
      value.continue()
    }
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

let cleanedPersistentIndex = false
async function cleanRemovedBookIndexes(activeBookIds: Set<string>): Promise<void> {
  if (cleanedPersistentIndex || typeof indexedDB === 'undefined') return
  cleanedPersistentIndex = true
  try {
    const db = await openSearchDb()
    const tx = db.transaction(SEARCH_STORE, 'readwrite')
    const cursor = tx.objectStore(SEARCH_STORE).openCursor()
    cursor.onsuccess = () => { const value = cursor.result; if (!value) return; if (!activeBookIds.has((value.value as PersistentIndexEntry).bookId)) value.delete(); value.continue() }
  } catch { /* التنظيف تحسيني ولا يمنع البحث. */ }
}

export function indexedParagraphs(book: StoredBook): IndexedParagraph[] {
  const key = book.originalSha256 || `${book.id}:${book.fileSize}`
  const cached = paragraphCache.get(key)
  if (cached) return cached
  const format = inferBookFormat(book)
  const paragraphs = format === 'text' || format === 'markdown'
    ? textParagraphs(decodeUtf8Text(book.data)).map((text, index) => ({ index, text }))
    : format === 'epub' || format === 'shamela-bok'
      ? textParagraphs(book.extractedText ?? '').map((text, index) => ({ index, text }))
    : format === 'pdf'
      ? []
      : extractFromDocx(book.data).paragraphs
        .filter((paragraph) => !paragraph.excluded && Boolean(paragraph.text))
        .map((paragraph) => ({ index: paragraph.index, text: paragraph.text }))
  paragraphCache.set(key, paragraphs)
  return paragraphs
}

function normalize(value: string): string {
  // هذه نسخةٌ للفهرسة فقط؛ لا تُكتب مطلقًا فوق نص Word الأصلي المعروض.
  return value.toLocaleLowerCase('ar')
    .replace(/[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
}
