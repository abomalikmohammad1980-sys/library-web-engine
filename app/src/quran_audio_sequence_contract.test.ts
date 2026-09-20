import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { nextQuranAudioRecord, nextQuranRepeatCount, quranSleepDelayMs, shouldRepeatQuranAyah } from './screens/quran'

const screen = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
const records = [
  { ayahId: '1:7', surah: 1, ayah: 7, text: '' },
  { ayahId: '2:1', surah: 2, ayah: 1, text: '' },
] as Parameters<typeof nextQuranAudioRecord>[0]

describe('Quran audio sequence and repeat-one', () => {
  it('advances a whole-surah recording to the next surah instead of replaying it for each verse',()=>{
    const chapterRecords=[{ayahId:'1:1',surah:1,ayah:1,text:''},{ayahId:'1:2',surah:1,ayah:2,text:''},{ayahId:'2:1',surah:2,ayah:1,text:''},{ayahId:'2:2',surah:2,ayah:2,text:''}] as Parameters<typeof nextQuranAudioRecord>[0]
    expect(nextQuranAudioRecord(chapterRecords,chapterRecords[0]!,'chapter')).toEqual(chapterRecords[2])
    expect(nextQuranAudioRecord(chapterRecords,chapterRecords[2]!,'chapter')).toBeUndefined()
    expect(nextQuranAudioRecord(chapterRecords,chapterRecords[0]!,'segment')).toEqual(chapterRecords[1])
  })
  it('advances across a surah boundary and stops at corpus end', () => {
    expect(nextQuranAudioRecord(records, records[0]!)).toEqual(records[1])
    expect(nextQuranAudioRecord(records, records[1]!)).toBeUndefined()
  })

  it('cycles 1/3/7/infinite repetition and advances after the exact finite count', () => {
    expect(nextQuranRepeatCount(1)).toBe(3)
    expect(nextQuranRepeatCount(3)).toBe(7)
    expect(nextQuranRepeatCount(7)).toBe('infinity')
    expect(nextQuranRepeatCount('infinity')).toBe(1)
    expect(shouldRepeatQuranAyah(1, 3)).toBe(true)
    expect(shouldRepeatQuranAyah(2, 3)).toBe(true)
    expect(shouldRepeatQuranAyah(3, 3)).toBe(false)
    expect(shouldRepeatQuranAyah(999, 'infinity')).toBe(true)
    expect(screen).toContain('shouldRepeatQuranAyah(completedPlays, preferredRepeatCount)')
    expect(screen).toContain('quranAudioAdvance?.(record, selectedAudioEntry()?.segmentation)')
    expect(screen).toContain("? '27addd84774213ee' : 'c649e67ae3630466'")
    expect(screen).toContain("uiTemplateAttribute(repeat,'aria-label',repeatDescription(),{p1:repeatLabel()})")
    expect(screen).toContain("quranAudioAutoplayAyah = nextRecord.ayahId")
  })

  it('removes seek buttons and aborts old listeners when the card is rebuilt', () => {
    expect(screen).not.toContain('الرجوع عشر ثوان')
    expect(screen).not.toContain('التقدم عشر ثوان')
    expect(screen).toContain('activeQuranAudioCleanup?.()')
    expect(screen).toContain('listeners.abort()')
    expect(css).toMatch(/\.quran-audio-card\s*\{[^}]*var\(--brand-primary\)[^}]*var\(--paper-surface\)/s)
  })

  it('keeps visible SVG play and pause states plus a named reader badge', () => {
    expect(screen).toContain("icon('play', 21)")
    expect(screen).toContain("play.replaceChildren(icon('pause', 21))")
    expect(screen).toContain("play.replaceChildren(icon('play', 21))")
    expect(screen).toContain("role: 'combobox'")
    expect(screen).toContain("'aria-label': 'عرض قائمة القراء'")
    expect(screen).toContain("fillReaders(true, '')")
    expect(screen).toContain("filter.setAttribute('aria-activedescendant'")
    expect(screen).toContain("event.key === 'ArrowDown' || event.key === 'ArrowUp'")
    expect(screen).toContain("event.key === 'Enter'")
    expect(screen).toContain("event.key === 'Escape'")
    expect(screen).not.toContain("class: 'quran-audio-reader-badge'")
    expect(screen).not.toContain("h('select', { 'aria-label': 'اختر القارئ والرواية'")
    expect(css).toMatch(/\.quran-audio-transport\s*\{[^}]*grid-template-columns:\s*44px minmax\(92px, 1fr\) 44px minmax\(84px, 112px\)/s)
    expect(css).toMatch(/@media \(max-width:\s*460px\)[\s\S]*\.quran-audio-button\s*\{[^}]*min-width:\s*44px;[^}]*height:\s*44px/s)
    expect(css).toMatch(/\.quran-audio-play svg\s*\{[^}]*width:\s*22px;[^}]*height:\s*22px/s)
    expect(css).toContain('max-height: clamp(308px, 58dvh, 440px)')
    expect(css).toContain('width: min(440px, calc(100vw - 32px))')
    expect(css).toContain('.quran-inspector--tools, .quran-audio-card, .quran-audio-panel, .quran-audio-combobox { overflow: visible; }')
    expect(css).toMatch(/\.quran-audio-combobox__option[^}]+min-height:\s*44px/s)
    expect(css).toMatch(/\.quran-audio-combobox__list[^}]+overflow-y:\s*auto/s)
    expect(css).toMatch(/\.quran-audio-combobox__toggle[^}]+min-width:\s*44px;[^}]*min-height:\s*44px/s)
    expect(css).not.toMatch(/\.quran-audio-[^{]+\{[^}]*(--color-primary|--color-primary-soft|--color-surface|--color-text-muted)/s)
  })

  it('uses a hyphen, never a bullet, between surah and page', () => {
    expect(screen).toContain("uiTemplateText('cbb0a0ac906682d3',{p1:uiLabelParameter(SURAH_NAMES[state.surah - 1] ?? String(state.surah)),p2:state.page})")
    const templates=readFileSync(new URL('./i18n/en.quran_templates.reviewed.ts',import.meta.url),'utf8')
    expect(templates).toContain('source:"سورة {p1} - الصفحة {p2}"')
    expect(screen).not.toContain(' · الصفحة ${state.page}')
  })

  it('does not reserve routine hint space below the player', () => {
    expect(screen).not.toContain('يبدأ تحميل الصوت عند الضغط على التشغيل فقط.')
  })

  it('offers a local sleep timer and cancels it safely with the audio card', () => {
    expect(quranSleepDelayMs(15)).toBe(900_000)
    expect(quranSleepDelayMs(0)).toBe(0)
    expect(screen).toContain("'aria-label': 'مؤقت إيقاف التلاوة'")
    expect(screen).toContain('cancelSleepTimer()')
    expect(screen).toContain("player.pause();sleep.value='0'")
    expect(screen).toContain('activeQuranAudioCleanup = () => { cancelSleepTimer();')
    expect(css).toMatch(/\.quran-audio-sleep\s*\{[^}]*min-height:\s*40px/s)
  })
})
