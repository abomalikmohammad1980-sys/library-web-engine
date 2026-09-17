import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadQuranVerseResource } from './quran_resource_pack'
import { readFileSync } from 'node:fs'

const SCREEN = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')

describe('Quran exact local verse services', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses exact surah/ayah coverage and reports a partial miss honestly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ kind: 'gharib', title: 'غريب القرآن', author: 'ابن قتيبة', records: [{ ayah: 2, from: 2, to: 3, text: 'مدخل موثق' }] }) })))
    expect((await loadQuranVerseResource('gharib', 2, 2))?.entries[0]?.text).toBe('مدخل موثق')
    expect((await loadQuranVerseResource('gharib', 2, 3))?.entries[0]?.text).toBe('مدخل موثق')
    expect(await loadQuranVerseResource('gharib', 2, 4)).toBeUndefined()
  })

  it('keeps the requested inspector order and does not expose a duplicate tafsir service', () => {
    const replacement = SCREEN.slice(SCREEN.lastIndexOf('root.replaceChildren(', SCREEN.indexOf('tafsirRoot.replaceChildren')), SCREEN.indexOf('tafsirRoot.replaceChildren'))
    expect(replacement).toMatch(/modeSwitch[\s\S]*quran-selected__text[\s\S]*wordServices/)
    expect(SCREEN.indexOf('root.replaceChildren(', SCREEN.indexOf('function renderInspector'))).toBeLessThan(SCREEN.indexOf('audioPlayer(record, audio.entries)', SCREEN.indexOf('function renderInspector')))
    expect(SCREEN).not.toContain("...['الغريب', 'القراءات', 'التفسير', 'الإعراب']")
    expect(SCREEN).toContain("showLocalResource('gharib')")
    expect(SCREEN).toContain("showLocalResource('qiraat')")
    expect(SCREEN).toContain("showLocalResource('tasrif')")
    expect(SCREEN).toContain("showLocalResource('irab')")
  })

  it('prefers Surahpedia word packs and keeps only the documented irab fallback', () => {
    const source = readFileSync(new URL('./quran_resource_pack.ts', import.meta.url), 'utf8')
    expect(source).toContain("qiraat: ['surahpedia-qiraat-word']")
    expect(source).toContain("tasrif: ['surahpedia-tasrif-word']")
    expect(source).toContain("irab: ['surahpedia-irab-word', 'irab-darwish']")
  })
})
