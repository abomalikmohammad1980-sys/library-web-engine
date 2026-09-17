import { describe, expect, it } from 'vitest'
import { ayahId, deriveQuranCapabilities, isQuranRouteReady, parseAyahId, quranDatasetCacheKey, shouldInvalidateQuranDataset, validateQuranManifest, type QuranDatasetManifest } from './quran_domain'
import { clampPlaybackSpeed, validateAudioTrack } from './audio_core'
import { normalizeQuranSearch, searchQuranCandidates } from './quran_search_contract'

const manifest = (overrides: Partial<QuranDatasetManifest> = {}): QuranDatasetManifest => ({ datasetId: 'licensed-quran-fixture', kind: 'ayah-text', schemaVersion: 1, dataVersion: '1.0.0', checksumSha256: 'a'.repeat(64), byteSize: 1200, script: 'uthmani', provenance: { sourceName: 'metadata fixture only', licenseId: 'TEST-ONLY', attribution: 'لا يتضمن نصًا قرآنيًا', retrievedAt: '2026-08-09T00:00:00Z' }, ...overrides })

describe('Quran Q0 and AudioCore contracts', () => {
  it('keeps canonical identity and rejects invalid bounds', () => { expect(ayahId(1, 1)).toBe('1:1'); expect(parseAyahId('114:6')).toEqual({ surah: 114, ayah: 6, id: '114:6' }); expect(() => ayahId(0, 1)).toThrow() })
  it('requires license, provenance, checksum, and semantic version', () => { expect(validateQuranManifest(manifest())).toEqual([]); expect(validateQuranManifest(manifest({ checksumSha256: 'x' }))).toContain('checksumSha256') })
  it('invalidates versioned storage deterministically', () => { const old = manifest(); expect(shouldInvalidateQuranDataset(old, old)).toBe(false); expect(shouldInvalidateQuranDataset(old, manifest({ dataVersion: '1.0.1' }))).toBe(true); expect(quranDatasetCacheKey(old)).toContain(':1.0.0:') })
  it('does not expose Quran until licensed core text and page map validate', () => { const text = manifest(), pages = manifest({ datasetId: 'licensed-page-map', kind: 'mushaf-pages', script: undefined }); expect(isQuranRouteReady([])).toBe(false); expect(isQuranRouteReady([text])).toBe(false); expect(isQuranRouteReady([text, pages])).toBe(true); expect(deriveQuranCapabilities([text, pages]).tafsir).toBe(false) })
  it('keeps audio reusable and timing bounded', () => { const source = { sourceId: 'a', licenseId: 'L', attribution: 'A', checksumSha256: 'b'.repeat(64), byteSize: 10, version: '1.0.0' }; expect(validateAudioTrack({ trackId: 't', workId: 'w', title: 'x', source, durationMs: 100, segments: [{ segmentId: 's', startMs: 0, endMs: 50 }] })).toBe(true); expect(clampPlaybackSpeed(9)).toBe(3) })
})

describe('broad Arabic Quran search defaults', () => {
  const candidates = [{ id: '1', text: 'اللَّه' }, { id: '2', text: 'الهمزة' }, { id: '3', text: 'الهدهد' }, { id: '4', text: 'الكتاب العظيم في أبواب الفقه' }]
  it('ignores tashkeel and tatweel and folds Arabic letter variants by default', () => { expect(normalizeQuranSearch('إِلَـٰه')).toBe('اله'); expect(normalizeQuranSearch('على')).toBe('علي') })
  it('finds broad bounded matches and explains only fuzzy matches', () => { const found = searchQuranCandidates('اله', candidates); expect(found.map(item => item.id)).toEqual(['2', '3', '1']); expect(found.find(item => item.id === '1')?.reason).toBe('تقارب ترتيب الحروف'); expect(found.some(item => item.id === '4')).toBe(false) })
  it('makes tashkeel-sensitive matching opt-in', () => { expect(searchQuranCandidates('الله', [{ id: 'x', text: 'اللَّه' }], { respectTashkeel: true, fuzzy: false })).toEqual([]) })
  it('bounds fuzzy distance and rejects very short broad queries', () => { expect(searchQuranCandidates('ا', candidates)).toEqual([]); expect(searchQuranCandidates('الكتتب', [{ id: 'x', text: 'الكتاب' }])[0]?.kind).toBe('fuzzy') })
  it('keeps the reader search lexical unless fuzzy expansion is requested', () => {
    const verses = [{ id: 'jihad', text: 'فضل الجهاد عظيم' }, { id: 'mihad', text: 'وبئس المهاد' }]
    expect(searchQuranCandidates('الجهاد', verses, { fuzzy: false }).map(item => item.id)).toEqual(['jihad'])
    expect(searchQuranCandidates('الجهاد', verses, { fuzzy: true }).map(item => item.id)).toContain('mihad')
  })
  it('matches modern spelling against the Uthmani dagger alif', () => {
    expect(searchQuranCandidates('جاهدوا', [{ id: '9:20', text: 'وَجَٰهَدُواْ فِي سَبِيلِ ٱللَّهِ' }], { fuzzy: false }).map(item => item.id)).toEqual(['9:20'])
  })
})
