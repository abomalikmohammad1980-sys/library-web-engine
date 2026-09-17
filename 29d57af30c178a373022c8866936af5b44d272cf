import { pageContent } from '../components'
import { fullQuranCandidates, installFullQuran, isFullQuranInstalled, loadFullQuran, loadQuranAudioCatalog, type FullQuranAyah, type QuranResource } from '../quran_full_pack'
import { canonicalQuranOrder, countLogicalQuranOccurrences, matchesQuranPhrase, searchQuranCandidates } from '../quran_search_contract'
import { arabicNum, h, toast } from '../ui'
import { gunzipSync } from 'fflate'
import { addHighlight, getAnnotations } from '../annotation_store'
import { openTranslationDialog } from '../translation'
import { loadQuranVerseResource, type QuranVerseResourceKind } from '../quran_resource_pack'
import { quranWordIndexAtPoint } from '../quran_selection'
import { loadQuranAudioReader, loadQuranReadingMode, saveQuranAudioReader, saveQuranReadingMode, type QuranReadingMode } from '../quran_view_preferences'
import { filterQuranAudioEntries, quranAudioEntryKey } from '../quran_audio_filter'
import { searchQuranByRoot } from '../quran_root_search'

export const LOCAL_QURAN_FEATURE = true
const SURAH_NAMES = 'الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس'.split('|')
type TafsirDefinition = { name: string; author?: string; bookId?: number; slug?: string }
const TAFSIRS: TafsirDefinition[] = [
  { name: 'المختصر في التفسير', author: 'مركز تفسير للدراسات القرآنية', bookId: 2003, slug: 'mokhtasar-tafsir' },
  { name: 'تفسير الطبري', author: 'محمد بن جرير الطبري', bookId: 4, slug: 'tabari' },
  { name: 'تفسير البغوي', author: 'الحسين بن مسعود البغوي', bookId: 2, slug: 'baghawi' },
  { name: 'الكشاف للزمخشري' },
  { name: 'المحرر الوجيز لابن عطية' },
  { name: 'تفسير القرطبي' },
  { name: 'التسهيل لعلوم التنزيل لابن جزي' },
  { name: 'البحر المحيط' },
  { name: 'تفسير ابن كثير' },
  { name: 'تفسير الجلالين' },
  { name: 'فتح القدير' },
  { name: 'روح المعاني' },
  { name: 'تفسير المنار' },
  { name: 'تفسير السعدي', author: 'عبد الرحمن بن ناصر السعدي', bookId: 3, slug: 'saadi' },
  { name: 'في ظلال القرآن' },
  { name: 'أضواء البيان' },
  { name: 'التفسير القرآني للقرآن' },
  { name: 'تفسير ابن عثيمين' },
  { name: 'التحرير والتنوير' },
  { name: 'التفسير الوسيط للطنطاوي' },
]
const tafsirCache = new Map<string, { title: string; html: string }>()
let activeQuranCopyCleanup: (() => void) | undefined
let preferredAudioKey = ''

export function quranScreen(): HTMLElement {
  if (!isFullQuranInstalled()) installFullQuran()
  const page = pageContent(); page.classList.add('quran-page', 'quran-reader')
  const search = h('section', { class: 'quran-search-hub', 'aria-labelledby': 'quran-title' })
  const reader = h('main', { class: 'quran-mushaf', 'aria-labelledby': 'quran-title' })
  const details = h('aside', { class: 'quran-inspector quran-inspector--tools', 'aria-label': 'خدمات الآية المختارة' })
  const tafsirDetails = h('aside', { class: 'quran-inspector quran-inspector--tafsir', 'aria-label': 'تفسير الآية المختارة' })
  page.append(
    h('section', { class: 'quran-reader__hero', 'aria-labelledby': 'quran-title' },
      h('span', { class: 'quran-reader__ornament quran-reader__ornament--start', 'aria-hidden': 'true' }),
      h('span', { class: 'quran-reader__ornament quran-reader__ornament--end', 'aria-hidden': 'true' }),
      h('header', { class: 'quran-reader__header' }, h('h1', { id: 'quran-title' }, 'القرآن الكريم'), h('p', null, 'اقرأ، وابحث، وانتقل بين السور والآيات؛ وانقر أي آية لعرض تفسيرها وتلاوتها وخيارات نسخها.')),
      search,
    ),
    h('div', { class: 'quran-reader__layout' }, details, reader, tafsirDetails),
  )
  void renderQuran(reader, details, tafsirDetails, search)
  return page
}

