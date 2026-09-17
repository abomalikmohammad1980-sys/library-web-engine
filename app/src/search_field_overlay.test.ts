import { expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'
import { loadSearchFieldOverlay } from './search_field_overlay'
const encode = (value: unknown) => JSON.stringify(value)
const sha = (text: string) => createHash('sha256').update(text).digest('hex')
function fixture() {
  const book = encode({ contract: 'khizana-search-field-book/1', bookId: '1', sourceIndexSha256: 'a'.repeat(64), sourceBookSha256: 'b'.repeat(64), segmentId: 'batch-0000-s0000', rows: [['1:0', 2, 5, 7]] })
  const manifest = { contract: 'khizana-search-field-overlay/1', activated: false, sourceIndexSha256: 'a'.repeat(64), policy: 'positions+death-2', normalizerSha256: '073c99b3103e2bca2e126286396f02dc5eaeb8729d62d0e1c7292bb282523a5e', coverageComplete: false, counts: { books: 1, documents: 1, positions: 7, segments: 1, expectedBooks: 2, expectedSegments: 2 }, books: [{ bookId: '1', file: 'books/1.json', byteLength: new TextEncoder().encode(book).length, sha256: sha(book), documents: 1, sourceBookSha256: 'b'.repeat(64), segmentId: 'batch-0000-s0000' }] }
  const root = encode(manifest), config = { manifestUrl: 'https://example.test/fields/manifest.json', manifestSha256: sha(root), sourceIndexSha256: 'a'.repeat(64), expectedBooks: 2, expectedSegments: 2 }
  return { manifest, config, fetcher: vi.fn<typeof fetch>(async input => new Response(String(input).endsWith('manifest.json') ? root : book)) }
}
it('loads only an explicitly pinned source release and retains partial coverage', async () => {
  const f = fixture(), overlay = await loadSearchFieldOverlay(f.config, f.fetcher)
  expect(overlay.coverageComplete).toBe(false); expect(await overlay.book('2')).toBeUndefined(); expect(f.fetcher).toHaveBeenCalledTimes(1)
  const book = await overlay.book('1'); expect(book?.phraseStarts('1:0', [[0, 3, 6]], 'body')).toEqual([3])
  await overlay.book('1'); expect(f.fetcher).toHaveBeenCalledTimes(2)
})
it('rejects a stale release pin or a false complete declaration', async () => {
  const f = fixture()
  await expect(loadSearchFieldOverlay({ ...f.config, sourceIndexSha256: 'c'.repeat(64) }, f.fetcher)).rejects.toThrow('search_field_overlay_identity')
  f.manifest.coverageComplete = true; const raw = encode(f.manifest)
  await expect(loadSearchFieldOverlay({ ...f.config, manifestSha256: sha(raw) }, vi.fn(async () => new Response(raw)))).rejects.toThrow('search_field_overlay_coverage')
})
it('corrupt book bytes fail closed and do not poison a later retry', async () => {
  const f = fixture(), overlay = await loadSearchFieldOverlay(f.config, f.fetcher)
  f.fetcher.mockImplementationOnce(async () => new Response('{}'))
  await expect(overlay.book('1')).rejects.toThrow('search_field_overlay_size')
  expect((await overlay.book('1'))?.has('1:0')).toBe(true)
})
