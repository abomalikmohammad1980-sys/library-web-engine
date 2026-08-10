import { normalizeQuranSearch } from './quran_search_contract'

export type QuranRootOccurrence = { surah: number; ayah: number; position: number; word: string }
type RootRecord = { root: string; normalized: string; occurrences: QuranRootOccurrence[] }
type RootIndex = {
  schemaVersion: 1
  datasetId: 'surahpedia-tasrif-root-index-v1'
  counts: { roots: number; indexedWords: number; sourceWords: number; ayahs: number }
  roots: RootRecord[]
}

let indexPromise: Promise<RootIndex> | undefined

function validOccurrence(value: unknown): value is QuranRootOccurrence {
  const item = value as Partial<QuranRootOccurrence>
  return Number.isInteger(item.surah) && Number(item.surah) >= 1 && Number(item.surah) <= 114
    && Number.isInteger(item.ayah) && Number(item.ayah) >= 1
    && Number.isInteger(item.position) && Number(item.position) >= 1
    && typeof item.word === 'string' && item.word.length > 0
}

function validateIndex(value: unknown): RootIndex {
  const data = value as Partial<RootIndex>
  if (data.schemaVersion !== 1 || data.datasetId !== 'surahpedia-tasrif-root-index-v1' || !data.counts || !Array.isArray(data.roots)) throw new Error('invalid_quran_root_index')
  if (data.counts.roots !== data.roots.length || data.counts.ayahs !== 6236 || data.counts.sourceWords !== 77432) throw new Error('invalid_quran_root_index_counts')
  for (const record of data.roots) {
    if (!record || typeof record.root !== 'string' || typeof record.normalized !== 'string' || record.normalized !== normalizeQuranSearch(record.root) || !Array.isArray(record.occurrences) || !record.occurrences.every(validOccurrence)) throw new Error('invalid_quran_root_record')
  }
  return data as RootIndex
}

export async function loadQuranRootIndex(): Promise<RootIndex> {
  indexPromise ??= fetch('./quran/resources/search/tasrif-root-index.json', { cache: 'force-cache' })
    .then(response => { if (!response.ok) throw new Error(`quran_root_index_http_${response.status}`); return response.json() })
    .then(validateIndex)
    .catch(error => { indexPromise = undefined; throw error })
  return indexPromise
}

export async function searchQuranByRoot(query: string): Promise<{ root: string; occurrences: QuranRootOccurrence[] }> {
  const normalized = normalizeQuranSearch(query)
  if (normalized.length < 2) return { root: '', occurrences: [] }
  const index = await loadQuranRootIndex()
  const record = index.roots.find(item => item.normalized === normalized)
  return record ? { root: record.root, occurrences: record.occurrences.map(item => ({ ...item })) } : { root: query.trim(), occurrences: [] }
}

export function resetQuranRootIndexForTest(): void { indexPromise = undefined }
