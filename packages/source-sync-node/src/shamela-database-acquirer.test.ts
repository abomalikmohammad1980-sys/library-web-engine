import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { strToU8, zipSync } from 'fflate'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ShamelaOfficialRelease } from '@library/source-sync'
import { acquireShamelaDatabases } from './shamela-database-acquirer.js'

const roots: string[] = []
afterEach(async () => { await Promise.all(roots.splice(0).map(root => rm(root, { recursive: true, force: true }))) })

function sqlite(label: string): Uint8Array { return strToU8(`SQLite format 3\0${label}`) }
function archive(): Uint8Array { return zipSync({ database: { book: { '10': { '99.db': sqlite('book') } }, 'master.db': sqlite('master'), store: { '_0.cfs': strToU8('lucene') } } }) }
function sampleArchive(): Uint8Array { return zipSync({ database: { book: { '20': { '200.db': sqlite('book-200') }, '10': { '101.db': sqlite('book-101'), '100.db': sqlite('book-100') } }, 'master.db': sqlite('master'), service: { 'authors.db': sqlite('authors') }, 'services.db': sqlite('services'), lucene: { '_0.cfs': strToU8('lucene') } } }) }
function release(bytes: Uint8Array): ShamelaOfficialRelease { return { sourceId: 'shamela-official-database', version: '1448.2', archiveUrl: 'https://dev.shamela.ws/downloads/fixture.zip', contentLength: bytes.length, etag: '"abc-123"', lastModified: 'Thu, 30 Jul 2026 19:07:08 GMT', acceptsByteRanges: true, observedAt: '2026-08-10T13:47:12Z' } }
function ranged(bytes: Uint8Array, source: ShamelaOfficialRelease): typeof fetch { return vi.fn(async (_url, init) => { const match = /bytes=(\d+)-(\d+)/.exec(new Headers(init?.headers).get('range')!)!; const start = Number(match[1]); const end = Number(match[2]); return new Response(bytes.slice(start, end + 1), { status: 206, headers: { 'content-range': `bytes ${start}-${end}/${bytes.length}`, etag: source.etag, 'last-modified': source.lastModified, 'accept-ranges': 'bytes' } }) }) as typeof fetch }

describe('Shamela sparse database acquirer', () => {
  it('atomically checkpoints selected SQLite files and resumes without fetching their payloads', async () => {
    const bytes = archive(); const source = release(bytes)
    const root = await mkdtemp(resolve(tmpdir(), 'shamela-acquire-')); roots.push(root)
    const firstFetch = ranged(bytes, source)
    const first = await acquireShamelaDatabases({ root, release: source, fetcher: firstFetch })
    expect(first.completed).toBe(true); expect(first.files.map(file => file.path)).toEqual(['database/book/10/99.db', 'database/master.db'])
    expect(await readFile(resolve(root, 'database/book/10/99.db'), 'utf8')).toContain('SQLite format 3')
    const secondFetch = ranged(bytes, source)
    const second = await acquireShamelaDatabases({ root, release: source, fetcher: secondFetch })
    expect(second.fingerprint).toBe(first.fingerprint)
    expect(secondFetch).toHaveBeenCalledTimes(2)
    await writeFile(resolve(root, 'database/book/10/99.db'), 'corrupt')
    const repairFetch = ranged(bytes, source)
    const repaired = await acquireShamelaDatabases({ root, release: source, fetcher: repairFetch })
    expect(repaired.fingerprint).toBe(first.fingerprint)
    expect(await readFile(resolve(root, 'database/book/10/99.db'), 'utf8')).toContain('SQLite format 3')
  })

  it('fails closed before commit when a selected entry is not SQLite', async () => {
    const bytes = zipSync({ database: { book: { '1.db': strToU8('not sqlite') } } }); const source = release(bytes)
    const root = await mkdtemp(resolve(tmpdir(), 'shamela-reject-')); roots.push(root)
    await expect(acquireShamelaDatabases({ root, release: source, fetcher: ranged(bytes, source) })).rejects.toThrow('shamela_sqlite_signature_invalid')
    await expect(readFile(resolve(root, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('selects a bounded deterministic golden sample plus master and service databases and resumes it', async () => {
    const bytes = sampleArchive(); const source = release(bytes)
    const root = await mkdtemp(resolve('.shamela-golden-sample-')); roots.push(root)
    const firstFetch = ranged(bytes, source)
    const first = await acquireShamelaDatabases({ root, release: source, fetcher: firstFetch, goldenSample: { bookCount: 2 } })
    expect(first.selection).toEqual({
      kind: 'golden-sample', bookCount: 2,
      entries: ['database/book/10/100.db', 'database/book/10/101.db', 'database/master.db', 'database/service/authors.db', 'database/services.db'],
    })
    expect(first.files.map(file => file.path)).toEqual(first.selection!.entries)
    await expect(readFile(resolve(root, 'manifest.json'))).rejects.toMatchObject({ code: 'ENOENT' })
    expect(JSON.parse(await readFile(resolve(root, 'manifest.golden-sample.json'), 'utf8'))).toMatchObject({ completed: true, selection: first.selection })

    const resumedFetch = ranged(bytes, source)
    const resumed = await acquireShamelaDatabases({ root, release: source, fetcher: resumedFetch, goldenSample: { bookCount: 2 } })
    expect(resumed.fingerprint).toBe(first.fingerprint)
    expect(resumedFetch).toHaveBeenCalledTimes(2)
  })

  it('keeps full and golden-sample manifests independent', async () => {
    const bytes = sampleArchive(); const source = release(bytes)
    const root = await mkdtemp(resolve('.shamela-manifest-separation-')); roots.push(root)
    const sample = await acquireShamelaDatabases({ root, release: source, fetcher: ranged(bytes, source), goldenSample: { bookCount: 1 } })
    const sampleManifestBefore = await readFile(resolve(root, 'manifest.golden-sample.json'), 'utf8')
    const full = await acquireShamelaDatabases({ root, release: source, fetcher: ranged(bytes, source) })
    expect(full.selection).toBeUndefined()
    expect(full.files).toHaveLength(6)
    expect(await readFile(resolve(root, 'manifest.golden-sample.json'), 'utf8')).toBe(sampleManifestBefore)
    expect(JSON.parse(await readFile(resolve(root, 'manifest.json'), 'utf8'))).toMatchObject({ completed: true, selectedEntryCount: 6 })
    expect(sample.fingerprint).not.toBe(full.fingerprint)
  })

  it('rejects unsafe golden sample sizes before downloading entry payloads', async () => {
    const bytes = sampleArchive(); const source = release(bytes)
    const root = await mkdtemp(resolve('.shamela-golden-limit-')); roots.push(root)
    const fetcher = ranged(bytes, source)
    await expect(acquireShamelaDatabases({ root, release: source, fetcher, goldenSample: { bookCount: 101 } })).rejects.toThrow('shamela_golden_sample_book_limit')
    expect(fetcher).toHaveBeenCalledTimes(2)
  })
})
