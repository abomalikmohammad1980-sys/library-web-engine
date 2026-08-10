import { describe, expect, it } from 'vitest'
import { canonicalQuranOrder, countLogicalQuranOccurrences, countQuranOccurrences, matchesQuranPhrase, normalizeQuranSearch, searchQuranCandidates } from './quran_search_contract'

describe('Quran search presentation contract', () => {
  it('counts repeated normalized occurrences in one and several ayahs', () => {
    expect(countQuranOccurrences('الله', ['الله الله', 'قُلْ هُوَ ٱللَّهُ'], false)).toBe(3)
    expect(normalizeQuranSearch('ٱللَّهُ', false)).toBe(normalizeQuranSearch('الله', false))
  })

  it('does not double count the same logical phrase indexed in Uthmani and Imlai scripts', () => {
    expect(countLogicalQuranOccurrences('الحج أشهر', [{ uthmani: 'ٱلۡحَجُّ أَشۡهُرٞ مَّعۡلُومَٰتٞ', imlai: 'الْحَجُّ أَشْهُرٌ مَعْلُومَاتٌ' }])).toBe(1)
    expect(countLogicalQuranOccurrences('الله', [{ uthmani: 'ٱللَّهُ ٱللَّهُ', imlai: 'اللَّهُ اللَّهُ' }])).toBe(2)
  })

  it('sorts shuffled results by canonical surah then ayah number', () => {
    const shuffled = [{ id: '114:2' }, { id: '2:10' }, { id: '1:7' }, { id: '2:2' }]
    expect(canonicalQuranOrder(shuffled).map(item => item.id)).toEqual(['1:7', '2:2', '2:10', '114:2'])
  })

  it('matches the normalized phrase itself even when broad search classified it as a token prefix', () => {
    const candidates = [{ id: '9:41', text: 'جاهدوا بأموالكم وأنفسكم' }]
    const broad = searchQuranCandidates('جاهد', candidates, { fuzzy: false })
    expect(broad[0]?.kind).toBe('token-prefix')
    expect(matchesQuranPhrase('جاهد', broad[0]!.text)).toBe(true)
    expect(matchesQuranPhrase('جهاد', broad[0]!.text)).toBe(false)
  })
})