async function renderQuran(reader: HTMLElement, details: HTMLElement, tafsirDetails: HTMLElement, searchRoot: HTMLElement): Promise<void> {
  reader.replaceChildren(h('p', { role: 'status' }, 'جارٍ فتح المصحف…'))
  try {
    const [payload, pageMap] = await Promise.all([loadFullQuran(), loadPageMap()]), groups = new Map<number, FullQuranAyah[]>()
    for (const record of payload.records) { const list = groups.get(record.surah) ?? []; list.push(record); groups.set(record.surah, list) }
    const uthmani = new Map(payload.records.map(record => [record.ayahId, record])), byId = new Map(pageMap.records.map(record => [record.ayahId, record]))
    const savedView = (() => {
      try {
        const value = JSON.parse(localStorage.getItem('khizana-quran-position') ?? 'null') as { surah?: number; ayah?: number; page?: number; mushaf?: string } | null
        if (!value || !Number.isInteger(value.surah) || !Number.isInteger(value.ayah) || !Number.isInteger(value.page)) return undefined
        return value
      } catch { return undefined }
    })()
    const savedPosition = savedView
      ? pageMap.records.find(record => record.surah === savedView.surah && record.ayah === savedView.ayah && record.page === savedView.page)
      : undefined
    const initialSelected = (savedPosition ? uthmani.get(savedPosition.ayahId) : undefined) ?? payload.records[0]!
    const state = { surah: initialSelected.surah, page: savedPosition?.page ?? 1, selected: initialSelected }
    const surah = selectControl('السورة', SURAH_NAMES.map((name, index) => ({ value: String(index + 1), label: `${index + 1}. ${name}` })), true)
    const ayah = selectControl('الآية', [], true)
    const page = selectControl('الصفحة', Array.from({ length: 604 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })), true)
    const mushaf = selectControl('المصحف والرواية', [{ value: 'hafs-uthmani', label: 'مصحف المدينة — حفص عن عاصم' }, { value: 'warsh', label: 'ورش عن نافع — قيد الإضافة' }, { value: 'qalun', label: 'قالون عن نافع — قيد الإضافة' }])
    mushaf.select.value = savedView?.mushaf === 'hafs-uthmani' ? savedView.mushaf : 'hafs-uthmani'
    surah.select.value = String(state.surah)
    page.select.value = String(state.page)
    const sheet = h('div', { class: 'quran-printed-page', 'aria-live': 'polite' })
    let readingMode: QuranReadingMode = loadQuranReadingMode()
    let pageZoom = Math.min(180, Math.max(100, Number(localStorage.getItem('khizana-quran-page-zoom') ?? 100) || 100))
    const zoomValue = h('output', { class: 'quran-page-zoom__value', 'aria-live': 'polite' }, `${pageZoom}٪`)
    const applyPageZoom = () => {
      sheet.style.setProperty('--quran-page-zoom', readingMode === 'imlai' ? '1' : String(pageZoom / 100))
      sheet.style.setProperty('--quran-text-zoom', readingMode === 'imlai' ? String(pageZoom / 100) : '1')
      zoomValue.textContent = `${pageZoom}٪`
      localStorage.setItem('khizana-quran-page-zoom', String(pageZoom))
    }
    const zoomOut = action('−', () => { pageZoom = Math.max(100, pageZoom - 15); applyPageZoom() }, 'quran-page-zoom__button')
    const zoomIn = action('+', () => { pageZoom = Math.min(180, pageZoom + 15); applyPageZoom() }, 'quran-page-zoom__button')
    zoomOut.setAttribute('aria-label', 'تصغير صفحة المصحف'); zoomIn.setAttribute('aria-label', 'تكبير صفحة المصحف')
    const zoomControls = h('div', { class: 'quran-page-zoom', role: 'group', 'aria-label': 'حجم صفحة المصحف' }, h('strong', null, 'حجم المصحف'), zoomOut, zoomValue, zoomIn)
    applyPageZoom()
    const title = h('h2', { class: 'quran-surah-title' }, '')
    const uthmaniMode = h('button', { type: 'button', class: `quran-reading-mode${readingMode === 'uthmani' ? ' is-active' : ''}`, 'aria-label': 'عرض المصحف بالرسم العثماني', title: 'الرسم العثماني' }, 'عثماني') as HTMLButtonElement
    const imlaiMode = h('button', { type: 'button', class: `quran-reading-mode${readingMode === 'imlai' ? ' is-active' : ''}`, 'aria-label': 'عرض المصحف بالرسم الإملائي', title: 'الرسم الإملائي' }, 'إملائي') as HTMLButtonElement
    uthmaniMode.setAttribute('aria-pressed', String(readingMode === 'uthmani')); imlaiMode.setAttribute('aria-pressed', String(readingMode === 'imlai'))
    const modeSwitch = h('section', { class: 'quran-reading-modes quran-reading-modes--compact', 'aria-label': 'اختيار رسم نص المصحف' }, uthmaniMode, imlaiMode)
    const draw = async (focusAyah?: number, highlightSearchTarget = false) => {
      state.surah = Number(surah.select.value); const records = groups.get(state.surah) ?? []
      ayah.setOptions(records.map(record => ({ value: String(record.ayah), label: String(record.ayah) })))
      if (focusAyah) ayah.select.value = String(focusAyah)
      const target = Number(ayah.select.value || focusAyah || 1), selected = records.find(item => item.ayah === target) ?? records[0], mapped = selected ? byId.get(selected.ayahId) : undefined
      if (mapped) { state.page = mapped.page; page.select.value = String(mapped.page) }
      title.textContent = `سورة ${SURAH_NAMES[state.surah - 1] ?? state.surah} · الصفحة ${state.page}`
      const openSelection = (surahNumber: number, ayahNumber: number, word?: string) => { const picked = uthmani.get(`${surahNumber}:${ayahNumber}`), imlai = byId.get(`${surahNumber}:${ayahNumber}`); if (!picked || !imlai) return; state.surah = surahNumber; state.selected = picked; surah.select.value = String(surahNumber); ayah.setOptions((groups.get(surahNumber) ?? []).map(item => ({ value: String(item.ayah), label: String(item.ayah) }))); ayah.select.value = String(ayahNumber); renderInspector(details, tafsirDetails, picked, imlai.imlai, audioState, modeSwitch, word) }
      if (readingMode === 'uthmani') await drawOriginalSelectablePage(sheet, state.page, pageMap.records, uthmani, openSelection)
      else drawSelectablePage(sheet, state.page, pageMap.records, uthmani, readingMode, openSelection)
      if (highlightSearchTarget && selected) {
        const targetVerse = [...sheet.querySelectorAll<HTMLElement>('[data-ayah-id]')].find(element => element.dataset.ayahId === selected.ayahId)
        if (targetVerse?.classList.contains('quran-copy-overlay__ayah')) targetVerse.querySelectorAll<HTMLElement>('.quran-copy-overlay__word').forEach(word => word.classList.add('is-search-target'))
        else targetVerse?.classList.add('is-search-target')
        targetVerse?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      }
      if (selected && mapped) {
        state.selected = selected
        localStorage.setItem('khizana-quran-position', JSON.stringify({ surah: selected.surah, ayah: selected.ayah, page: mapped.page, mushaf: mushaf.select.value }))
        renderInspector(details, tafsirDetails, selected, mapped.imlai, audioState, modeSwitch)
      }
    }
    surah.select.addEventListener('change', () => { void draw(1) })
    ayah.select.addEventListener('change', () => { void draw(Number(ayah.select.value)) })
    page.select.addEventListener('change', () => { state.page = Number(page.select.value); const first = pageMap.records.find(record => record.page === state.page); if (first) { surah.select.value = String(first.surah); void draw(first.ayah) } })
    mushaf.select.addEventListener('change', () => { if (mushaf.select.value !== 'hafs-uthmani') { toast('هذا المصحف قيد الإضافة؛ بقي مصحف حفص ظاهرًا'); mushaf.select.value = 'hafs-uthmani' } })
    const setReadingMode = (mode: QuranReadingMode) => { readingMode = mode; saveQuranReadingMode(mode); applyPageZoom(); uthmaniMode.classList.toggle('is-active', mode === 'uthmani'); imlaiMode.classList.toggle('is-active', mode === 'imlai'); uthmaniMode.setAttribute('aria-pressed', String(mode === 'uthmani')); imlaiMode.setAttribute('aria-pressed', String(mode === 'imlai')); void draw(Number(ayah.select.value || 1)) }
    uthmaniMode.addEventListener('click', () => setReadingMode('uthmani')); imlaiMode.addEventListener('click', () => setReadingMode('imlai'))
    const audioState: AudioState = { entries: [] }
    const previous = action('‹', () => { if (state.page <= 1) return; page.select.value = String(state.page - 1); page.select.dispatchEvent(new Event('change')) }, 'quran-page-arrow')
    const next = action('›', () => { if (state.page >= 604) return; page.select.value = String(state.page + 1); page.select.dispatchEvent(new Event('change')) }, 'quran-page-arrow')
    previous.setAttribute('aria-label', 'الصفحة السابقة'); next.setAttribute('aria-label', 'الصفحة التالية')
    reader.replaceChildren(zoomControls, sheet, h('nav', { class: 'quran-page-turner', 'aria-label': 'التنقل بين صفحات المصحف' }, previous, title, next), h('div', { class: 'quran-navigation' }, mushaf.label, surah.label, ayah.label, page.label))
    renderSearchHub(searchRoot, payload.records, new Map(pageMap.records.map(record => [record.ayahId, record.imlai])), (record) => { surah.select.value = String(record.surah); void draw(record.ayah, true) })
    await draw(initialSelected.ayah)
    void createAudioState().then(loaded => {
      audioState.entries = loaded.entries
      const mapped = byId.get(state.selected.ayahId)
      if (mapped) renderInspector(details, tafsirDetails, state.selected, mapped.imlai, audioState, modeSwitch)
    })
  } catch {
    reader.replaceChildren(h('p', { role: 'alert' }, 'تعذر فتح المصحف المحلي.'), retryButton(() => { void renderQuran(reader, details, tafsirDetails, searchRoot) }))
  }
}

type PageMapRecord = { ayahId: string; surah: number; ayah: number; page: number; imlai: string }
type PageMapPayload = { records: PageMapRecord[] }
async function loadPageMap(): Promise<PageMapPayload> { const response = await fetch('./quran/mushaf/hafs/page-map.json'); if (!response.ok) throw new Error('quran-page-map'); const payload = await response.json() as PageMapPayload; if (payload.records.length !== 6236) throw new Error('quran-page-map-invalid'); return payload }

