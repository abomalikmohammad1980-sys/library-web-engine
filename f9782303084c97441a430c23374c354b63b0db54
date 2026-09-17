import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { QURAN_LOCAL_PACK_KEY, QURANPEDIA_METADATA_FIXTURE, installQuranMetadataPack, quranFixtureSearchCandidates, quranPackStatus, removeQuranMetadataPack } from './quran_local_pack'
import { QURAN_FULL_PACK_CHECKSUM, QURAN_FULL_PACK_ID, QURAN_FULL_PACK_KEY, installFullQuran, isFullQuranInstalled, removeFullQuran } from './quran_full_pack'
import { formatQuranCopy, formatQuranCopyRange, quranAudioUrl } from './screens/quran'

class MemoryStorage {
  private readonly values = new Map<string, string>()
  getItem(key: string): string | null { return this.values.get(key) ?? null }
  setItem(key: string, value: string): void { this.values.set(key, value) }
  removeItem(key: string): void { this.values.delete(key) }
}

const SHELL = readFileSync(new URL('./shell.ts', import.meta.url), 'utf8')
const ROUTER = readFileSync(new URL('./router.ts', import.meta.url), 'utf8')
const SCREEN = readFileSync(new URL('./screens/quran.ts', import.meta.url), 'utf8')
const CSS = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')
const LIBRARY = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const PAGE_MAP = JSON.parse(readFileSync(new URL('../public/quran/mushaf/hafs/page-map.json', import.meta.url), 'utf8')) as { records: { ayahId: string; page: number; imlai: string }[] }
const FIRST_PAGE = readFileSync(new URL('../public/quran/mushaf/hafs/001.svg', import.meta.url), 'utf8')

