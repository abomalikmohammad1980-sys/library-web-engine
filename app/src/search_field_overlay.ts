import { SearchFieldBoundaries, type SearchFieldBoundaryRow } from './search_field_boundaries'

type BookRef = { bookId: string; file: string; byteLength: number; sha256: string; documents: number; sourceBookSha256: string; segmentId: string }
type Overlay = { contract: string; sourceIndexSha256: string; policy: string; normalizerSha256: string; coverageComplete: boolean; counts: { books: number; documents: number; positions: number; segments: number; expectedBooks: number; expectedSegments: number }; books: BookRef[] }
const SHA = /^[a-f0-9]{64}$/u
const digest = async (bytes: Uint8Array) => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new Uint8Array(bytes).buffer))].map(x => x.toString(16).padStart(2, '0')).join('')
const validCount = (value: number) => Number.isSafeInteger(value) && value >= 0

async function verifiedJson(url: string, pin: string, cap: number, fetcher: typeof fetch, exactBytes?: number) {
  const response = await fetcher(url, { signal: AbortSignal.timeout(20000), redirect: 'error' })
  if (!response.ok || !response.body) throw Error('search_field_overlay_fetch')
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let length = 0
  try {
    for (;;) {
      const next = await reader.read(); if (next.done) break
      length += next.value.byteLength
      if (length > cap) { await reader.cancel(); throw Error('search_field_overlay_size') }
      chunks.push(next.value)
    }
  } finally { reader.releaseLock() }
  if (exactBytes !== undefined && length !== exactBytes) throw Error('search_field_overlay_size')
  const bytes = new Uint8Array(length); let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length }
  if (await digest(bytes) !== pin) throw Error('search_field_overlay_checksum')
  return JSON.parse(new TextDecoder().decode(bytes)) as unknown
}

/** Explicit candidate loader only. No global registration, automatic activation,
 * coverage inference from available files, or fallback to an unverified index.
 */
export async function loadSearchFieldOverlay(options: { manifestUrl: string; manifestSha256: string; sourceIndexSha256: string; expectedBooks: number; expectedSegments: number }, fetcher: typeof fetch = fetch) {
  const config = { ...options }, url = new URL(config.manifestUrl)
  if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.search || url.hash || !SHA.test(config.manifestSha256) || !SHA.test(config.sourceIndexSha256) || !validCount(config.expectedBooks) || !validCount(config.expectedSegments)) throw Error('search_field_overlay_config')
  const manifest = await verifiedJson(url.href, config.manifestSha256, 8 * 1024 ** 2, fetcher) as Overlay
  if (manifest.contract !== 'khizana-search-field-overlay/1' || manifest.sourceIndexSha256 !== config.sourceIndexSha256 || manifest.policy !== 'positions+death-2' || manifest.normalizerSha256 !== '073c99b3103e2bca2e126286396f02dc5eaeb8729d62d0e1c7292bb282523a5e' || typeof manifest.coverageComplete !== 'boolean' || !manifest.counts || !Array.isArray(manifest.books)) throw Error('search_field_overlay_identity')
  const counts = manifest.counts
  if ((['books', 'documents', 'positions', 'segments', 'expectedBooks', 'expectedSegments'] as const).some(key => !validCount(counts[key])) || counts.expectedBooks !== config.expectedBooks || counts.expectedSegments !== config.expectedSegments || counts.books !== manifest.books.length || counts.books > config.expectedBooks || counts.segments > config.expectedSegments || (manifest.coverageComplete && (counts.books !== config.expectedBooks || counts.segments !== config.expectedSegments))) throw Error('search_field_overlay_coverage')
  const refs = new Map<string, BookRef>(); let documents = 0
  for (const book of manifest.books) {
    if (!/^\d+$/u.test(book.bookId) || refs.has(book.bookId) || book.file !== `books/${book.bookId}.json` || !SHA.test(book.sha256) || !SHA.test(book.sourceBookSha256) || !validCount(book.documents) || !Number.isSafeInteger(book.byteLength) || book.byteLength < 1 || book.byteLength > 16 * 1024 ** 2 || !/^batch-\d{4}-s\d{4}$/u.test(book.segmentId)) throw Error('search_field_overlay_book')
    refs.set(book.bookId, { ...book }); documents += book.documents
  }
  if (documents !== counts.documents || new Set([...refs.values()].map(ref => ref.segmentId)).size !== counts.segments) throw Error('search_field_overlay_coverage')
  const pending = new Map<string, Promise<SearchFieldBoundaries>>(), cache = new Map<string, { value: SearchFieldBoundaries; bytes: number }>(); let cacheBytes = 0
  return {
    coverageComplete: manifest.coverageComplete,
    counts: Object.freeze({ ...counts }),
    coveredBookIds: Object.freeze([...refs.keys()]),
    async book(bookId: string): Promise<SearchFieldBoundaries | undefined> {
      const ref = refs.get(bookId); if (!ref) return undefined
      const saved = cache.get(bookId); if (saved) { cache.delete(bookId); cache.set(bookId, saved); return saved.value }
      const loading = pending.get(bookId); if (loading) return loading
      const task = (async () => {
        const body = await verifiedJson(new URL(ref.file, url).href, ref.sha256, ref.byteLength, fetcher, ref.byteLength) as { contract: string; bookId: string; sourceIndexSha256: string; sourceBookSha256: string; segmentId: string; rows: SearchFieldBoundaryRow[] }
        if (body.contract !== 'khizana-search-field-book/1' || body.bookId !== bookId || body.sourceIndexSha256 !== config.sourceIndexSha256 || body.sourceBookSha256 !== ref.sourceBookSha256 || body.segmentId !== ref.segmentId || !Array.isArray(body.rows) || body.rows.length !== ref.documents || body.rows.some(row => typeof row?.[0] !== 'string' || !row[0].startsWith(`${bookId}:`))) throw Error('search_field_overlay_book_identity')
        const value = new SearchFieldBoundaries(body.rows)
        if (ref.byteLength <= 8 * 1024 ** 2) {
          while (cache.size >= 4 || cacheBytes + ref.byteLength > 8 * 1024 ** 2) { const oldest = cache.keys().next().value!; cacheBytes -= cache.get(oldest)!.bytes; cache.delete(oldest) }
          cache.set(bookId, { value, bytes: ref.byteLength }); cacheBytes += ref.byteLength
        }
        return value
      })()
      pending.set(bookId, task)
      try { return await task } finally { if (pending.get(bookId) === task) pending.delete(bookId) }
    },
  }
}