async function loadMushafSvg(page: number): Promise<string> {
  const name = String(page).padStart(3, '0')
  const compressed = await fetch(`./quran/mushaf/hafs/${name}.svg.gz`)
  if (compressed.ok) {
    const bytes = new Uint8Array(await compressed.arrayBuffer())
    // بعض خوادم SPA تعيد index.html بحالة 200 للمسار المفقود؛ لا نحاول فكّه كـgzip.
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) return new TextDecoder().decode(gunzipSync(bytes))
  }
  // يبقى الأصل غير المضغوط صالحًا للتطوير المحلي وللحزم القديمة.
  const original = await fetch(`./quran/mushaf/hafs/${name}.svg`)
  if (!original.ok) throw new Error('quran-svg-page')
  return original.text()
}

async function drawPrintedPage(root: HTMLElement, page: number, select: (surah: number, ayah: number) => void): Promise<void> {
  root.replaceChildren(h('p', { role: 'status' }, `جارٍ فتح الصفحة ${page}…`))
  const documentSvg = new DOMParser().parseFromString(await loadMushafSvg(page), 'image/svg+xml'), svg = document.importNode(documentSvg.documentElement, true) as unknown as SVGSVGElement
  svg.classList.add('quran-page-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `صفحة المصحف رقم ${page}`)
  svg.querySelectorAll<SVGPathElement>('.ayahPolygon').forEach(path => { const surah = Number(path.getAttribute('surah')), ayah = Number(path.getAttribute('ayah')); path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); path.setAttribute('aria-label', `فتح خدمات سورة ${SURAH_NAMES[surah - 1] ?? surah} الآية ${ayah}`); const open = () => { svg.querySelectorAll('.ayahPolygon').forEach(item => item.classList.remove('is-selected')); path.classList.add('is-selected'); select(surah, ayah) }; path.addEventListener('click', open); path.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } }) })
  root.replaceChildren(svg)
}

async function drawOriginalSelectablePage(root: HTMLElement, page: number, pageRecords: PageMapRecord[], uthmani: Map<string, FullQuranAyah>, select: (surah: number, ayah: number, word?: string) => void): Promise<void> {
  root.replaceChildren(h('p', { role: 'status' }, `جارٍ فتح الصفحة ${page}…`))
  const documentSvg = new DOMParser().parseFromString(await loadMushafSvg(page), 'image/svg+xml'), svg = document.importNode(documentSvg.documentElement, true) as unknown as SVGSVGElement
  svg.classList.add('quran-page-svg'); svg.setAttribute('role', 'img'); svg.setAttribute('aria-label', `صفحة المصحف رقم ${page}`)
  const overlay = h('div', { class: 'quran-copy-overlay', 'aria-label': 'طبقة تحديد ونسخ نص الصفحة العثماني' })
  const records = pageRecords.filter(record => record.page === page)
  let suppressWordClickUntil = 0
  for (const record of records) {
    const path = svg.querySelector<SVGPathElement>(`.ayahPolygon[surah="${record.surah}"][ayah="${record.ayah}"]`)
    if (!path) continue
    const coordinates = (path.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number), xs = coordinates.filter((_, index) => index % 2 === 0), ys = coordinates.filter((_, index) => index % 2 === 1)
    if (!xs.length || !ys.length) continue
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    const verse = h('span', { class: 'quran-copy-overlay__ayah', style: `inset-inline-start:${minX / 235 * 100}%;inset-block-start:${minY / 235 * 100}%;inline-size:${(maxX - minX) / 235 * 100}%;block-size:${(maxY - minY) / 235 * 100}%`, dataset: { ayahId: record.ayahId } })
    const value = uthmani.get(record.ayahId)?.text ?? record.imlai
    const imlaiWords = record.imlai.trim().split(/\s+/), uthmaniParts = value.trim().split(/(\s+)/)
    let wordPosition = 0
    uthmaniParts.forEach(part => {
      if (!part || /^\s+$/.test(part)) { verse.append(document.createTextNode(part)); return }
      const word = h('span', { class: 'quran-copy-overlay__word', tabindex: 0, role: 'button', 'aria-label': `خدمات كلمة ${part}`, dataset: { imlai: imlaiWords[wordPosition] ?? part } }, part)
      wordPosition++
      const openWord = () => { if (performance.now() < suppressWordClickUntil) return; const selection = window.getSelection(); if (selection && !selection.isCollapsed) return; select(record.surah, record.ayah, part) }
      word.addEventListener('click', openWord); word.addEventListener('keydown', event => { if (event.key === 'Enter') openWord() }); verse.append(word)
    })
    overlay.append(verse)
    path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); path.setAttribute('aria-label', `فتح خدمات سورة ${SURAH_NAMES[record.surah - 1] ?? record.surah} الآية ${record.ayah}`)
    const openVerse = () => { svg.querySelectorAll('.ayahPolygon').forEach(item => item.classList.remove('is-selected')); path.classList.add('is-selected'); select(record.surah, record.ayah) }
    path.addEventListener('click', openVerse); path.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVerse() } })
  }
  const words = [...overlay.querySelectorAll<HTMLElement>('.quran-copy-overlay__word')]
  words.forEach((word, index) => { word.dataset.copyIndex = String(index) })
  const paintRange = (start: number, end: number) => {
    const low = Math.min(start, end), high = Math.max(start, end)
    words.forEach((word, index) => word.classList.toggle('is-range-selected', index >= low && index <= high))
  }
  const selectedCopy = (start: number, end: number, mode: 'uthmani' | 'imlai'): string => {
    const selected = words.slice(Math.min(start, end), Math.max(start, end) + 1)
    const groups: { surah: number; ayah: number; words: string[] }[] = []
    for (const word of selected) {
      const [surahText, ayahText] = (word.closest<HTMLElement>('.quran-copy-overlay__ayah')?.dataset.ayahId ?? '').split(':')
      const surah = Number(surahText), ayah = Number(ayahText), current = groups.at(-1)
      if (!Number.isInteger(surah) || !Number.isInteger(ayah)) continue
      const value = mode === 'imlai' ? word.dataset.imlai ?? word.textContent ?? '' : word.textContent ?? ''
      if (current && current.surah === surah && current.ayah === ayah) current.words.push(value)
      else groups.push({ surah, ayah, words: [value] })
    }
    const ranges: typeof groups[] = []
    for (const group of groups) {
      const current = ranges.at(-1), previous = current?.at(-1)
      if (current && previous && previous.surah === group.surah && previous.ayah + 1 === group.ayah) current.push(group)
      else ranges.push([group])
    }
    return ranges.map(range => formatQuranCopyRange(range.flatMap(group => group.words).join(' '), range[0]!.surah, range[0]!.ayah, range.at(-1)!.ayah)).join('\n')
  }
  const writeSelected = async (value: string): Promise<void> => {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(value); return }
    const input = document.createElement('textarea'); input.value = value; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select(); document.execCommand('copy'); input.remove()
  }
  const showSelectionMenu = (start: number, end: number, x: number, y: number): void => {
    document.querySelector('.quran-selection-menu')?.remove()
    const low = Math.min(start, end), high = Math.max(start, end), uthmaniText = selectedCopy(low, high, 'uthmani'), imlaiText = selectedCopy(low, high, 'imlai')
    if (!uthmaniText) return
    const menu = h('div', { class: 'reader__selection-menu quran-selection-menu', role: 'toolbar', 'aria-label': 'أدوات النص القرآني المحدد' })
    const close = () => menu.remove()
    const button = (label: string, run: () => void) => { const item = h('button', { type: 'button' }, label); item.addEventListener('click', () => { run(); close() }); return item }
    menu.append(
      button('نسخ عثماني', () => { void writeSelected(uthmaniText).then(() => toast('نُسخ النص بالرسم العثماني')) }),
      button('نسخ إملائي', () => { void writeSelected(imlaiText).then(() => toast('نُسخ النص بالرسم الإملائي')) }),
      button('تظليل', () => { words.slice(low, high + 1).forEach(word => word.classList.add('is-user-highlighted')); addHighlight('quran-hafs', page - 1, words.slice(low, high + 1).map(word => word.textContent ?? '').join(' '), 'important'); toast('حُفظ التظليل') }),
      button('في الخِزانة', () => window.open(`#/search?q=${encodeURIComponent(words.slice(low, high + 1).map(word => word.textContent ?? '').join(' '))}`, '_blank', 'noopener,noreferrer')),
      button('في Google', () => window.open(`https://www.google.com/search?q=${encodeURIComponent(words.slice(low, high + 1).map(word => word.textContent ?? '').join(' '))}`, '_blank', 'noopener,noreferrer')),
    )
    menu.style.insetInlineStart = `${Math.max(8, Math.min(window.innerWidth - Math.min(620, window.innerWidth - 16), x - 250))}px`
    menu.style.insetBlockStart = `${Math.max(70, y - 58)}px`
    document.body.append(menu)
  }
  for (const highlight of getAnnotations().highlights.filter(item => item.bookId === 'quran-hafs' && item.pageIndex === page - 1)) {
    const target = highlight.text.split(/\s+/).filter(Boolean), source = words.map(word => word.textContent ?? '')
    for (let start = 0; start <= source.length - target.length; start++) {
      if (target.every((value, offset) => source[start + offset] === value)) words.slice(start, start + target.length).forEach(word => word.classList.add('is-user-highlighted'))
    }
  }
  words.forEach(word => word.addEventListener('pointerdown', event => {
    if (event.button !== 0) return
    const start = Number(word.dataset.copyIndex), pointerId = event.pointerId
    let end = start, moved = false
    paintRange(start, end)
    const move = (moveEvent: PointerEvent) => {
      if (moveEvent.pointerId !== pointerId) return
      const next = quranWordIndexAtPoint(words, moveEvent.clientX, moveEvent.clientY)
      if (!Number.isFinite(next)) return
      moved ||= next !== start; end = next; paintRange(start, end); moveEvent.preventDefault()
    }
    const finish = (upEvent: PointerEvent) => {
      if (upEvent.pointerId !== pointerId) return
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      const low = Math.min(start, end), high = Math.max(start, end), selection = window.getSelection()
      if (selection && words[low] && words[high]) {
        const range = document.createRange(); range.setStartBefore(words[low]); range.setEndAfter(words[high])
        selection.removeAllRanges(); selection.addRange(range)
      }
      if (moved) {
        suppressWordClickUntil = performance.now() + 350
        showSelectionMenu(low, high, upEvent.clientX, upEvent.clientY)
      } else {
        paintRange(-2, -1)
        selection?.removeAllRanges()
        const [surahText, ayahText] = (word.closest<HTMLElement>('.quran-copy-overlay__ayah')?.dataset.ayahId ?? '').split(':')
        select(Number(surahText), Number(ayahText), word.textContent ?? undefined)
      }
    }
    window.addEventListener('pointermove', move, { passive: false })
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    event.preventDefault()
  }))
  activeQuranCopyCleanup?.()
  const copySelection = (event: ClipboardEvent) => {
    const selection = window.getSelection(); if (!selection?.rangeCount || selection.isCollapsed) return
    if (!selection.anchorNode || !overlay.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0), selectedParts: { text: string; surah: number; ayah: number }[] = []
    for (const verse of overlay.querySelectorAll<HTMLElement>('.quran-copy-overlay__ayah')) {
      if (!range.intersectsNode(verse)) continue
      const part = document.createRange(); part.selectNodeContents(verse)
      if (verse.contains(range.startContainer)) part.setStart(range.startContainer, range.startOffset)
      if (verse.contains(range.endContainer)) part.setEnd(range.endContainer, range.endOffset)
      const value = part.toString().replace(/\s+/g, ' ').trim(); if (!value) continue
      const [surahText, ayahText] = (verse.dataset.ayahId ?? '').split(':')
      selectedParts.push({ text: value, surah: Number(surahText), ayah: Number(ayahText) })
    }
    if (!selectedParts.length) return
    const groups: typeof selectedParts[] = []
    for (const part of selectedParts) {
      const current = groups.at(-1), previous = current?.at(-1)
      if (current && previous && previous.surah === part.surah && previous.ayah + 1 === part.ayah) current.push(part)
      else groups.push([part])
    }
    const copied = groups.map(group => formatQuranCopyRange(group.map(part => part.text).join(' '), group[0]!.surah, group[0]!.ayah, group.at(-1)!.ayah))
    event.preventDefault(); event.clipboardData?.setData('text/plain', copied.join('\n'))
  }
  document.addEventListener('copy', copySelection)
  activeQuranCopyCleanup = () => document.removeEventListener('copy', copySelection)
  const openingClass = page <= 2 ? ' quran-page-canvas--opening' : ' quran-page-canvas--standard'
  const viewBox = (svg.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number)
  const pageWidth = viewBox.length === 4 && viewBox[2]! > 0 ? viewBox[2]! : 1
  const pageHeight = viewBox.length === 4 && viewBox[3]! > 0 ? viewBox[3]! : 1
  root.replaceChildren(h('div', { class: `quran-page-canvas quran-page-canvas--facsimile${openingClass}`, style: `aspect-ratio:${pageWidth}/${pageHeight}` }, svg, overlay))
}