describe('Q1 Quran local screen contract', () => {
  it('places Quran after home and before library and routes it explicitly', () => {
    const home = SHELL.indexOf("label: 'الرئيسية'"), quran = SHELL.indexOf("label: 'القرآن'"), library = SHELL.indexOf("label: 'مكتبتي'")
    expect(home).toBeGreaterThan(-1); expect(quran).toBeGreaterThan(home); expect(library).toBeGreaterThan(quran)
    expect(ROUTER).toContain("if (first === 'quran') return { name: 'quran' }")
    expect(ROUTER).toContain("content = appFrame(quranScreen(), '#/quran')")
    expect(ROUTER).toContain("return { name: 'quran-tafsir'")
    expect(ROUTER).toContain("appFrame(quranTafsirBookScreen(route.param), '#/quran')")
  })

  it('installs and removes only the verified metadata fixture locally', () => {
    const storage = new MemoryStorage(); expect(quranPackStatus(storage)).toBe('available')
    installQuranMetadataPack(storage); expect(storage.getItem(QURAN_LOCAL_PACK_KEY)).toBe(QURANPEDIA_METADATA_FIXTURE.id); expect(quranPackStatus(storage)).toBe('installed')
    removeQuranMetadataPack(storage); expect(quranPackStatus(storage)).toBe('available')
    expect(quranFixtureSearchCandidates()).toHaveLength(7)
  })

  it('activates the verified full Quran pack without writing Quran text to preferences', () => {
    const storage = new MemoryStorage(); expect(isFullQuranInstalled(storage)).toBe(false)
    installFullQuran(storage); expect(storage.getItem(QURAN_FULL_PACK_KEY)).toBe(QURAN_FULL_PACK_ID); expect(isFullQuranInstalled(storage)).toBe(true)
    removeFullQuran(storage); expect(isFullQuranInstalled(storage)).toBe(false)
    expect(QURAN_FULL_PACK_CHECKSUM).toHaveLength(64)
  })

  it('uses the verified printed Hafs pages and keeps unavailable commentary honest', () => {
    expect(QURANPEDIA_METADATA_FIXTURE.sourceUrl).toBe('https://api.quranpedia.net/v1/mushafs/2/1')
    expect(QURANPEDIA_METADATA_FIXTURE.ayahs).toHaveLength(7)
    expect(QURANPEDIA_METADATA_FIXTURE.publicationStatus).toBe('publishable-user-attested-waqf-reuse')
    expect(PAGE_MAP.records).toHaveLength(6236)
    expect(new Set(PAGE_MAP.records.map(record => record.ayahId)).size).toBe(6236)
    expect(Math.max(...PAGE_MAP.records.map(record => record.page))).toBe(604)
    expect(PAGE_MAP.records[0]?.imlai).toContain('بِسْمِ')
    expect(FIRST_PAGE).toContain('class="ayahPolygon"')
    expect(SCREEN).toContain("label: 'مصحف المدينة — حفص عن عاصم'")
    expect(SCREEN).toContain('./quran/tafsir/${definition.slug}/${record.surah}.json')
    expect(SCREEN).toContain('TAFSIRS.findIndex(item => item.bookId === 2003)')
    expect(SCREEN).not.toContain('TAFSIRS.findIndex(item => item.bookId === 3)')
    expect(SCREEN).not.toContain('فتح تفاسير الآية الآن')
    expect(SCREEN).not.toContain('التفسير داخل الخزانة')
    expect(SCREEN).toContain('quran-inspector--tools')
    expect(SCREEN).toContain('quran-inspector--tafsir')
    expect(SCREEN).toContain('quran-page-turner')
    expect(SCREEN).toContain('تصفية ${title}')
    expect(SCREEN).toContain('let readingMode: QuranReadingMode = loadQuranReadingMode()')
    expect(SCREEN).toContain('quran-selectable-page--${mode}')
    expect(CSS).toContain('user-select: text')
    expect(SCREEN).toContain("title: 'الرسم العثماني' }, 'عثماني'")
    expect(SCREEN).toContain("title: 'الرسم الإملائي' }, 'إملائي'")
    expect(SCREEN).toContain('--quran-page-font')
    expect(SCREEN).toContain('quran-selectable-word')
    expect(SCREEN).toContain("targetVerse.querySelectorAll<HTMLElement>('.quran-copy-overlay__word')")
    expect(SCREEN).not.toContain('quran-word-picker')
    expect(SCREEN).not.toContain('خدمات الآية ${record.ayah} كاملة')
    expect(SCREEN).toContain('drawOriginalSelectablePage')
    expect(SCREEN).toContain('quran-copy-overlay')
    expect(SCREEN).toContain("event.clipboardData?.setData('text/plain', copied.join('\\n'))")
    expect(SCREEN).toContain("part.toString().replace(/\\s+/g, ' ').trim()")
    expect(SCREEN).not.toContain("h('span', null, 'كتاب التفسير')")
    expect(SCREEN).not.toContain('مصحف حفص الموافق لمطبوع مجمع الملك فهد · صفحات Quranpedia')
    expect(SCREEN).not.toContain('الترخيص غير محسوم')
    expect(SCREEN).not.toMatch(/تفسير جاهز|قراءات جاهزة|موارد السور|مصدرًا وصفيًا/)
  })

  it('keeps broad search as default and has an accessible 390px layout contract', () => {
    expect(SCREEN).toContain("type: 'checkbox'")
    expect(SCREEN).toContain("h('span', null, 'مطابقة العبارة')")
    expect(SCREEN).toContain('if (exact.checked) matches = matches.filter(match => matchesQuranPhrase(')
    expect(SCREEN).not.toContain("'aria-label': 'طريقة بحث القرآن'")
    expect(SCREEN).not.toContain('الجذر — يحتاج فهرسًا صرفيًا موثقًا')
    expect(SCREEN).not.toContain('المشتقات — تحتاج فهرسًا صرفيًا موثقًا')
    expect(SCREEN).toContain('respectTashkeel: sensitive.checked')
    expect(SCREEN).toContain("'aria-label': 'البحث في نص القرآن'")
    expect(SCREEN).toContain("role: 'status', 'aria-live': 'polite'")
    expect(SCREEN).toContain('`سورة ${SURAH_NAMES[record.surah - 1] ?? record.surah} · الآية ${record.ayah}`')
    expect(SCREEN).toContain('copy(formatQuranCopy(record.text, record.surah, record.ayah)')
    expect(SCREEN).toContain('navigator.clipboard?.writeText(text)')
    expect(SCREEN).not.toContain("copyAction('إملائي', 'إملائي مشكول'")
    expect(SCREEN).not.toContain("copyAction('عثماني', 'بالرسم العثماني'")
    expect(formatQuranCopy('بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ', 1, 1)).toBe('﴿بِسْمِ اللَّهِ الرَّحْمَنِ الرَّحِيمِ﴾ [الفاتحة: 1]')
    expect(formatQuranCopy('اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ', 24, 35)).toBe('﴿اللَّهُ نُورُ السَّمَاوَاتِ وَالْأَرْضِ﴾ [النور: 35]')
    expect(formatQuranCopyRange('ٱلۡحَمۡدُ لِلَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ', 1, 2, 3)).toBe('﴿ٱلۡحَمۡدُ لِلَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ﴾ [الفاتحة: 2 - 3]')
    expect(SCREEN).toContain("[.75, 1, 1.25, 1.5, 2]")
    expect(SCREEN).toContain("if (!ensureSource()) return")
    expect(quranAudioUrl({ segmentation: 'segment', mediaBaseUrl: 'https://audio.example/reader/' }, 5, 35)).toBe('https://audio.example/reader/005035.mp3')
    expect(quranAudioUrl({ segmentation: 'chapter', mediaBaseUrl: 'https://audio.example/reader/' }, 5, 35)).toBe('https://audio.example/reader/005.mp3')
    expect(SCREEN).toContain("entry.segmentation === 'segment'")
    expect(SCREEN).not.toContain('تحميل التلاوة عند الطلب')
    expect(SCREEN).toContain('افتحه ككتاب')
    expect(SCREEN).toContain('quran-tafsir-ayah')
    expect(SCREEN).toContain('quran-reader__ornament--start')
    expect(SCREEN).toContain("h('h1', { id: 'quran-title' }, 'القرآن الكريم')")
    expect(SCREEN).not.toContain("h('p', { class: 'eyebrow' }, 'القرآن الكريم')")
    expect(SCREEN).toContain('quran-tafsir-selector')
    expect(SCREEN).toContain('fuzzy: false')
    expect(CSS).toContain('.quran-reader__hero')
    expect(CSS).toContain('quran-reader__ornament')
    expect(LIBRARY).not.toContain('كتب التفسير المرتبطة')
    expect(CSS).toContain('.quran-tafsir-body')
    expect(SCREEN).toContain("path.setAttribute('tabindex', '0')")
    expect(CSS).toContain('@media (max-width: 720px)')
    expect(CSS).toContain('grid-template-columns: minmax(0, 1fr)')
  })
})
