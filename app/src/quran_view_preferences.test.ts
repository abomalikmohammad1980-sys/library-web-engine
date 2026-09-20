import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { loadQuranAudioReader, loadQuranReadingMode, QURAN_AUDIO_READER_KEY, QURAN_READING_MODE_KEY, saveQuranAudioReader, saveQuranReadingMode } from './quran_view_preferences'

const memory = () => {
  const values = new Map<string, string>()
  return { values, getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) }
}

describe('Quran view persistence and scale isolation', () => {
  it('keeps all three script choices on one row',()=>{const css=readFileSync(new URL('./styles/screens.css',import.meta.url),'utf8');for(const selector of ['.quran-reading-modes--compact','.quran-selected > .quran-reading-modes--compact']){const start=css.indexOf(selector+' {'),rule=css.slice(start,css.indexOf('}',start));expect(rule).toContain('grid-template-columns: repeat(3, minmax(0, 1fr))')}})
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
    expect(loadQuranReadingMode(storage)).toBe('reading')
  })

  it('defaults to printed reading for new visitors or unavailable storage',()=>{
    expect(loadQuranReadingMode(memory())).toBe('reading')
    expect(loadQuranReadingMode({getItem(){throw Error('unavailable')}})).toBe('reading')
  })

  it('switches only the page and skips an already active choice',()=>{
    const screen=readFileSync(new URL('./screens/quran.ts',import.meta.url),'utf8')
    const handler=screen.slice(screen.indexOf('const setReadingMode ='),screen.indexOf("uthmaniMode.addEventListener('click'"))
    expect(handler).toContain('if(mode===readingMode)return')
    expect(handler).toContain('paintPage(')
    expect(handler).toContain('revision===drawRevision')
    expect(handler).not.toMatch(/\bdraw\(|renderInspector\(|\.setOptions\(/)
  })

  it('keeps the reviewed source link map outside the initial Quran module',()=>{
    const screen=readFileSync(new URL('./screens/quran.ts',import.meta.url),'utf8')
    expect(screen).not.toMatch(/import\s*\{[^}]*getSourceEditionBookLink[^}]*\}\s*from/)
    expect(screen).toContain("import('../quran_source_book_links')")
    expect(screen).toContain('bookTools.isConnected&&root.contains(body)')
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
