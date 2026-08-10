import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import { normalizeSunnahCorpusQuery, searchSunnahCorpus } from './sunnah_corpus_search'
import type { SunnahGoldenRecord } from './sunnah_source_registry'

const corpusUrl = new URL('../public/sunnah/hadeethenc-ar/records.golden.json', import.meta.url)

describe('canonical sunnah corpus search', () => {
  it('ignores Arabic marks and keeps the pinned workbook order stable', async () => {
    const records = JSON.parse(await readFile(corpusUrl, 'utf8')) as SunnahGoldenRecord[]
    const results = searchSunnahCorpus(records, 'حَجّ')
    expect(results.map(result => result.record.id)).toEqual([
      '2750', '2751', '2753', '2755', '2758', '2759', '2933', '2940', '2943', '2948',
    ])
    expect(results.map(result => result.sourceOrder)).toEqual([1, 2, 4, 6, 8, 9, 11, 18, 20, 25])
  })

  it('searches only the canonical title and hadith text, not commentary fields', () => {
    const record = {
      id: '1', title: 'عنوان', hadithText: 'متن ثابت', explanation: 'لفظ سري',
      wordMeanings: '', benefits: '', grade: '', takhrij: '',
      link: 'https://hadeethenc.com/ar/browse/hadith/1',
      provenance: { sourceId: 'hadeethenc-ar', releaseVersion: 'v1.7.0', recordLocator: 'Worksheet!A3:I3', recordChecksumSha256: 'a'.repeat(64) },
    } satisfies SunnahGoldenRecord
    expect(searchSunnahCorpus([record], 'لفظ سري')).toEqual([])
    expect(searchSunnahCorpus([record], 'متن').map(result => result.record.id)).toEqual(['1'])
    expect(searchSunnahCorpus([record], '')).toEqual([])
  })

  it('normalizes common Arabic letter variants without stemming or invented expansion', () => {
    expect(normalizeSunnahCorpusQuery('إِلَى الآخِرَة')).toBe('الي الاخره')
    expect(normalizeSunnahCorpusQuery('رباط')).not.toBe(normalizeSunnahCorpusQuery('المرابط'))
  })
})
