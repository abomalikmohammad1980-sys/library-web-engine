import { normalizeQuranAudioQuery } from './quran_audio_filter'

export type PriorityQuranReadingId = 'warsh-nafi' | 'qalun-nafi' | 'duri-abi-amr' | 'susi-abi-amr'

export type QuranReadingAudioEntry = {
  title?: string
  reciter?: string
  riwaya?: string
  chapterIds?: readonly string[]
  segmentation?: string
  mediaBaseUrl?: string
}

export type QuranReadingAudioAvailability = {
  id: PriorityQuranReadingId
  label: string
  entries: readonly QuranReadingAudioEntry[]
  completeEntries: readonly QuranReadingAudioEntry[]
}

/**
 * Visual text/page editions physically bundled with the application.
 *
 * Keep this registry deliberately stricter than the audio catalogue.  A
 * recitation being available never means that matching written mushaf pages
 * are available, and therefore must not make the Hafs SVG/text pack appear
 * under another riwaya's name.
 */
export const BUNDLED_QURAN_VISUAL_EDITIONS = Object.freeze([
  Object.freeze({ id: 'hafs-uthmani', label: 'مصحف المدينة — حفص عن عاصم', pageAssetRoot: './quran/mushaf/hafs', fontAsset: './fonts/hafs-uthmani.ttf' }),
] as const)

const PRIORITY_READINGS = Object.freeze([
  Object.freeze({ id: 'warsh-nafi', label: 'ورش عن نافع', riwaya: 'ورش', reader: 'نافع' }),
  Object.freeze({ id: 'qalun-nafi', label: 'قالون عن نافع', riwaya: 'قالون', reader: 'نافع' }),
  Object.freeze({ id: 'duri-abi-amr', label: 'الدوري عن أبي عمرو', riwaya: 'الدوري', reader: 'ابي عمرو' }),
  Object.freeze({ id: 'susi-abi-amr', label: 'السوسي عن أبي عمرو', riwaya: 'السوسي', reader: 'ابي عمرو' }),
] as const)

function matchesReading(entry: QuranReadingAudioEntry, riwaya: string, reader: string): boolean {
  if (normalizeQuranAudioQuery(entry.riwaya ?? '') !== riwaya) return false
  return normalizeQuranAudioQuery(entry.title ?? '').includes(reader)
}

function isCompleteAudioEntry(entry: QuranReadingAudioEntry): boolean {
  return Boolean(entry.mediaBaseUrl)
    && (entry.segmentation === 'chapter' || entry.segmentation === 'segment')
    && new Set(entry.chapterIds ?? []).size === 114
}

export function priorityQuranAudioAvailability(entries: readonly QuranReadingAudioEntry[]): readonly QuranReadingAudioAvailability[] {
  return PRIORITY_READINGS.map(reading => {
    const matches = entries.filter(entry => matchesReading(entry, reading.riwaya, reading.reader))
    return {
      id: reading.id,
      label: reading.label,
      entries: matches,
      completeEntries: matches.filter(isCompleteAudioEntry),
    }
  })
}

export function hasBundledQuranVisualEdition(id: string): boolean {
  return BUNDLED_QURAN_VISUAL_EDITIONS.some(edition => edition.id === id)
}
