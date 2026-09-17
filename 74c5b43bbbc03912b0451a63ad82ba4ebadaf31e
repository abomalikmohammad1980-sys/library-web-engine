/** عقود Q0 فقط: لا corpus ولا route ظاهر. */
export const QURAN_SCHEMA_VERSION = 1 as const
export type AyahId = string
export type QuranScript = 'uthmani' | 'imlaei'
export type QuranDatasetKind = 'ayah-text' | 'mushaf-pages' | 'qiraat' | 'tafsir' | 'irab' | 'translation' | 'topics' | 'audio' | 'search-index'

export interface AyahIdentity { surah: number; ayah: number; id: AyahId }
export interface DatasetProvenance { sourceName: string; sourceUrl?: string; publisher?: string; licenseId: string; licenseUrl?: string; attribution: string; retrievedAt: string }
export interface QuranDatasetManifest {
  datasetId: string; kind: QuranDatasetKind; schemaVersion: number; dataVersion: string
  checksumSha256: string; byteSize: number; locale?: string; script?: QuranScript
  qiraa?: string; riwaya?: string; mushafEdition?: string
  dependencies?: ReadonlyArray<{ datasetId: string; dataVersion: string; checksumSha256: string }>
  provenance: DatasetProvenance
}
export interface QuranTextVariant { ayahId: AyahId; script: QuranScript; text: string; qiraa?: string; riwaya?: string }
export interface MushafPageSpan { edition: string; page: number; from: AyahId; to: AyahId }
export interface QuranReferenceRecord { ayahId: AyahId; sourceDatasetId: string; text: string }
export interface QuranTopicRecord extends QuranReferenceRecord { topicIds: readonly string[] }
export interface QuranSearchIndexDescriptor { datasetId: string; fields: readonly ('uthmani' | 'imlaei' | 'translation' | 'tafsir' | 'topics')[]; normalizationVersion: string; indexVersion: string; byteSize: number }
export interface QuranCapabilityFlags { textUthmani: boolean; textImlaei: boolean; mushafPages: boolean; qiraat: boolean; tafsir: boolean; irab: boolean; translations: boolean; topics: boolean; audioTiming: boolean; offlineSearch: boolean }

export const QURAN_STORAGE_BUDGETS = Object.freeze({ coreTextBytes: 12 * 1024 * 1024, mushafMappingBytes: 4 * 1024 * 1024, commentaryBytes: 256 * 1024 * 1024, searchIndexesBytes: 96 * 1024 * 1024, audioMetadataBytes: 48 * 1024 * 1024, audioCacheBytes: 512 * 1024 * 1024 })

export function ayahId(surah: number, ayah: number): AyahId {
  if (!Number.isInteger(surah) || surah < 1 || surah > 114) throw new Error('رقم السورة خارج النطاق')
  if (!Number.isInteger(ayah) || ayah < 1 || ayah > 286) throw new Error('رقم الآية خارج النطاق')
  return String(surah) + ':' + String(ayah)
}
export function parseAyahId(value: string): AyahIdentity {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(value)
  if (!match) throw new Error('معرف الآية غير صالح')
  const surah = Number(match[1]), ayah = Number(match[2])
  return { surah, ayah, id: ayahId(surah, ayah) }
}
export function validateQuranManifest(manifest: QuranDatasetManifest): readonly string[] {
  const errors: string[] = []
  if (!/^[a-z0-9][a-z0-9._-]{2,79}$/i.test(manifest.datasetId)) errors.push('datasetId')
  if (!Number.isInteger(manifest.schemaVersion) || manifest.schemaVersion < 1) errors.push('schemaVersion')
  if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(manifest.dataVersion)) errors.push('dataVersion')
  if (!/^[a-f0-9]{64}$/i.test(manifest.checksumSha256)) errors.push('checksumSha256')
  if (!Number.isSafeInteger(manifest.byteSize) || manifest.byteSize < 1) errors.push('byteSize')
  if (!manifest.provenance.sourceName.trim()) errors.push('sourceName')
  if (!manifest.provenance.licenseId.trim()) errors.push('licenseId')
  if (!manifest.provenance.attribution.trim()) errors.push('attribution')
  if (!/^\d{4}-\d{2}-\d{2}T/.test(manifest.provenance.retrievedAt)) errors.push('retrievedAt')
  return errors
}
export function quranDatasetCacheKey(manifest: QuranDatasetManifest): string { return ['quran', QURAN_SCHEMA_VERSION, manifest.datasetId, manifest.schemaVersion, manifest.dataVersion, manifest.checksumSha256.toLowerCase()].join(':') }
export function shouldInvalidateQuranDataset(stored: Pick<QuranDatasetManifest, 'schemaVersion' | 'dataVersion' | 'checksumSha256'>, incoming: Pick<QuranDatasetManifest, 'schemaVersion' | 'dataVersion' | 'checksumSha256'>): boolean { return stored.schemaVersion !== incoming.schemaVersion || stored.dataVersion !== incoming.dataVersion || stored.checksumSha256.toLowerCase() !== incoming.checksumSha256.toLowerCase() }
export function deriveQuranCapabilities(manifests: readonly QuranDatasetManifest[]): QuranCapabilityFlags {
  const valid = manifests.filter(item => validateQuranManifest(item).length === 0), has = (kind: QuranDatasetKind) => valid.some(item => item.kind === kind)
  return { textUthmani: valid.some(item => item.kind === 'ayah-text' && item.script === 'uthmani'), textImlaei: valid.some(item => item.kind === 'ayah-text' && item.script === 'imlaei'), mushafPages: has('mushaf-pages'), qiraat: has('qiraat'), tafsir: has('tafsir'), irab: has('irab'), translations: has('translation'), topics: has('topics'), audioTiming: has('audio'), offlineSearch: has('search-index') }
}
export function isQuranRouteReady(manifests: readonly QuranDatasetManifest[]): boolean { const flags = deriveQuranCapabilities(manifests); return flags.textUthmani && flags.mushafPages }