function drawSelectablePage(root: HTMLElement, page: number, pageRecords: PageMapRecord[], uthmani: Map<string, FullQuranAyah>, mode: 'uthmani' | 'imlai', select: (surah: number, ayah: number, word?: string) => void): void {
  const records = pageRecords.filter(record => record.page === page)
  const text = h('div', { class: `quran-selectable-page quran-selectable-page--${mode}`, dir: 'rtl', 'aria-label': `صفحة المصحف رقم ${page} بالرسم ${mode === 'uthmani' ? 'العثماني' : 'الإملائي'}` })
  const characterCount = records.reduce((sum, record) => sum + (mode === 'uthmani' ? uthmani.get(record.ayahId)?.text.length ?? record.imlai.length : record.imlai.length), 0)
  const fontSize = characterCount > 1350 ? .72 : characterCount > 1000 ? .82 : characterCount > 720 ? .94 : characterCount > 480 ? 1.08 : characterCount > 300 ? 1.25 : 1.55
  text.style.setProperty('--quran-page-font', `${fontSize}rem`)
  for (const record of records) {
    const value = mode === 'uthmani' ? uthmani.get(record.ayahId)?.text ?? record.imlai : record.imlai
    const verse = h('span', { class: 'quran-selectable-ayah', dataset: { ayahId: record.ayahId } })
    value.trim().split(/(\s+)/).forEach(part => {
      if (!part || /^\s+$/.test(part)) { verse.append(document.createTextNode(part)); return }
      const word = h('span', { class: 'quran-selectable-word', tabindex: 0, role: 'button', 'aria-label': `خدمات كلمة ${part}` }, part)
      const openWord = () => { const selection = window.getSelection(); if (selection && !selection.isCollapsed) return; text.querySelectorAll('.quran-selectable-word').forEach(item => item.classList.remove('is-selected')); word.classList.add('is-selected'); select(record.surah, record.ayah, part) }
      word.addEventListener('click', openWord); word.addEventListener('keydown', event => { if (event.key === 'Enter') openWord() }); verse.append(word)
    })
    verse.append(document.createTextNode(' '))
    const marker = h('button', { type: 'button', class: 'quran-selectable-marker', 'aria-label': `فتح خدمات سورة ${SURAH_NAMES[record.surah - 1] ?? record.surah} الآية ${record.ayah}` }, String(record.ayah)) as HTMLButtonElement
    marker.addEventListener('click', () => { text.querySelectorAll('.quran-selectable-ayah').forEach(item => item.classList.remove('is-selected')); verse.classList.add('is-selected'); select(record.surah, record.ayah) })
    text.append(verse, marker, document.createTextNode(' '))
  }
  root.replaceChildren(h('div', { class: 'quran-page-canvas' }, text))
}

