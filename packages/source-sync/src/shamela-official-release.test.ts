import { describe, expect, it, vi } from 'vitest'
import {
  SHAMELA_OFFICIAL_1448_2, commitShamelaRange, createShamelaCheckpoint,
  fetchVerifiedShamelaRange, nextShamelaRange, planShamelaAcquisition,
  validateShamelaCheckpoint, validateShamelaOfficialRelease,
  type ShamelaOfficialRelease,
} from './shamela-official-release.js'

const fixtureRelease: ShamelaOfficialRelease = {
  sourceId: 'shamela-official-database', version: '1448.2',
  archiveUrl: 'https://dev.shamela.ws/downloads/fixture.zip', contentLength: 10,
  etag: '"abc-123"', lastModified: 'Thu, 30 Jul 2026 19:07:08 GMT',
  acceptsByteRanges: true, observedAt: '2026-08-10T13:47:12Z',
}

function responseFor(range: { start: number; end: number }, overrides: Record<string, string> = {}): Response {
  const bytes = Uint8Array.from({ length: range.end - range.start + 1 }, (_, index) => range.start + index)
  return new Response(bytes, { status: 206, headers: {
    'content-range': `bytes ${range.start}-${range.end}/${fixtureRelease.contentLength}`,
    etag: fixtureRelease.etag, 'last-modified': fixtureRelease.lastModified,
    'accept-ranges': 'bytes', ...overrides,
  } })
}

describe('official Shamela release S0', () => {
  it('pins the official 1448.2 response metadata and selects on-demand packs for B capacity', () => {
    expect(validateShamelaOfficialRelease(SHAMELA_OFFICIAL_1448_2)).toEqual([])
    expect(SHAMELA_OFFICIAL_1448_2.contentLength).toBe(13_294_044_352)
    expect(planShamelaAcquisition(9_998_000_000)).toMatchObject({
      strategy: 'pack-on-demand', downloadFullArchive: false, reason: 'insufficient-capacity',
    })
  })

  it('resumes a small fixture with exact Range and Last-Modified If-Range headers', async () => {
    const checkpoint = createShamelaCheckpoint(fixtureRelease)
    const range = nextShamelaRange(checkpoint, 4, fixtureRelease)!
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('range')).toBe('bytes=0-3')
      expect(new Headers(init?.headers).get('if-range')).toBe(fixtureRelease.lastModified)
      return responseFor(range)
    }) as typeof fetch
    const bytes = await fetchVerifiedShamelaRange(range, fixtureRelease, fetcher)
    const resumed = commitShamelaRange(checkpoint, range, bytes, fixtureRelease)
    expect(resumed.nextByte).toBe(4)
    expect(nextShamelaRange(resumed, 4, fixtureRelease)).toEqual({ start: 4, end: 7 })
  })

  it('fails closed on the observed ETag If-Range 200 response and cancels its full body', async () => {
    const range = { start: 0, end: 3 }
    let requestedIfRange = ''
    let cancelled = false
    const fullBody = new ReadableStream<Uint8Array>({
      pull() { /* The client must cancel before consuming this full archive response. */ },
      cancel() { cancelled = true },
    })
    await expect(fetchVerifiedShamelaRange(range, fixtureRelease, async (_url, init) => {
      requestedIfRange = new Headers(init?.headers).get('if-range') ?? ''
      return new Response(fullBody, { status: 200, headers: { etag: fixtureRelease.etag } })
    }))
      .rejects.toThrow('shamela_range_not_honored')
    expect(requestedIfRange).toBe(fixtureRelease.lastModified)
    expect(requestedIfRange).not.toBe(fixtureRelease.etag)
    expect(cancelled).toBe(true)
  })

  it('accepts the observed Last-Modified If-Range 206 response and keeps validators strict', async () => {
    const range = { start: 0, end: 3 }
    const fetcher = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      expect(new Headers(init?.headers).get('if-range')).toBe(fixtureRelease.lastModified)
      return responseFor(range)
    }) as typeof fetch
    await expect(fetchVerifiedShamelaRange(range, fixtureRelease, fetcher))
      .resolves.toEqual(Uint8Array.from([0, 1, 2, 3]))
    await expect(fetchVerifiedShamelaRange(range, fixtureRelease, async () => responseFor(range, { etag: '"changed-1"' })))
      .rejects.toThrow('shamela_etag_mismatch')
    await expect(fetchVerifiedShamelaRange(range, fixtureRelease, async () => responseFor(range, { 'last-modified': 'Fri, 31 Jul 2026 19:07:08 GMT' })))
      .rejects.toThrow('shamela_last_modified_mismatch')
    await expect(fetchVerifiedShamelaRange(range, fixtureRelease, async () => responseFor(range, { 'content-range': 'bytes 1-4/10' })))
      .rejects.toThrow('shamela_content_range_mismatch')
    expect(validateShamelaCheckpoint({ ...createShamelaCheckpoint(fixtureRelease), etag: '"changed-1"' }, fixtureRelease))
      .toContain('shamela_checkpoint_release_mismatch')
  })
})
