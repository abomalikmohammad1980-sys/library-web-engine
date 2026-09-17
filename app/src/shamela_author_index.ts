import {currentAuthorName} from './author_display_names'
const baselineNames=new WeakMap<ShamelaAuthorIndexEntry,string>()
export interface ShamelaAuthorBookRef { id: string; sourceBookId: string; title: string; batchId: string; category?: string }
export interface ShamelaAuthorIndexEntry {
  authorId: string
  id: string
  name: string
  deathYearHijri?: number
  contemporary?: boolean
  biography?: string
  biographyProvenance?: { provider: 'shamela.ws'; sourceUrl: string; policy: 'truncate-ui-boundary/1' }
  /** Derived while validating the lightweight index; never requires opening book payloads. */
  hasBooks?: boolean
  bookCount: number
  books: ShamelaAuthorBookRef[]
}
export interface ShamelaAuthorIndex { contract: 'shamela-author-metadata-index/1'; counts: { batches: number; books: number; authors: number }; categories: Array<{ name: string; count: number }>; authors: ShamelaAuthorIndexEntry[] }

let memory: Promise<ShamelaAuthorIndex> | undefined
export const SHAMELA_AUTHOR_INDEX_PATH = './data/shamela-author-index.json'
const SHAMELA_AUTHOR_INDEX_REVISION = '20260901-category-v1'

export function validateShamelaAuthorIndex(value: unknown): ShamelaAuthorIndex {
  if (!value || typeof value !== 'object') throw new Error('shamela_author_index_invalid')
  const payload = value as ShamelaAuthorIndex
  if (payload.contract !== 'shamela-author-metadata-index/1'
    || payload.counts.batches !== 86
    || payload.counts.books !== 8553
    || payload.counts.authors !== 3174
    || payload.authors.length !== 3174) throw new Error('shamela_author_index_invalid')
  const authorIds = new Set<string>()
  const bookIds = new Set<string>()
  let books = 0
  for (const author of payload.authors) {
    if (!author.id || !author.authorId || !author.name.trim() || author.name.trim() === '-' || author.bookCount < 1 || author.bookCount !== author.books.length || authorIds.has(author.id)) throw new Error('shamela_author_index_invalid')
    // UR-027: expose the ready-to-filter flag during the validation pass we
    // already perform. This avoids a second corpus scan and keeps warm loads
    // on the memoized lightweight object.
    author.hasBooks = true
    if (author.biography && (!author.biographyProvenance
      || author.biographyProvenance.provider !== 'shamela.ws'
      || author.biographyProvenance.policy !== 'truncate-ui-boundary/1'
      || !/^https:\/\/shamela\.ws\/author\/\d+\/?$/u.test(author.biographyProvenance.sourceUrl)
      || /&times;|×|البحث في:|تنبيهات هامة:|<[^>]+>|https?:\/\//iu.test(author.biography))) throw new Error('shamela_author_index_invalid')
    authorIds.add(author.id)
    books += author.bookCount
    for (const book of author.books) {
      if (!book.id || !book.sourceBookId || !book.title.trim() || !/^batch-\d{4}$/u.test(book.batchId) || bookIds.has(book.id)) throw new Error('shamela_author_index_invalid')
      bookIds.add(book.id)
    }
  }
  if (books !== 8553 || bookIds.size !== 8553) throw new Error('shamela_author_index_invalid')
  for(const author of payload.authors){const original=author.name;baselineNames.set(author,original);Object.defineProperty(author,'name',{enumerable:true,configurable:true,get:()=>currentAuthorName(`shamela:${author.authorId}`,currentAuthorName(author.id,original))})}
  return payload
}

export function loadShamelaAuthorIndex(): Promise<ShamelaAuthorIndex> {
  memory ??= (async () => {
    const attempt = async (url: string, cache: RequestCache): Promise<ShamelaAuthorIndex> => {
      const response = await fetch(url, { cache, headers: { Accept: 'application/json' } })
      if (!response.ok) throw new Error(`shamela_author_index_http_${response.status}`)
      const type = response.headers.get('content-type') ?? ''
      const text = await response.text()
      if (!type.toLowerCase().includes('json') || text.trimStart().startsWith('<')) throw new Error('shamela_author_index_non_json')
      try { return validateShamelaAuthorIndex(JSON.parse(text)) } catch (error) {
        if (error instanceof Error && error.message === 'shamela_author_index_invalid') throw error
        throw new Error('shamela_author_index_json_invalid')
      }
    }
    // البيانات الموثقة تتضمن الآن تصنيف كل كتاب لإصلاح manifests الحية
    // القديمة؛ ابدأ بالمسار المرقّم حتى لا يقبل المتصفح فهرسًا سليم البنية
    // لكنه بلا تصنيفات من Cache Storage.
    try { return await attempt(`${SHAMELA_AUTHOR_INDEX_PATH}?v=${SHAMELA_AUTHOR_INDEX_REVISION}`, 'reload') }
    catch { return attempt(SHAMELA_AUTHOR_INDEX_PATH, 'no-cache') }
  })().catch(error => { memory = undefined; throw error })
  return memory
}

const normalizeAuthorLookup = (value: string): string => value.normalize('NFKD')
  .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
  .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
  .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLocaleLowerCase('ar')

export function resolveShamelaAuthor(index: ShamelaAuthorIndex, routeValue: string): ShamelaAuthorIndexEntry | undefined {
  const decoded = routeValue.trim()
  const direct = index.authors.find(author => author.id === decoded || author.authorId === decoded)
  if (direct) return direct
  const normalized = normalizeAuthorLookup(decoded)
  return normalized ? index.authors.find(author => normalizeAuthorLookup(author.name) === normalized || normalizeAuthorLookup(baselineNames.get(author)??'') === normalized) : undefined
}

export function resetShamelaAuthorIndexForTests(): void { memory = undefined }
