import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { QURAN_FULL_PACK_CHECKSUM, QURAN_FULL_SEARCH_CHECKSUM } from './quran_full_pack'

const asset = (path: string) => readFileSync(new URL(`../public/quran/${path}`, import.meta.url))

describe('full Quran lazy asset pack', () => {
  it('contains all canonical ayah identities exactly once', () => {
    const payload = JSON.parse(asset('full/ayah-text.json').toString('utf8')) as { records: { ayahId: string; surah: number; ayah: number }[] }
    expect(payload.records).toHaveLength(6236)
    expect(new Set(payload.records.map(record => record.ayahId)).size).toBe(6236)
    expect(new Set(payload.records.map(record => record.surah)).size).toBe(114)
    expect(payload.records[0]?.ayahId).toBe('1:1')
    expect(payload.records.at(-1)?.ayahId).toBe('114:6')
  })

  it('keeps provenance checksums and payloads outside the initial JavaScript bundle', () => {
    const manifest = JSON.parse(asset('full/manifest.json').toString('utf8')) as { checksumSha256: string; search: { checksumSha256: string } }
    expect(manifest.checksumSha256).toBe(QURAN_FULL_PACK_CHECKSUM)
    expect(manifest.search.checksumSha256).toBe(QURAN_FULL_SEARCH_CHECKSUM)
    expect(createHash('sha256').update(asset('full/ayah-text.json')).digest('hex')).toBe(QURAN_FULL_PACK_CHECKSUM)
  })

  it('ships honest Q2 and audio metadata catalogs without audio bytes', () => {
    const resources = JSON.parse(asset('q2/resources.json').toString('utf8')) as { tafsirs: unknown[]; books: unknown[] }
    const audio = JSON.parse(asset('audio/catalog.json').toString('utf8')) as { entries: unknown[]; offline: unknown }
    expect(resources.tafsirs).toHaveLength(36); expect(resources.books).toHaveLength(52)
    expect(audio.entries).toHaveLength(359)
    expect(asset('audio/catalog.json').length).toBeLessThan(500_000)
  })
})
