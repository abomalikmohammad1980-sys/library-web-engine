import { strToU8, zipSync } from 'fflate'
import { describe, expect, it, vi } from 'vitest'
import type { ShamelaOfficialRelease } from './shamela-official-release.js'
import {
  fetchVerifiedShamelaEntry, isInitialShamelaDatabaseEntry,
  readShamelaZipDirectory, selectInitialShamelaDatabaseEntries,
} from './shamela-sparse-zip.js'

function fixtureArchive(): Uint8Array {
  return zipSync({
    database: {
      book: { '1.db': strToU8('book-one') },
      'master.db': strToU8('master'),
      lucene: { '_0.cfs': strToU8('large-index-placeholder') },
    },
    cover: { '1.jpg': strToU8('cover-placeholder') },
  }, { level: 6 })
}

function fixtureSource(bytes: Uint8Array): ShamelaOfficialRelease {
  return {
    sourceId: 'shamela-official-database', version: '1448.2',
    archiveUrl: 'https://dev.shamela.ws/downloads/fixture.zip', contentLength: bytes.length,
    etag: '"feed-1234"', lastModified: 'Thu, 30 Jul 2026 19:07:08 GMT',
    acceptsByteRanges: true, observedAt: '2026-08-10T13:47:12Z',
  }
}

function rangedFetcher(bytes: Uint8Array, source: ShamelaOfficialRelease): typeof fetch {
  return vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const match = /^bytes=(\d+)-(\d+)$/.exec(new Headers(init?.headers).get('range') ?? '')
    if (!match) return new Response(null, { status: 416 })
    const start = Number(match[1]); const end = Number(match[2])
    return new Response(bytes.slice(start, end + 1), { status: 206, headers: {
      'content-range': `bytes ${start}-${end}/${bytes.length}`,
      etag: source.etag, 'last-modified': source.lastModified, 'accept-ranges': 'bytes',
    } })
  }) as typeof fetch
}

describe('sparse Shamela ZIP extraction', () => {
  it('reads only the central directory first and selects book/master databases', async () => {
    const archive = fixtureArchive(); const source = fixtureSource(archive)
    const { directory, entries } = await readShamelaZipDirectory(source, rangedFetcher(archive, source), archive.length)
    expect(directory.zip64).toBe(false)
    expect(entries.map(entry => entry.path)).toEqual([
      'database/book/1.db', 'database/master.db', 'database/lucene/_0.cfs', 'cover/1.jpg',
    ])
    expect(selectInitialShamelaDatabaseEntries(entries).map(entry => entry.path))
      .toEqual(['database/book/1.db', 'database/master.db'])
  })

  it('range-fetches one selected DB and verifies decompressed size and CRC', async () => {
    const archive = fixtureArchive(); const source = fixtureSource(archive)
    const fetcher = rangedFetcher(archive, source)
    const { entries } = await readShamelaZipDirectory(source, fetcher, archive.length)
    const book = entries.find(entry => entry.path === 'database/book/1.db')!
    expect(new TextDecoder().decode(await fetchVerifiedShamelaEntry(book, source, fetcher))).toBe('book-one')
    expect(fetcher).toHaveBeenCalledWith(source.archiveUrl, expect.objectContaining({
      headers: expect.objectContaining({ 'If-Range': source.lastModified }),
    }))
  })

  it('excludes Lucene, covers, and unsafe paths from the initial sparse pack', () => {
    expect(isInitialShamelaDatabaseEntry('database/book/7.db')).toBe(true)
    expect(isInitialShamelaDatabaseEntry('database/book/42/7001.db')).toBe(true)
    expect(isInitialShamelaDatabaseEntry('database/services/meta.db')).toBe(true)
    expect(isInitialShamelaDatabaseEntry('database/lucene/_0.cfs')).toBe(false)
    expect(isInitialShamelaDatabaseEntry('cover/7.jpg')).toBe(false)
    expect(isInitialShamelaDatabaseEntry('../database/book/7.db')).toBe(false)
    expect(isInitialShamelaDatabaseEntry('database/../book/7.db')).toBe(false)
  })
})