function selectControl(title: string, options: { value: string; label: string }[], searchable = false): { label: HTMLLabelElement; select: HTMLSelectElement; setOptions: (next: { value: string; label: string }[]) => void } {
  let allOptions = options
  const select = h('select', { 'aria-label': title }) as HTMLSelectElement
  const fill = (items: { value: string; label: string }[]) => { const current = select.value; select.replaceChildren(...items.map(option => h('option', { value: option.value }, option.label))); if (items.some(item => item.value === current)) select.value = current }
  const search = searchable ? h('input', { type: 'search', class: 'quran-field__filter', placeholder: `صفِّ ${title}…`, 'aria-label': `تصفية ${title}` }) as HTMLInputElement : undefined
  search?.addEventListener('input', () => { const query = search.value.trim().toLocaleLowerCase('ar'); fill(query ? allOptions.filter(option => `${option.value} ${option.label}`.toLocaleLowerCase('ar').includes(query)) : allOptions) })
  const setOptions = (next: { value: string; label: string }[]) => { allOptions = next; if (search) search.value = ''; fill(next) }
  setOptions(options)
  return { select, setOptions, label: h('label', { class: `quran-field${searchable ? ' quran-field--searchable' : ''}` }, h('span', null, title), ...(search ? [search] : []), select) as HTMLLabelElement }
}

function renderSearchHub(root: HTMLElement, records: FullQuranAyah[], imlaiByAyah: ReadonlyMap<string, string>, navigate: (record: FullQuranAyah) => void): void {
  const candidates = fullQuranCandidates(records, imlaiByAyah), input = h('input', { type: 'search', placeholder: 'ابحث في القرآن الكريم…', 'aria-label': 'البحث في نص القرآن' }) as HTMLInputElement
  const sensitive = h('input', { type: 'checkbox' }) as HTMLInputElement
  const exact = h('input', { type: 'checkbox' }) as HTMLInputElement
  const rootMode = h('input', { type: 'checkbox' }) as HTMLInputElement
  const results = h('div', { class: 'quran-search-results' }), summary = h('p', { class: 'quran-search-summary', role: 'status', 'aria-live': 'polite' })
  let searchSequence = 0
  const update = async () => {
    const sequence = ++searchSequence
    const query = input.value.trim()
    if (rootMode.checked) {
      exact.disabled = true; sensitive.disabled = true
      if (query.length < 2) { summary.textContent = ''; results.replaceChildren(); return }
      summary.textContent = 'جارٍ البحث في مواد كلمات القرآن…'; results.replaceChildren()
      try {
        const rootResult = await searchQuranByRoot(query)
        if (sequence !== searchSequence) return
        const byId = new Map(records.map(record => [record.ayahId, record]))
        const grouped = new Map<string, typeof rootResult.occurrences>()
        for (const occurrence of rootResult.occurrences) { const id = `${occurrence.surah}:${occurrence.ayah}`; const list = grouped.get(id) ?? []; list.push(occurrence); grouped.set(id, list) }
        const ordered = canonicalQuranOrder([...grouped.keys()].map(id => ({ id })))
        summary.textContent = `${ordered.length} آية · ${rootResult.occurrences.length} كلمة من مادة «${rootResult.root}»`
        results.replaceChildren(...ordered.slice(0, 60).map(({ id }) => {
          const record = byId.get(id), occurrences = grouped.get(id) ?? []
          if (!record) return h('span', { hidden: true })
          const label = `سورة ${SURAH_NAMES[record.surah - 1] ?? record.surah} · الآية ${record.ayah}`
          const button = h('button', { class: 'quran-search-result', type: 'button' }, h('strong', null, label), h('span', null, record.text), h('small', null, occurrences.map(item => item.word).join(' · ')))
          button.addEventListener('click', () => { copy(formatQuranCopy(record.text, record.surah, record.ayah), `نُسخت ${label}`); navigate(record) })
          return button
        }))
      } catch {
        if (sequence === searchSequence) summary.textContent = 'تعذّر فتح فهرس الجذور المحلي الموثق.'
      }
      return
    }
    exact.disabled = false; sensitive.disabled = false
    let matches = canonicalQuranOrder(searchQuranCandidates(query, candidates, { respectTashkeel: sensitive.checked, fuzzy: false }))
    if (exact.checked) matches = matches.filter(match => matchesQuranPhrase(query, match.searchText ?? match.text, sensitive.checked))
    const byId = new Map(records.map(record => [record.ayahId, record]))
    const occurrences = countLogicalQuranOccurrences(query, matches.map(match => {
      const imlai = imlaiByAyah.get(match.id)
      return { uthmani: match.text, ...(imlai === undefined ? {} : { imlai }) }
    }), sensitive.checked)
    summary.textContent = query.length < 2 ? '' : `${matches.length} آية مطابقة · ${occurrences} موضعًا للعبارة`
    results.replaceChildren(...(query.length < 2 ? [] : matches.slice(0, 30).map(match => {
      const record = byId.get(match.id), label = record ? `سورة ${SURAH_NAMES[record.surah - 1] ?? record.surah} · الآية ${record.ayah}` : match.id
      const button = h('button', { class: 'quran-search-result', type: 'button' }, h('strong', null, label), h('span', null, match.text))
      if (record) button.addEventListener('click', () => { copy(formatQuranCopy(record.text, record.surah, record.ayah), `نُسخت ${label}`); navigate(record) })
      return button
    })))
  }
  input.addEventListener('input', () => { void update() }); sensitive.addEventListener('change', () => { void update() }); exact.addEventListener('change', () => { void update() }); rootMode.addEventListener('change', () => { void update() })
  root.replaceChildren(h('div', { class: 'quran-search-box' }, input, h('div', { class: 'quran-search-options' }, h('label', { class: 'quran-check' }, exact, h('span', null, 'مطابقة العبارة')), h('label', { class: 'quran-check' }, sensitive, h('span', null, 'مراعاة التشكيل')), h('label', { class: 'quran-check quran-check--root' }, rootMode, h('span', null, 'البحث بالجذر')))), summary, results)
}

type AudioEntry = QuranResource & { reciter?: string; riwaya?: string; chapterIds?: string[]; segmentation?: string; mediaBaseUrl?: string }
type AudioState = { entries: AudioEntry[] }
async function createAudioState(): Promise<AudioState> { try { const data = await loadQuranAudioCatalog(); return { entries: ((data as { entries?: AudioEntry[] }).entries ?? []).filter(entry => (entry.segmentation === 'chapter' || entry.segmentation === 'segment') && entry.mediaBaseUrl) } } catch { return { entries: [] } } }

