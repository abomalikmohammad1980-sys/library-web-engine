import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadQuranVerseResource } from './quran_resource_pack'
import { readFileSync } from 'node:fs'

const SCREEN = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
const SCREEN_CSS = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')

describe('Quran exact local verse services', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('uses exact surah/ayah coverage and reports a partial miss honestly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ kind: 'tasrif', title: 'التصريف', author: 'الفريق العلمي بمركز تفسير للدراسات القرآنية', records: [{ ayah: 2, from: 2, to: 3, text: 'مدخل موثق' }] }) })))
    expect((await loadQuranVerseResource('tasrif', 2, 2))?.entries[0]?.text).toBe('مدخل موثق')
    expect((await loadQuranVerseResource('tasrif', 2, 3))?.entries[0]?.text).toBe('مدخل موثق')
    expect(await loadQuranVerseResource('tasrif', 2, 4)).toBeUndefined()
  })

  it('keeps the requested inspector order and does not expose a duplicate tafsir service', () => {
    const replacement = SCREEN.slice(SCREEN.lastIndexOf('root.replaceChildren(', SCREEN.indexOf('tafsirRoot.replaceChildren')), SCREEN.indexOf('tafsirRoot.replaceChildren'))
    expect(replacement).toMatch(/modeSwitch[\s\S]*wordServices/)
    expect(replacement).not.toContain('quran-selected__text')
    expect(replacement).not.toContain('الآية المختارة')
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
    expect(source).toContain("irab: ['surahpedia-irab-word']")
    expect(source).not.toContain('irab-darwish')
    expect(source).toContain("gharib: ['kfgqpc-muyassar-gharib']")
    expect(source).not.toContain("gharib: ['gharib-ibn-qutaybah']")
  })

  it('keeps all resource provenance out of reader cards and emphasizes the selected Quran word', () => {
    expect(SCREEN).toContain('quranGharibEntry(entry.word, entry.meaning)')
    expect(SCREEN).toContain('emphasizeResourceWord(entry.text, selectedWord)')
    expect(SCREEN).toContain('entry.word && entry.meaning')
    expect(SCREEN).not.toContain("resource.author ? h('small', null, resource.author) : null")
    expect(SCREEN).not.toContain("h('strong', null, resource.title)")
    expect(SCREEN).toContain('مورد الغريب المعتمد غير متاح محليًا بعد.')
    expect(SCREEN).toContain('wordServiceStatus.replaceChildren(...entries)')
    expect(SCREEN_CSS).toMatch(/\.quran-resource-target-word\s*\{[^}]*font-family:\s*inherit;[^}]*font-size:\s*inherit;[^}]*color:\s*inherit;[^}]*font-weight:\s*700/)
    expect(SCREEN_CSS).not.toMatch(/\.quran-resource-target-word\s*\{[^}]*(var\(--font|font-family:\s*var\()/)
    expect(SCREEN_CSS).toMatch(/\.quran-word-service-status\s*\{[^}]*font-family:\s*var\(--font-body\)/)
    expect(SCREEN_CSS).toMatch(/\.quran-resource-target-word\s*\{[^}]*font-stretch:\s*inherit;[^}]*letter-spacing:\s*inherit;[^}]*word-spacing:\s*inherit/)
  })

  it('uses registry-backed tafsir and offers retry for local verse resources', () => {
    expect(SCREEN).toContain("loadLocalTafsir(definition.slug, record.surah, record.ayah, retry)")
    expect(SCREEN).not.toContain('fetch(`./quran/tafsir/${definition.slug}')
    expect(SCREEN).toContain("action('إعادة المحاولة', () => { void showLocalResource(kind, true) })")
  })

  it('keeps the selected coordinates in service logic without duplicating verse text', () => {
    expect(SCREEN).toContain('loadQuranVerseResource(kind, record.surah, record.ayah, retry)')
    expect(SCREEN).toContain('audioPlayer(record, audio.entries)')
    expect(SCREEN).toContain('state.selected = picked')
    expect(SCREEN).not.toContain("class: 'quran-selected__text'")
  })
})
