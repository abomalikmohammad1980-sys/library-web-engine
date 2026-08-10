import { describe, expect, it } from 'vitest'
import { authorNameMatches, normalizeArabicAuthorName } from './author_filter'
import { normalizeTocQuery, extractPdfOutline } from './reader_toc'
import { normalizeQuranSearch, searchQuranCandidates } from './quran_search_contract'

const arabicVariants = (value: string): string[] => [
  value,
  value.replace(/ا/g, 'أ'),
  value.replace(/ي/g, 'ى'),
  value.replace(/ /g, '  '),
  value.split('').join('ـ'),
]

describe('Arabic search and TOC seeded properties', () => {
  it('keeps author and TOC containment invariant under harmless Arabic presentation variants', () => {
    const canonical = 'ابن تيمية'
    for (const variant of arabicVariants(canonical)) {
      expect(normalizeArabicAuthorName(variant)).toBe(normalizeArabicAuthorName(canonical))
      expect(normalizeTocQuery(variant)).toBe(normalizeTocQuery(canonical))
      expect(authorNameMatches(`شيخ الإسلام ${variant} الحراني`, [], canonical)).toBe(true)
    }
  })

  it('keeps Quran canonical text immutable and ranking deterministic across normalization variants', () => {
    const candidates = [
      { id: '1', text: 'الله الصمد' },
      { id: '2', text: 'ألهاكم التكاثر' },
      { id: '3', text: 'الهدهد' },
    ] as const
    const before = JSON.stringify(candidates)
    const baseline = searchQuranCandidates('اله', candidates).map(item => [item.id, item.kind, item.score])
    for (const variant of ['اله', 'أله', 'الـه']) {
      expect(normalizeQuranSearch(variant)).toBe(normalizeQuranSearch('اله'))
      expect(searchQuranCandidates(variant, candidates).map(item => [item.id, item.kind, item.score])).toEqual(baseline)
    }
    expect(JSON.stringify(candidates)).toBe(before)
  })

  it('preserves exact nested PDF destinations and skips only unresolvable entries', async () => {
    const entries = await extractPdfOutline({
      getOutline: async () => [{ title: 'الباب', items: [
        { title: 'المسألة الأولى', dest: 'named' },
        { title: 'غير صالح', dest: [{ bad: true }] },
      ] }],
      getDestination: async name => name === 'named' ? [{ num: 7 }] : null,
      getPageIndex: async ref => {
        if ((ref as { bad?: boolean }).bad) throw new Error('unresolvable')
        return (ref as { num: number }).num
      },
    })
    expect(entries).toEqual([{ num: 8, label: 'الباب ← المسألة الأولى' }])
  })
})
