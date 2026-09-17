import type { SunnahGoldenRecord } from './sunnah_source_registry'

export interface SunnahCorpusSearchResult {
  record: SunnahGoldenRecord
  matchedFields: Array<'title' | 'hadithText'>
  sourceOrder: number
}

export function normalizeSunnahCorpusQuery(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[أإآٱ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ').trim().toLowerCase()
}

export function searchSunnahCorpus(
  records: readonly SunnahGoldenRecord[],
  rawQuery: string,
): SunnahCorpusSearchResult[] {
  const query = normalizeSunnahCorpusQuery(rawQuery)
  if (!query) return []
  return records.flatMap((record, sourceOrder) => {
    const matchedFields: SunnahCorpusSearchResult['matchedFields'] = []
    if (normalizeSunnahCorpusQuery(record.title).includes(query)) matchedFields.push('title')
    if (normalizeSunnahCorpusQuery(record.hadithText).includes(query)) matchedFields.push('hadithText')
    return matchedFields.length ? [{ record, matchedFields, sourceOrder }] : []
  })
}
