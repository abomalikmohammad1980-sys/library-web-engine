export type QuranAudioFilterEntry = { reciter?: string; riwaya?: string }

export function normalizeQuranAudioQuery(value: string): string {
  return value.normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('ar')
}

export function quranAudioEntryKey(entry: QuranAudioFilterEntry): string {
  return (entry.reciter ?? '') + '|' + (entry.riwaya ?? '')
}

export function filterQuranAudioEntries<T extends QuranAudioFilterEntry>(entries: readonly T[], query: string): Array<{ entry: T; index: number }> {
  const terms = normalizeQuranAudioQuery(query).split(' ').filter(Boolean)
  return entries.map((entry, index) => ({ entry, index })).filter(({ entry }) => {
    if (!terms.length) return true
    const haystack = normalizeQuranAudioQuery((entry.reciter ?? '') + ' ' + (entry.riwaya ?? ''))
    return terms.every(term => haystack.includes(term))
  })
}