function renderInspector(root: HTMLElement, tafsirRoot: HTMLElement, record: FullQuranAyah, imlai: string, audio: AudioState, modeSwitch: HTMLElement, selectedWord?: string): void {
  const tafsir = h('select', { 'aria-label': 'اختر التفسير' }, ...TAFSIRS.map((definition, index) => h('option', { value: String(index), ...(definition.slug ? {} : { disabled: true }) }, `${definition.name}${definition.slug ? '' : ' — قيد الربط'}`))) as HTMLSelectElement
  tafsir.value = String(TAFSIRS.findIndex(item => item.bookId === 2003))
  const tafsirStatus = h('article', { class: 'quran-tafsir-reading', role: 'status', 'aria-live': 'polite' }, 'اختر تفسيرًا لعرضه هنا داخل الخزانة.')
  const tafsirTools = h('div', { class: 'quran-tafsir-tools' })
  const updateTafsir = () => { const definition = TAFSIRS[Number(tafsir.value)]; if (definition && typeof definition.bookId === 'number' && definition.slug) void loadTafsir({ name: definition.name, bookId: definition.bookId, slug: definition.slug }, record, tafsirStatus, tafsirTools) }
  tafsir.addEventListener('change', updateTafsir)
  updateTafsir()
  const wordServiceStatus = h('article', { class: 'quran-word-service-status', role: 'status', 'aria-live': 'polite', hidden: true })
  const resourceTitles: Record<QuranVerseResourceKind, string> = { gharib: 'الغريب', qiraat: 'القراءات', tasrif: 'التصريف', irab: 'الإعراب' }
  const showLocalResource = async (kind: QuranVerseResourceKind): Promise<void> => {
    wordServiceStatus.hidden = false
    wordServiceStatus.replaceChildren(h('p', null, 'جارٍ فتح النص المحلي…'))
    try {
      const resource = await loadQuranVerseResource(kind, record.surah, record.ayah)
      if (!resource) {
        wordServiceStatus.replaceChildren(h('strong', null, resourceTitles[kind]), h('p', null, 'لا يوجد مدخل موثّق لهذه الآية في الحزمة المحلية الحالية.'))
        return
      }
      wordServiceStatus.replaceChildren(h('header', null, h('strong', null, resource.title), resource.author ? h('small', null, resource.author) : null), ...resource.entries.map(entry => h('p', null, entry.text)))
    } catch { wordServiceStatus.replaceChildren(h('p', { role: 'alert' }, 'تعذر فتح النص المحلي الآن.')) }
  }
  const wordServices = h('div', { class: 'quran-word-services' },
    action('الغريب', () => { void showLocalResource('gharib') }, 'quran-word-service quran-word-service--ready'),
    action('القراءات', () => { void showLocalResource('qiraat') }, 'quran-word-service quran-word-service--ready'),
    action('التصريف', () => { void showLocalResource('tasrif') }, 'quran-word-service quran-word-service--ready'),
    action('الإعراب', () => { void showLocalResource('irab') }, 'quran-word-service quran-word-service--ready'),
  )
  root.replaceChildren(
    h('section', { class: 'quran-selected', 'aria-labelledby': 'selected-ayah-title' }, modeSwitch, h('p', { class: 'eyebrow' }, `سورة ${SURAH_NAMES[record.surah - 1]} · الآية ${record.ayah}`), h('h2', { id: 'selected-ayah-title' }, selectedWord ? 'الكلمة المختارة' : 'الآية المختارة'), h('p', { class: 'quran-selected__text' }, selectedWord ?? record.text), h('div', { class: 'quran-word-panel' }, wordServices, wordServiceStatus)),
    audioPlayer(record, audio.entries),
  )
  tafsirRoot.replaceChildren(h('section', { class: 'quran-service quran-tafsir-panel' }, h('div', { class: 'quran-tafsir-selector' }, tafsir, tafsirTools), tafsirStatus))
}

async function loadTafsir(definition: TafsirDefinition & { bookId: number; slug: string }, record: FullQuranAyah, root: HTMLElement, toolsRoot?: HTMLElement): Promise<void> {
  const key = `${definition.bookId}:${record.ayahId}`, cached = tafsirCache.get(key)
  if (cached) { renderTafsirReading(root, cached, definition, record, toolsRoot); return }
  root.replaceChildren(h('p', null, `جارٍ تحميل ${definition.name}…`))
  try {
    const response = await fetch(`./quran/tafsir/${definition.slug}/${record.surah}.json`)
    if (!response.ok) throw new Error('tafsir-response')
    const payload = await response.json() as { name?: string; segments?: { from: number; to: number; text?: string }[] }
    const html = (payload.segments ?? []).filter(item => item.from <= record.ayah && item.to >= record.ayah).map(item => item.text ?? '').filter(Boolean).join('<hr>')
    if (!html) throw new Error('tafsir-empty')
    const value = { title: payload.name || definition.name, html }; tafsirCache.set(key, value)
    renderTafsirReading(root, value, definition, record, toolsRoot)
  } catch { root.replaceChildren(h('p', { role: 'alert' }, 'تعذر تحميل نص هذا التفسير الآن.'), action('إعادة المحاولة', () => { void loadTafsir(definition, record, root, toolsRoot) })) }
}

function renderTafsirReading(root: HTMLElement, value: { title: string; html: string }, definition: TafsirDefinition & { slug: string }, record: FullQuranAyah, toolsRoot?: HTMLElement): void {
  let size = 1.08
  const body = h('div', { class: 'quran-tafsir-body' }); body.append(sanitizedTafsirFragment(value.html)); body.style.setProperty('--tafsir-size', `${size}rem`)
  installTafsirSelectionTools(body, definition.slug, Math.max(0, record.ayah - 1))
  const minus = action('−', () => { size = Math.max(.85, size - .1); body.style.setProperty('--tafsir-size', `${size.toFixed(2)}rem`) }, 'quran-tafsir-zoom')
  const plus = action('+', () => { size = Math.min(1.8, size + .1); body.style.setProperty('--tafsir-size', `${size.toFixed(2)}rem`) }, 'quran-tafsir-zoom')
  minus.setAttribute('aria-label', 'تصغير نص التفسير'); plus.setAttribute('aria-label', 'تكبير نص التفسير')
  const tools = [minus, plus, h('a', { class: 'btn btn--ghost quran-tafsir-open', href: `#/reader/tafsir-${definition.slug}?surah=${record.surah}&ayah=${record.ayah}` }, 'افتحه ككتاب')]
  if (toolsRoot) { toolsRoot.replaceChildren(...tools); root.replaceChildren(body) }
  else root.replaceChildren(h('div', { class: 'quran-tafsir-toolbar' }, h('div', { class: 'quran-tafsir-tools' }, ...tools)), body)
}

function sanitizedTafsirFragment(value: string): DocumentFragment {
  const source = new DOMParser().parseFromString(value, 'text/html'), output = document.createDocumentFragment()
  const copyNode = (node: globalThis.Node, parent: ParentNode) => {
    if (node.nodeType === globalThis.Node.TEXT_NODE) { parent.append(document.createTextNode(node.textContent ?? '')); return }
    if (!(node instanceof HTMLElement)) return
    const tag = node.tagName.toLowerCase()
    if (tag === 'br') { parent.append(document.createElement('br')); return }
    if (tag === 'hr') { parent.append(document.createElement('hr')); return }
    const element = document.createElement(tag === 'p' ? 'p' : tag === 'div' ? 'div' : 'span')
    if (node.classList.contains('book-ayah')) element.className = 'quran-tafsir-ayah'
    node.childNodes.forEach(child => copyNode(child, element)); parent.append(element)
  }
  source.body.childNodes.forEach(node => copyNode(node, output)); return output
}

