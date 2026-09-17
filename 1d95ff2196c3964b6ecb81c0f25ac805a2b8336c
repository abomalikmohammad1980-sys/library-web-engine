import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetQuranRootIndexForTest, searchQuranByRoot } from './quran_root_search'

afterEach(() => { vi.unstubAllGlobals(); resetQuranRootIndexForTest() })

describe('Quran root search', () => {
  it('returns every verified occurrence for an exact normalized root', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      schemaVersion: 1,
      datasetId: 'surahpedia-tasrif-root-index-v1',
      counts: { roots: 1, indexedWords: 2, sourceWords: 77432, ayahs: 6236 },
      roots: [{ root: 'أبد', normalized: 'ابد', occurrences: [{ surah: 2, ayah: 95, position: 3, word: 'أَبَدًا' }, { surah: 4, ayah: 57, position: 13, word: 'أَبَدًا' }] }],
    }), { status: 200 })))
    await expect(searchQuranByRoot('ابد')).resolves.toEqual({ root: 'أبد', occurrences: [{ surah: 2, ayah: 95, position: 3, word: 'أَبَدًا' }, { surah: 4, ayah: 57, position: 13, word: 'أَبَدًا' }] })
  })

  it('fails closed on incomplete or inconsistent indexes', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ schemaVersion: 1, datasetId: 'surahpedia-tasrif-root-index-v1', counts: { roots: 0, indexedWords: 0, sourceWords: 1, ayahs: 1 }, roots: [] }), { status: 200 })))
    await expect(searchQuranByRoot('كتب')).rejects.toThrow('invalid_quran_root_index_counts')
  })
})
