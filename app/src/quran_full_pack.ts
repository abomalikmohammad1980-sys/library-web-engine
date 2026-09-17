import type { QuranSearchCandidate } from './quran_search_contract'
import {fetchQuranResource} from './quran_fetch'

export const QURAN_FULL_PACK_ID = 'quranpedia-hafs-uthmani-full-1.0.0'
export const QURAN_FULL_PACK_CHECKSUM = '153aec6dd05dac6616a23da55c02780eb6ed86dbc041a60c016edc614cdfa906'
export const QURAN_FULL_SEARCH_CHECKSUM = '8f5be71f7edafed1ea02d896b1b7faa92f6c3b086ffeea696b07629aa657a57d'
export const QURAN_FULL_PACK_KEY = 'alkhizana:quran:full-pack:v1'

export interface FullQuranAyah { ayahId: string; surah: number; ayah: number; text: string }
interface FullQuranPayload { schemaVersion: number; datasetId: string; records: FullQuranAyah[] }
export interface QuranResource { id?: number | string; name?: string; title?: string; author?: string; [key: string]: unknown }
export interface QuranResourcesPayload { tafsirs?: QuranResource[]; books?: QuranResource[]; [key: string]: unknown }
export interface QuranAudioSource { id?: number | string; name?: string; title?: string; reciter?: string; riwaya?: string; chapterIds?: string[]; segmentation?: 'chapter' | 'segment'; mediaBaseUrl?: string; [key: string]: unknown }
export interface QuranAudioCatalog { entries?: QuranAudioSource[]; sources?: QuranAudioSource[]; records?: QuranAudioSource[]; [key: string]: unknown }

let textPromise: Promise<FullQuranPayload> | undefined
let resourcePromise: Promise<QuranResourcesPayload> | undefined
let audioPromise: Promise<QuranAudioCatalog> | undefined

async function fetchJson<T>(url: string, retry = false): Promise<T> {
  return fetchQuranResource(url,response=>response.json() as Promise<T>,retry)
}

export function loadFullQuran(retry = false): Promise<FullQuranPayload> {
  if (retry) textPromise = undefined
  return textPromise ??= fetchJson<FullQuranPayload>('./quran/full/ayah-text.json', retry).then(payload => {
    if (!isValidFullQuranPayload(payload)) throw new Error('quran-pack-invalid')
    return payload
  }).catch(error => { textPromise = undefined; throw error })
}

export function isValidFullQuranPayload(payload: FullQuranPayload): boolean {
  if (payload.datasetId !== 'quranpedia-hafs-uthmani-full' || !Array.isArray(payload.records) || payload.records.length !== 6236) return false
  const identities = new Set<string>()
  for (const record of payload.records) {
    if (!Number.isInteger(record.surah) || record.surah < 1 || record.surah > 114
      || !Number.isInteger(record.ayah) || record.ayah < 1
      || record.ayahId !== `${record.surah}:${record.ayah}`
      || typeof record.text !== 'string' || !record.text.trim()
      || identities.has(record.ayahId)) return false
    identities.add(record.ayahId)
  }
  return true
}

export function loadQuranResources(retry = false): Promise<QuranResourcesPayload> {
  if (retry) resourcePromise = undefined
  return resourcePromise ??= fetchJson<QuranResourcesPayload>('./quran/q2/resources.json', retry).catch(error => { resourcePromise = undefined; throw error })
}

export function loadQuranAudioCatalog(retry = false): Promise<QuranAudioCatalog> {
  if (retry) audioPromise = undefined
  return audioPromise ??= fetchJson<QuranAudioCatalog>('./quran/audio/catalog.json', retry).catch(error => { audioPromise = undefined; throw error })
}

export function fullQuranCandidates(records: readonly FullQuranAyah[], imlaiByAyah?: ReadonlyMap<string, string>): readonly QuranSearchCandidate[] {
  return records.map(record => {
    const imlai = imlaiByAyah?.get(record.ayahId)?.trim()
    return { id: record.ayahId, text: record.text, ...(imlai ? { searchText: `${record.text} ${imlai}` } : {}) }
  })
}

export function isFullQuranInstalled(storage: Pick<Storage, 'getItem'> = localStorage): boolean { return storage.getItem(QURAN_FULL_PACK_KEY) === QURAN_FULL_PACK_ID }
export function installFullQuran(storage: Pick<Storage, 'setItem'> = localStorage): void { storage.setItem(QURAN_FULL_PACK_KEY, QURAN_FULL_PACK_ID) }
export function removeFullQuran(storage: Pick<Storage, 'removeItem'> = localStorage): void { storage.removeItem(QURAN_FULL_PACK_KEY) }
