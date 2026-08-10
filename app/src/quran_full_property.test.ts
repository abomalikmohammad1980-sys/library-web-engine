import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { fullQuranCandidates, QURAN_FULL_PACK_CHECKSUM } from './quran_full_pack'
import { searchQuranCandidates } from './quran_search_contract'

const payload = JSON.parse(readFileSync(new URL('../public/quran/full/ayah-text.json', import.meta.url), 'utf8')) as { records: { ayahId: string; surah: number; ayah: number; text: string }[] }
const candidates = fullQuranCandidates(payload.records)

describe('full Quran seeded/property contracts', () => {
  it('preserves the identity algebra across all 6236 records', () => {
    const seen = new Set<string>(), perSurah = new Map<number, number>()
    for (const record of payload.records) {
      expect(record.ayahId).toBe(`${record.surah}:${record.ayah}`)
      expect(seen.has(record.ayahId)).toBe(false); seen.add(record.ayahId)
      const expected = (perSurah.get(record.surah) ?? 0) + 1
      expect(record.ayah).toBe(expected); perSurah.set(record.surah, expected)
      expect(record.text.trim().length).toBeGreaterThan(0)
    }
    expect(seen.size).toBe(6236); expect(perSurah.size).toBe(114)
  })

  it('keeps broad search bounded, deterministic and faster than an interactive budget', () => {
    const queries = ['اله', 'الرحمن', 'موسى', 'الهمزة', 'الهدهد', 'الصراط', 'الذين', 'يؤمنون', 'الناس', 'الكتاب']
    const started = performance.now()
    for (const query of queries) {
      const first = searchQuranCandidates(query, candidates).slice(0, 100)
      const second = searchQuranCandidates(query, candidates).slice(0, 100)
      expect(first).toEqual(second); expect(first.length).toBeLessThanOrEqual(100)
      expect(new Set(first.map(item => item.id)).size).toBe(first.length)
    }
    expect(performance.now() - started).toBeLessThan(2_000)
  })

  it('makes tashkeel sensitivity opt-in and never mutates canonical text', () => {
    const before = candidates[0]!.text
    const broad = searchQuranCandidates('الرحمن', candidates, { respectTashkeel: false })
    const sensitive = searchQuranCandidates('الرحمن', candidates, { respectTashkeel: true })
    expect(broad.length).toBeGreaterThan(sensitive.length)
    expect(candidates[0]!.text).toBe(before)
    expect(QURAN_FULL_PACK_CHECKSUM).toMatch(/^[a-f0-9]{64}$/)
  })

  it('can search an imlaei companion without replacing the canonical Uthmani result', () => {
    const imlai = new Map([['2:43', 'وَأَقِيمُوا الصَّلَاةَ وَآتُوا الزَّكَاةَ']])
    const withImlai = fullQuranCandidates(payload.records, imlai)
    const result = searchQuranCandidates('الصلاة', withImlai, { fuzzy: false }).find(item => item.id === '2:43')
    expect(result?.text).toBe(payload.records.find(item => item.ayahId === '2:43')?.text)
    expect(result?.searchText).toContain('الصَّلَاةَ')
  })
})