export function quranTafsirBookScreen(param: string): HTMLElement {
  if (!isFullQuranInstalled()) installFullQuran()
  const [slug = '', surahText, ayahText] = param.split('/')
  const redirectDefinition = TAFSIRS.find(item => item.slug === slug && item.bookId) as (TafsirDefinition & { bookId: number; slug: string }) | undefined
  if (redirectDefinition) {
    queueMicrotask(() => { location.hash = `#/reader/tafsir-${redirectDefinition.slug}` })
    return pageContent(h('p', { role: 'status', 'aria-live': 'polite' }, `جارٍ فتح ${redirectDefinition.name} في قارئ الكتب…`))
  }
  const definition = redirectDefinition as (TafsirDefinition & { bookId: number; slug: string }) | undefined
  const saved = definition ? readTafsirPosition(definition.slug) : undefined
  let surah = Math.min(114, Math.max(1, Number(surahText ?? saved?.surah ?? 1) || 1))
  let ayah = Math.max(1, Number(ayahText ?? saved?.ayah ?? 1) || 1)
  const page = pageContent(); page.classList.add('quran-tafsir-book', 'reader-like-book')
  const position = h('p', { class: 'quran-tafsir-book__position', 'aria-live': 'polite' })
  const reading = h('article', { class: 'quran-tafsir-book__reading', tabindex: 0 }, h('p', { role: 'status' }, 'جارٍ فتح التفسير…'))
  const previous = action('السابق', () => navigate(-1), 'quran-tafsir-book__nav')
  const next = action('التالي', () => navigate(1), 'quran-tafsir-book__nav')
  const surahSelect = h('select', { 'aria-label': 'الانتقال إلى سورة' }, ...SURAH_NAMES.map((name, index) => h('option', { value: String(index + 1) }, `${arabicNum(index + 1)}. ${name}`))) as HTMLSelectElement
  const ayahSelect = h('select', { 'aria-label': 'الانتقال إلى آية' }) as HTMLSelectElement
  surahSelect.value = String(surah)
  const info = h('aside', { class: 'quran-tafsir-book__card', hidden: true, 'aria-label': 'بطاقة كتاب التفسير' },
    h('strong', null, definition?.name ?? 'التفسير'),
    h('p', null, definition?.author ?? 'مؤلف غير موثق'),
    h('dl', null, h('div', null, h('dt', null, 'المصدر'), h('dd', null, 'نص تفسير محلي داخل الخزانة')), h('div', null, h('dt', null, 'الارتباط'), h('dd', null, 'مرتبط بالسور والآيات'))),
  )
  const infoButton = action('معلومات الكتاب', () => { info.hidden = !info.hidden }, 'quran-tafsir-book__info')
  const header = h('header', { class: 'quran-tafsir-book__header' },
    h('a', { class: 'btn btn--ghost', href: '#/quran' }, 'العودة إلى المصحف'),
    h('p', { class: 'eyebrow' }, 'كتاب تفسير في مكتبتي'), h('h1', null, definition?.name ?? 'التفسير'),
    definition?.author ? h('p', { class: 'quran-tafsir-book__author' }, definition.author) : null,
    position,
    h('div', { class: 'quran-tafsir-book__navigation' }, previous, surahSelect, ayahSelect, next),
  )
  const toolbar = h('footer', { class: 'reader__toolbar quran-tafsir-book__toolbar' }, h('div', { class: 'reader__toolbar-inner' },
    h('a', { class: 'tool-btn', href: '#/quran' }, 'المصحف'), infoButton,
    action('نسخ النص', () => copy(reading.innerText, 'نُسخ نص التفسير'), 'tool-btn'),
    action('بحث في الخزانة', () => { location.hash = `#/search?q=${encodeURIComponent(reading.innerText.slice(0, 120))}&mode=exact` }, 'tool-btn'),
  ))
  page.append(header, info, reading, toolbar)
  let records: FullQuranAyah[] = []
  let currentIndex = -1
  const fillAyahs = () => {
    const count = records.filter(item => item.surah === surah).length || ayah
    ayahSelect.replaceChildren(...Array.from({ length: count }, (_, index) => h('option', { value: String(index + 1) }, `الآية ${arabicNum(index + 1)}`)))
    ayah = Math.min(count, Math.max(1, ayah)); ayahSelect.value = String(ayah)
  }
  const open = async () => {
    if (!definition) { reading.replaceChildren(h('p', { role: 'alert' }, 'تعذر تحديد كتاب التفسير.')); return }
    position.textContent = `سورة ${SURAH_NAMES[surah - 1] ?? surah} · الآية ${arabicNum(ayah)}`
    localStorage.setItem(`khizana:quran-tafsir-position:${definition.slug}`, JSON.stringify({ surah, ayah }))
    currentIndex = records.findIndex(item => item.surah === surah && item.ayah === ayah)
    previous.disabled = currentIndex <= 0; next.disabled = currentIndex < 0 || currentIndex >= records.length - 1
    await loadTafsir(definition, { ayahId: `${surah}:${ayah}`, surah, ayah, text: '' }, reading)
    installTafsirSelectionTools(reading, definition.slug, currentIndex)
  }
  function navigate(step: number): void {
    const target = records[currentIndex + step]
    if (!target || !definition) return
    surah = target.surah; ayah = target.ayah
    location.hash = `#/quran/tafsir/${definition.slug}/${surah}/${ayah}`
  }
  surahSelect.addEventListener('change', () => { surah = Number(surahSelect.value); ayah = 1; fillAyahs(); void open() })
  ayahSelect.addEventListener('change', () => { ayah = Number(ayahSelect.value); void open() })
  void loadFullQuran().then(payload => { records = payload.records; fillAyahs(); void open() }).catch(() => { reading.replaceChildren(h('p', { role: 'alert' }, 'تعذر فتح فهرس آيات التفسير الآن.')) })
  return page
}

function readTafsirPosition(slug: string): { surah: number; ayah: number } | undefined {
  try {
    const value = JSON.parse(localStorage.getItem(`khizana:quran-tafsir-position:${slug}`) ?? 'null') as { surah?: number; ayah?: number } | null
    return value && Number.isInteger(value.surah) && Number.isInteger(value.ayah) ? { surah: value.surah!, ayah: value.ayah! } : undefined
  } catch { return undefined }
}

