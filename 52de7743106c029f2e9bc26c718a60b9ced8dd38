import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getReadingMode, nextReadingMode, readingModeLabel, saveReadingMode } from './reading_mode'
describe('reader display mode', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
  })
  it('keeps Word pages as default and persists flow', () => { expect(getReadingMode()).toBe('word-pages'); saveReadingMode('flow'); expect(getReadingMode()).toBe('flow') })
  it('toggles with the next view label', () => { expect(nextReadingMode('word-pages')).toBe('flow'); expect(readingModeLabel('word-pages')).toBe('نمط انسيابي'); expect(readingModeLabel('flow')).toBe('عرض صفحات Word') })

  it('keeps Word pages as the default on phones and respects an explicit flow choice', () => {
    localStorage.removeItem('alkhizana:reading-mode:v1')
    window.matchMedia = () => ({ matches: true }) as MediaQueryList
    expect(getReadingMode()).toBe('word-pages')
    saveReadingMode('flow')
    expect(getReadingMode()).toBe('flow')
  })
})
