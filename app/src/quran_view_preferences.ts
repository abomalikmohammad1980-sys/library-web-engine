export type QuranReadingMode = 'reading' | 'uthmani' | 'imlai'
export const QURAN_READING_MODE_KEY = 'khizana:quran-reading-mode:v1'
export const QURAN_AUDIO_READER_KEY = 'khizana:quran-audio-reader:v1'

type StorageReader = Pick<Storage, 'getItem'>
type StorageWriter = Pick<Storage, 'setItem'>

export function loadQuranReadingMode(storage: StorageReader = localStorage): QuranReadingMode {
  try { const value=storage.getItem(QURAN_READING_MODE_KEY); return value==='reading'||value==='imlai'?value:'uthmani' } catch { return 'uthmani' }
}

export function saveQuranReadingMode(mode: QuranReadingMode, storage: StorageWriter = localStorage): void {
  try { storage.setItem(QURAN_READING_MODE_KEY, mode) } catch { /* storage is an optional enhancement */ }
}

export function loadQuranAudioReader(storage: StorageReader = localStorage): string {
  try { return storage.getItem(QURAN_AUDIO_READER_KEY)?.slice(0, 300) ?? '' } catch { return '' }
}

export function saveQuranAudioReader(key: string, storage: StorageWriter = localStorage): void {
  try { storage.setItem(QURAN_AUDIO_READER_KEY, key.slice(0, 300)) } catch { /* storage is an optional enhancement */ }
}