function installTafsirSelectionTools(reading: HTMLElement, slug: string, position: number): void {
  reading.onpointerup = () => {
    const selection = window.getSelection(), text = selection?.toString().trim() ?? ''
    reading.querySelector('.quran-tafsir-selection')?.remove()
    if (!text || !selection?.rangeCount || !reading.contains(selection.anchorNode)) return
    const menu = h('div', { class: 'quran-tafsir-selection', role: 'toolbar', 'aria-label': 'أدوات النص المحدد' })
    const done = () => { menu.remove(); selection.removeAllRanges() }
    const button = (label: string, run: () => void) => action(label, () => { run(); done() })
    menu.append(
      button('نسخ', () => copy(text, 'نُسخ النص المحدد')),
      button('ترجمة', () => openTranslationDialog(text)),
      button('تظليل', () => {
        addHighlight(`quran-tafsir-${slug}`, Math.max(0, position), text, 'important', 0)
        const range = selection.getRangeAt(0), mark = h('mark', { class: 'reader-highlight', dataset: { highlightColor: 'important' } })
        try { mark.append(range.extractContents()); range.insertNode(mark) } catch { /* يبقى التظليل محفوظًا ولو تعذر لف عناصر مركبة */ }
        toast('حُفظ التظليل')
      }),
      button('في الخزانة', () => { window.open(new URL(`#/search?q=${encodeURIComponent(text)}&mode=exact`, location.href).href, '_blank', 'noopener,noreferrer') }),
      button('في Google', () => { window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer') }),
    )
    reading.appendChild(menu)
  }
}

export function formatQuranCopy(text: string, surah: number, ayah: number): string {
  return `﴿${text.trim()}﴾ [${SURAH_NAMES[surah - 1] ?? surah}: ${ayah}]`
}

export function formatQuranCopyRange(text: string, surah: number, firstAyah: number, lastAyah: number): string {
  if (firstAyah === lastAyah) return formatQuranCopy(text, surah, firstAyah)
  return `﴿${text.trim()}﴾ [${SURAH_NAMES[surah - 1] ?? surah}: ${firstAyah} - ${lastAyah}]`
}

function copyAction(shortLabel: string, label: string, run: () => void): HTMLButtonElement {
  const button = h('button', { class: 'quran-copy-button', type: 'button', 'aria-label': `نسخ ${label}` },
    h('span', { class: 'quran-copy-button__icon', 'aria-hidden': 'true' }, h('span', null), h('span', null)),
    h('span', { class: 'quran-copy-button__text' }, h('strong', null, `نسخ ${shortLabel}`), h('small', null, label)),
  ) as HTMLButtonElement
  button.addEventListener('click', run)
  return button
}

function audioPlayer(record: FullQuranAyah, entries: AudioEntry[]): HTMLElement {
  const available = entries.filter(entry => entry.chapterIds?.includes(String(record.surah))).sort((a, b) => Number(a.segmentation === 'segment') - Number(b.segmentation === 'segment'))
  const unique = [...new Map(available.map(entry => [`${entry.reciter}|${entry.riwaya}`, entry])).values()]
  const audioKey = quranAudioEntryKey
  const select = h('select', { 'aria-label': 'اختر القارئ والرواية' }) as HTMLSelectElement
  const filter = h('input', { type: 'search', class: 'quran-audio-filter', placeholder: 'ابحث باسم القارئ أو الرواية…', 'aria-label': 'تصفية القراء والروايات' }) as HTMLInputElement
  const filterStatus = h('p', { class: 'quran-audio-filter__status', role: 'status', 'aria-live': 'polite' })
  const fillReaders = () => {
    const query = filter.value
    const selectedKey = preferredAudioKey || loadQuranAudioReader() || audioKey(unique[Number(select.value)] ?? {})
    const options = filterQuranAudioEntries(unique, query)
    select.replaceChildren(...options.map(({ entry, index }) => h('option', { value: String(index) }, `${entry.reciter ?? 'قارئ'} — ${entry.riwaya ?? 'رواية'}`)))
    select.size = query ? Math.min(6, Math.max(1, options.length)) : 1
    filterStatus.textContent = query ? `عُثر على ${options.length} من القراء والروايات` : ''
    const preferred = options.find(({ entry }) => audioKey(entry) === selectedKey) ?? options[0]
    if (preferred) select.value = String(preferred.index)
  }
  fillReaders(); filter.addEventListener('input', fillReaders)
  const player = h('audio', { class: 'quran-audio-element' }) as HTMLAudioElement; player.preload = 'none'
  const play = h('button', { type: 'button', class: 'quran-audio-button quran-audio-play', 'aria-label': 'تشغيل التلاوة' }, '▶') as HTMLButtonElement
  const back = h('button', { type: 'button', class: 'quran-audio-button', 'aria-label': 'الرجوع عشر ثوان' }, '−10') as HTMLButtonElement
  const forward = h('button', { type: 'button', class: 'quran-audio-button', 'aria-label': 'التقدم عشر ثوان' }, '+10') as HTMLButtonElement
  const timeline = h('input', { type: 'range', class: 'quran-audio-timeline', min: '0', max: '1000', value: '0', 'aria-label': 'موضع التلاوة' }) as HTMLInputElement
  const elapsed = h('span', { class: 'quran-audio-time' }, '0:00 / 0:00')
  const speed = h('select', { class: 'quran-audio-speed', 'aria-label': 'سرعة التلاوة' }, ...[.75, 1, 1.25, 1.5, 2].map(value => h('option', { value: String(value), ...(value === 1 ? { selected: true } : {}) }, `×${value}`))) as HTMLSelectElement
  const selectedAudioEntry = () => { const value = select.selectedOptions[0]?.value; return value === undefined ? undefined : unique[Number(value)] }
  const ensureSource = () => { const entry = selectedAudioEntry(); if (!entry?.mediaBaseUrl) return false; const url = quranAudioUrl(entry, record.surah, record.ayah); if (player.src !== new URL(url, document.baseURI).href) player.src = url; return true }
  play.addEventListener('click', () => { if (!ensureSource()) return; if (player.paused) void player.play().catch(() => toast('تعذر تشغيل التلاوة الآن')); else player.pause() })
  back.addEventListener('click', () => { player.currentTime = Math.max(0, player.currentTime - 10) })
  forward.addEventListener('click', () => { player.currentTime = Math.min(Number.isFinite(player.duration) ? player.duration : player.currentTime + 10, player.currentTime + 10) })
  timeline.addEventListener('input', () => { if (Number.isFinite(player.duration)) player.currentTime = Number(timeline.value) / 1000 * player.duration })
  speed.addEventListener('change', () => { player.playbackRate = Number(speed.value) })
  select.addEventListener('change', () => { const picked = selectedAudioEntry(); if (picked) { preferredAudioKey = audioKey(picked); saveQuranAudioReader(preferredAudioKey) } player.pause(); player.removeAttribute('src'); player.load(); play.textContent = '▶'; play.setAttribute('aria-label', 'تشغيل التلاوة'); timeline.value = '0'; elapsed.textContent = '0:00 / 0:00' })
  player.addEventListener('play', () => { play.textContent = '❚❚'; play.setAttribute('aria-label', 'إيقاف التلاوة مؤقتًا') })
  player.addEventListener('pause', () => { play.textContent = '▶'; play.setAttribute('aria-label', 'تشغيل التلاوة') })
  player.addEventListener('timeupdate', () => { const duration = Number.isFinite(player.duration) ? player.duration : 0; timeline.value = duration ? String(Math.round(player.currentTime / duration * 1000)) : '0'; elapsed.textContent = `${audioTime(player.currentTime)} / ${audioTime(duration)}` })
  player.addEventListener('ended', () => { timeline.value = '0' })
  return h('section', { class: 'quran-service quran-audio-card' }, h('div', { class: 'quran-audio-heading' }, h('h2', null, 'استماع القرآن الكريم'), h('span', { class: 'quran-audio-badge' }, `سورة ${SURAH_NAMES[record.surah - 1]}`)), unique.length ? h('div', { class: 'quran-audio-panel' }, filter, filterStatus, select, h('div', { class: 'quran-audio-transport' }, play, back, forward, elapsed, speed), timeline, player, h('p', { class: 'quran-hint' }, 'يبدأ تحميل الصوت عند الضغط على التشغيل فقط.')) : h('p', null, 'لا توجد تلاوة متاحة لهذه السورة الآن.'))
}

export function quranAudioUrl(entry: Pick<AudioEntry, 'segmentation' | 'mediaBaseUrl'>, surah: number, ayah: number): string {
  const base = (entry.mediaBaseUrl ?? '').replace(/\/$/, '')
  const chapter = String(surah).padStart(3, '0')
  return entry.segmentation === 'segment' ? `${base}/${chapter}${String(ayah).padStart(3, '0')}.mp3` : `${base}/${chapter}.mp3`
}
function audioTime(value: number): string { const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
function action(label: string, run: () => void, extraClass = ''): HTMLButtonElement { const button = h('button', { class: `btn btn--ghost ${extraClass}`.trim() }, label) as HTMLButtonElement; button.addEventListener('click', run); return button }
function copy(text: string, success: string): void { void navigator.clipboard?.writeText(text).then(() => toast(success)).catch(() => toast('تعذر النسخ')) }
function retryButton(retry: () => void): HTMLButtonElement { return action('إعادة المحاولة', retry) }
