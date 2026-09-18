import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadQuranAudioReader, loadQuranReadingMode, QURAN_AUDIO_READER_KEY, QURAN_READING_MODE_KEY, saveQuranAudioReader, saveQuranReadingMode } from './quran_view_preferences'

const memory = () => {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
}

describe('Quran view persistence and scale isolation', () => {
  it('persists three distinct views',()=>{const storage=memory();for(const mode of ['reading','uthmani','imlai'] as const){saveQuranReadingMode(mode,storage);expect(loadQuranReadingMode(storage)).toBe(mode)}})
  it('persists the selected script and reciter across reload/back', () => {
    const storage = memory()
    saveQuranReadingMode('imlai', storage); saveQuranAudioReader('القارئ|ورش', storage)
    expect(storage.values.get(QURAN_READING_MODE_KEY)).toBe('imlai')
    expect(storage.values.get(QURAN_AUDIO_READER_KEY)).toBe('القارئ|ورش')
    expect(loadQuranReadingMode(storage)).toBe('imlai')
    expect(loadQuranAudioReader(storage)).toBe('القارئ|ورش')
  })

  it('falls back safely when persisted values are invalid', () => {
    const storage = memory(); storage.setItem(QURAN_READING_MODE_KEY, 'other')
    expect(loadQuranReadingMode(storage)).toBe('uthmani')
  })

  it('keeps position/mushaf persisted and gives the imlai text its own zoom instead of scaling the page box', () => {
    const screen = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
    expect(screen).toContain('page: mapped.page, mushaf: mushaf.select.value')
    expect(screen).toContain("sheet.style.setProperty('--quran-page-zoom'")
    expect(screen).toContain("sheet.style.setProperty('--quran-text-zoom'")
    expect(screen).toContain("readingMode === 'reading' ? String(pageZoom / 100) : '1'")
    expect(screen).not.toContain("details.style.setProperty('--quran-page-zoom'")
    expect(screen).not.toContain("tafsirDetails.style.setProperty('--quran-page-zoom'")
  })

  it('fills standard pages at 100% but preserves the two opening pages inset', () => {
    const css = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
    const screen = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
    expect(screen).toContain("page <= 2 ? ' quran-page-canvas--opening' : ' quran-page-canvas--standard'")
    expect(css).toContain('.quran-page-canvas--facsimile > .quran-page-svg')
    expect(css).toContain('width: 100%; min-width: 100%; max-width: 100%; height: 100%')
    expect(css).toContain('.quran-page-canvas--opening > .quran-page-svg')
    expect(css).toContain('width: 92%; min-width: 92%; max-width: 92%; height: 92%')
  })
})
