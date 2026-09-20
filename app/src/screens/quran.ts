import {isSourceEditionTafsir, loadSourceEditionTafsir, type SourceEditionTafsirDefinition} from '../quran_source_editions'
import {sanitizedTafsirFragment} from '../tafsir_html'
import {tafsirVerseExcerpt} from '../tafsir_verse_excerpt'
import type {SourceEditionBookLink} from '../quran_source_book_links'
import {uiTemplateText,uiTemplateAttribute,uiLabelParameter,renderBoundUiTemplate} from '../ui_template_binding'
import { pageContent } from '../components'
import {fetchQuranResource} from '../quran_fetch'
import { fullQuranCandidates, installFullQuran, isFullQuranInstalled, loadFullQuran, loadQuranAudioCatalog, type FullQuranAyah, type QuranResource } from '../quran_full_pack'
import { canonicalQuranOrder, countLogicalQuranOccurrences, matchesQuranPhrase, searchQuranCandidates } from '../quran_search_contract'
import { arabicNum, h, toast } from '../ui'
import { addHighlight, getAnnotations } from '../annotation_store'
import {annotationEditorBoundary} from '../annotation_editor_boundary'
import { openTranslationDialog } from '../translation'
import { buildRichClipboard, writeRichClipboard } from '../rich_clipboard'
import {openQuotePublishDialog} from '../quote_publish_form'
import {captureRouteResourceScope} from '../resource_lifecycle'
import {markReaderSearchOccurrence} from '../reader_in_book_search'
import { loadQuranVerseResource, type QuranVerseResourceKind } from '../quran_resource_pack'
import { loadQuranAudioReader, loadQuranReadingMode, saveQuranAudioReader, saveQuranReadingMode, type QuranReadingMode } from '../quran_view_preferences'
import { filterQuranAudioEntries, quranAudioEntryKey } from '../quran_audio_filter'
import { searchQuranByRoot } from '../quran_root_search'
import { QuranTafsirSession } from '../quran_tafsir_session'
import { loadLocalTafsir } from '../quran_tafsir_pack'
import { icon } from '../icons'
import { silentSkeleton } from '../silent_skeleton'
import { SELECTABLE_TAFSIRS as TAFSIRS, isReadyBokTafsir, isIndexedVerseBook, isLinkedTafsir, linkedTafsirBySlug, tafsirDisplayName, tafsirReaderHref, type LinkedTafsirDefinition } from '../quran_tafsir_registry'
import { parseQuranRouteState, quranRouteHash } from '../quran_route_state'
import { buildQuranNavigationIndex, quranNavigationTarget, readSavedQuranPosition } from '../quran_navigation_index'

export const LOCAL_QURAN_FEATURE = true
const SURAH_NAMES = 'الفاتحة|البقرة|آل عمران|النساء|المائدة|الأنعام|الأعراف|الأنفال|التوبة|يونس|هود|يوسف|الرعد|إبراهيم|الحجر|النحل|الإسراء|الكهف|مريم|طه|الأنبياء|الحج|المؤمنون|النور|الفرقان|الشعراء|النمل|القصص|العنكبوت|الروم|لقمان|السجدة|الأحزاب|سبأ|فاطر|يس|الصافات|ص|الزمر|غافر|فصلت|الشورى|الزخرف|الدخان|الجاثية|الأحقاف|محمد|الفتح|الحجرات|ق|الذاريات|الطور|النجم|القمر|الرحمن|الواقعة|الحديد|المجادلة|الحشر|الممتحنة|الصف|الجمعة|المنافقون|التغابن|الطلاق|التحريم|الملك|القلم|الحاقة|المعارج|نوح|الجن|المزمل|المدثر|القيامة|الإنسان|المرسلات|النبأ|النازعات|عبس|التكوير|الانفطار|المطففين|الانشقاق|البروج|الطارق|الأعلى|الغاشية|الفجر|البلد|الشمس|الليل|الضحى|الشرح|التين|العلق|القدر|البينة|الزلزلة|العاديات|القارعة|التكاثر|العصر|الهمزة|الفيل|قريش|الماعون|الكوثر|الكافرون|النصر|المسد|الإخلاص|الفلق|الناس'.split('|')
const tafsirCache = new Map<string, { title: string; html: string; hasDirectCommentary: boolean; sharedSourceRange?:{from:number;to:number} }>()
const tafsirLoadGeneration=new WeakMap<HTMLElement,number>()
const tafsirVerseTexts=new Map<number,string[]>()
let activeQuranCopyCleanup: (() => void) | undefined
let preferredAudioKey = ''
export type QuranRepeatCount = 1 | 3 | 7 | 'infinity'
let preferredRepeatCount: QuranRepeatCount = 1
let activeQuranAudioCleanup: (() => void) | undefined
let quranAudioAdvance: ((record: FullQuranAyah, segmentation?: string) => void) | undefined
let quranAudioAutoplayAyah = ''
const mushafSvgCache = new Map<number, Promise<string>>()
const MUSHAF_SVG_CACHE_LIMIT = 9

export function quranScreen(): HTMLElement {
  activeQuranAudioCleanup?.(); activeQuranAudioCleanup = undefined; quranAudioAdvance = undefined; quranAudioAutoplayAyah = ''
  if (!isFullQuranInstalled()) installFullQuran()
  const page = pageContent(); page.classList.add('quran-page', 'quran-reader')
  const search = h('section', { class: 'quran-search-hub', 'aria-labelledby': 'quran-title' })
  const reader = h('main', { class: 'quran-mushaf', 'aria-labelledby': 'quran-title' })
  const details = h('aside', { class: 'quran-inspector quran-inspector--tools', 'aria-label': 'خدمات الآية المختارة' })
  const tafsirDetails = h('aside', { class: 'quran-inspector quran-inspector--tafsir', 'aria-label': 'تفسير الآية المختارة' })
  page.append(
    h('section', { class: 'quran-reader__hero', 'aria-labelledby': 'quran-title' },
      h('img', { class: 'quran-reader__art quran-reader__art--start', src: './quran/header/open-quran-on-rehal-transparent.png', alt: '', 'aria-hidden': 'true' }),
      h('header', { class: 'quran-reader__header' }, h('h1', { id: 'quran-title' }, 'القرآن الكريم'), h('p', null, 'اقرأ، وابحث، وانتقل بين السور والآيات؛ وانقر أي آية لعرض تفسيرها وتلاوتها وخيارات نسخها.')),
      h('img', { class: 'quran-reader__art quran-reader__art--end', src: './quran/header/quran-calligraphy-medallion-transparent.png', alt: '', 'aria-hidden': 'true' }),
      search,
    ),
    h('div', { class: 'quran-reader__layout' }, details, reader, tafsirDetails),
  )
  void renderQuran(reader, details, tafsirDetails, search)
  return page
}

async function renderQuran(reader: HTMLElement, details: HTMLElement, tafsirDetails: HTMLElement, searchRoot: HTMLElement, retry = false): Promise<void> {
  reader.replaceChildren(silentSkeleton('reading'))
  try {
    const [payload, pageMap] = await Promise.all([loadFullQuran(retry), loadPageMap(retry)]), groups = new Map<number, FullQuranAyah[]>()
    if(!reader.isConnected)return
    tafsirVerseTexts.clear()
    for(const record of pageMap.records){const texts=tafsirVerseTexts.get(record.surah)??[];texts.push(record.imlai);tafsirVerseTexts.set(record.surah,texts)}
    for (const record of payload.records) { const list = groups.get(record.surah) ?? []; list.push(record); groups.set(record.surah, list) }
    const uthmani = new Map(payload.records.map(record => [record.ayahId, record])), byId = new Map(pageMap.records.map(record => [record.ayahId, record])), navigationIndex=buildQuranNavigationIndex(pageMap.records)
    const savedView = (() => {
      try {
        const value = JSON.parse(localStorage.getItem('khizana-quran-position') ?? 'null') as { surah?: number; ayah?: number; page?: number; mushaf?: string } | null
        if (!value || !Number.isInteger(value.surah) || !Number.isInteger(value.ayah) || !Number.isInteger(value.page)) return undefined
        return value
      } catch { return undefined }
    })()
    const routeView = parseQuranRouteState(routeLocation.hash)
    const routedPosition = routeView
      ? pageMap.records.find(record => record.surah === routeView.surah && record.ayah === routeView.ayah)
      : undefined
    const localSavedPosition=savedView?pageMap.records.find(record=>record.surah===savedView.surah&&record.ayah===savedView.ayah&&record.page===savedView.page):undefined
    const savedPosition = routedPosition ?? localSavedPosition
    const initialLastPosition=readSavedQuranPosition(localStorage)??localSavedPosition
    const initialSelected = (savedPosition ? uthmani.get(savedPosition.ayahId) : undefined) ?? payload.records[0]!
    const tafsirSession = new QuranTafsirSession(TAFSIRS.findIndex(item => isLinkedTafsir(item) && item.bookId === 2003))
    const state = { surah: initialSelected.surah, page: savedPosition?.page ?? 1, selected: initialSelected }
    const surah = selectControl('السورة', SURAH_NAMES.map((name, index) => ({ value: String(index + 1), label: `${index + 1}. ${name}` })), true)
    const ayah = selectControl('الآية', [], true)
    const page = selectControl('الصفحة', Array.from({ length: 604 }, (_, index) => ({ value: String(index + 1), label: String(index + 1) })), true)
    const juz = selectControl('الجزء', Array.from({length:30},(_,index)=>({value:String(index+1),label:String(index+1)})), true)
    const hizb = selectControl('الحزب', Array.from({length:60},(_,index)=>({value:String(index+1),label:String(index+1)})), true)
    const mushaf = selectControl('المصحف والرواية', [{ value: 'hafs-uthmani', label: 'مصحف المدينة — حفص عن عاصم' }, { value: 'warsh', label: 'ورش عن نافع — قيد الإضافة' }, { value: 'qalun', label: 'قالون عن نافع — قيد الإضافة' }])
    mushaf.select.value = savedView?.mushaf === 'hafs-uthmani' ? savedView.mushaf : 'hafs-uthmani'
    surah.select.value = String(state.surah)
    page.select.value = String(state.page)
    const sheet = h('div', { class: 'quran-printed-page', 'aria-live': 'polite' })
    uiTemplateAttribute(sheet,'data-ui-busy-label','9e107edfd1b53323',{})
    let readingMode: QuranReadingMode = loadQuranReadingMode()
    let pageZoom = Math.min(180, Math.max(100, Number(localStorage.getItem('khizana-quran-page-zoom') ?? 100) || 100))
    const zoomValue = h('output', { class: 'quran-page-zoom__value', 'aria-live': 'polite' }, `${pageZoom}٪`)
    const applyPageZoom = () => {
      sheet.style.setProperty('--quran-page-zoom', readingMode === 'reading' ? String(pageZoom / 100) : '1')
      sheet.style.setProperty('--quran-text-zoom', readingMode === 'reading' ? '1' : String(pageZoom / 100))
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
    const readingButton = h('button', {type:'button',class:`quran-reading-mode${readingMode==='reading'?' is-active':''}`,'aria-label':'عرض صفحة المصحف المطبوعة'}, 'قراءة') as HTMLButtonElement
    readingButton.setAttribute('aria-pressed',String(readingMode==='reading'))
    const modeSwitch = h('section', { class: 'quran-reading-modes quran-reading-modes--compact', 'aria-label': 'اختيار رسم نص المصحف' }, readingButton, uthmaniMode, imlaiMode)
    let drawRevision=0
    // Script choice changes only the page, not the selected verse, commentary,
    // navigation controls or audio player. Keep async page races fenced.
    const paintPage = async (isCurrent:()=>boolean) => {
      const openSelection = (surahNumber: number, ayahNumber: number, word?: string) => { const picked = uthmani.get(`${surahNumber}:${ayahNumber}`), imlai = byId.get(`${surahNumber}:${ayahNumber}`); if (!picked || !imlai) return; state.surah = surahNumber; state.selected = picked; surah.select.value = String(surahNumber); ayah.setOptions((groups.get(surahNumber) ?? []).map(item => ({ value: String(item.ayah), label: String(item.ayah) }))); ayah.select.value = String(ayahNumber); renderInspector(details, tafsirDetails, picked, imlai.imlai, audioState, modeSwitch, tafsirSession, word) }
      activeQuranCopyCleanup?.(); activeQuranCopyCleanup=undefined
      if (readingMode === 'reading') {
        try { await drawOriginalSelectablePage(sheet, state.page, pageMap.records, uthmani, openSelection,isCurrent) }
        catch { if(isCurrent())drawSelectablePage(sheet, state.page, pageMap.records, uthmani, 'uthmani', openSelection) }
      } else drawSelectablePage(sheet, state.page, pageMap.records, uthmani, readingMode, openSelection)
    }
    const draw = async (focusAyah?: number, highlightSearchTarget = false) => {
      const revision=++drawRevision,isCurrent=()=>reader.isConnected&&revision===drawRevision
      state.surah = Number(surah.select.value); const records = groups.get(state.surah) ?? []
      ayah.setOptions(records.map(record => ({ value: String(record.ayah), label: String(record.ayah) })))
      if (focusAyah) ayah.select.value = String(focusAyah)
      const target = Number(ayah.select.value || focusAyah || 1), selected = records.find(item => item.ayah === target) ?? records[0], mapped = selected ? byId.get(selected.ayahId) : undefined
      if (mapped) { state.page = mapped.page; page.select.value = String(mapped.page); juz.select.value=String(Math.max(1,navigationIndex.juz.filter(target=>target.page<=mapped.page).length));hizb.select.value=String(Math.max(1,navigationIndex.hizb.filter(target=>target.page<=mapped.page).length)) }
      title.replaceChildren(uiTemplateText('cbb0a0ac906682d3',{p1:uiLabelParameter(SURAH_NAMES[state.surah - 1] ?? String(state.surah)),p2:state.page}))
      await paintPage(isCurrent)
      if(!isCurrent())return
      if (highlightSearchTarget && selected) {
        const targetVerse = [...sheet.querySelectorAll<HTMLElement>('[data-ayah-id]')].find(element => element.dataset.ayahId === selected.ayahId)
        if (targetVerse?.classList.contains('quran-copy-overlay__ayah')) targetVerse.querySelectorAll<HTMLElement>('.quran-copy-overlay__word').forEach(word => word.classList.add('is-search-target'))
        else targetVerse?.classList.add('is-search-target')
      }
      if (selected && mapped) {
        state.selected = selected
        localStorage.setItem('khizana-quran-position', JSON.stringify({ ayahId:selected.ayahId, surah: selected.surah, ayah: selected.ayah, page: mapped.page, mushaf: mushaf.select.value }))
        const canonicalHash = quranRouteHash({ surah: selected.surah, ayah: selected.ayah, page: mapped.page })
        if (routeLocation.hash !== canonicalHash) history.replaceState(history.state, '', legacyHashToPath(canonicalHash))
        renderInspector(details, tafsirDetails, selected, mapped.imlai, audioState, modeSwitch, tafsirSession)
      }
    }
    surah.select.addEventListener('change', () => { void draw(1) })
    ayah.select.addEventListener('change', () => { void draw(Number(ayah.select.value)) })
    page.select.addEventListener('change', () => { state.page = Number(page.select.value); const first = pageMap.records.find(record => record.page === state.page); if (first) { surah.select.value = String(first.surah); void draw(first.ayah) } })
    const jumpToNavigationTarget=(target:ReturnType<typeof quranNavigationTarget>)=>{if(!target)return;surah.select.value=String(target.surah);void draw(target.ayah)}
    juz.select.addEventListener('change',()=>jumpToNavigationTarget(quranNavigationTarget(navigationIndex,'juz',Number(juz.select.value))))
    hizb.select.addEventListener('change',()=>jumpToNavigationTarget(quranNavigationTarget(navigationIndex,'hizb',Number(hizb.select.value))))
    mushaf.select.addEventListener('change', () => { if (mushaf.select.value !== 'hafs-uthmani') { toast('هذا المصحف قيد الإضافة؛ بقي مصحف حفص ظاهرًا'); mushaf.select.value = 'hafs-uthmani' } })
    const setReadingMode = (mode: QuranReadingMode) => {
      if(mode===readingMode)return
      readingMode = mode; saveQuranReadingMode(mode); applyPageZoom()
      for(const [button,value] of [[readingButton,'reading'],[uthmaniMode,'uthmani'],[imlaiMode,'imlai']] as const){button.classList.toggle('is-active',mode===value);button.setAttribute('aria-pressed',String(mode===value))}
      const revision=++drawRevision
      void paintPage(()=>reader.isConnected&&revision===drawRevision)
    }
    uthmaniMode.addEventListener('click', () => setReadingMode('uthmani')); imlaiMode.addEventListener('click', () => setReadingMode('imlai'))
    readingButton.addEventListener('click',()=>setReadingMode('reading'))
    const audioState: AudioState = { entries: [] }
    quranAudioAdvance = (current, segmentation) => {
      const nextRecord = nextQuranAudioRecord(payload.records, current, segmentation)
      if (!nextRecord) return
      quranAudioAutoplayAyah = nextRecord.ayahId
      surah.select.value = String(nextRecord.surah)
      void draw(nextRecord.ayah)
    }
    const previous = action('‹', () => { if (state.page <= 1) return; page.select.value = String(state.page - 1); page.select.dispatchEvent(new Event('change')) }, 'quran-page-arrow')
    const next = action('›', () => { if (state.page >= 604) return; page.select.value = String(state.page + 1); page.select.dispatchEvent(new Event('change')) }, 'quran-page-arrow')
    const beginning=action('بداية المصحف',()=>jumpToNavigationTarget(quranNavigationTarget(navigationIndex,'start')),'quran-navigation__shortcut')
    const lastPosition=action('آخر موضع',()=>jumpToNavigationTarget(initialLastPosition),'quran-navigation__shortcut')
    lastPosition.disabled=!initialLastPosition
    previous.setAttribute('aria-label', 'الصفحة السابقة'); next.setAttribute('aria-label', 'الصفحة التالية')
    beginning.replaceChildren(icon('book',18));beginning.setAttribute('aria-label','بداية المصحف');beginning.title='بداية المصحف'
    lastPosition.replaceChildren(icon('bookmark',18));lastPosition.setAttribute('aria-label','آخر موضع');lastPosition.title='آخر موضع'
    const syncNavigation=()=>{for(const field of [surah,ayah,page,juz,hizb])field.sync()}
    const navigationObserver=new MutationObserver(syncNavigation)
    navigationObserver.observe(title,{childList:true,subtree:true});captureRouteResourceScope().add(()=>navigationObserver.disconnect())
    reader.addEventListener('change',()=>queueMicrotask(syncNavigation))
    reader.addEventListener('click',event=>{if((event.target as Element)?.closest('.quran-printed-page'))queueMicrotask(syncNavigation)})
    reader.replaceChildren(zoomControls, sheet, h('section',{class:'quran-navigation-shell','aria-label':'عرض الموضع والتنقل في المصحف'},h('nav', { class: 'quran-page-turner quran-page-turner--unified', 'aria-label': 'التنقل بين صفحات المصحف' }, previous, beginning, title, lastPosition, next), h('div', { class: 'quran-navigation quran-navigation--unified' }, mushaf.label, surah.label, ayah.label, page.label, juz.label, hizb.label)))
    renderSearchHub(searchRoot, payload.records, new Map(pageMap.records.map(record => [record.ayahId, record.imlai])), (record) => { surah.select.value = String(record.surah); void draw(record.ayah, true) }, (record) => {
      const mapped = byId.get(record.ayahId)
      if (mapped) preloadMushafSvg(mapped.page)
    })
    // رابط نتيجة البحث يميّز الآية في أول رسم، لكن لا يمرّر عنصر الآية
    // المطلق داخل لوحة المصحف؛ تمريره كان يرفع اللوحة والصفحة كلها خارج موضعها.
    await draw(initialSelected.ayah, Boolean(routeView))
    void createAudioState(retry).then(loaded => {
      if(!reader.isConnected)return
      audioState.entries = loaded.entries
      const mapped = byId.get(state.selected.ayahId)
      if (mapped) renderInspector(details, tafsirDetails, state.selected, mapped.imlai, audioState, modeSwitch, tafsirSession)
    })
  } catch {
    if(!reader.isConnected)return
    reader.replaceChildren(h('p', { role: 'alert' }, 'تعذر فتح المصحف المحلي.'), retryButton(() => { void renderQuran(reader, details, tafsirDetails, searchRoot, true) }))
  }
}

type PageMapRecord = { ayahId: string; surah: number; ayah: number; page: number; imlai: string }
type PageMapPayload = { records: PageMapRecord[] }
export function isValidQuranPageMap(payload: PageMapPayload): boolean {
  if (!Array.isArray(payload.records) || payload.records.length !== 6236) return false
  const identities = new Set<string>()
  for (const record of payload.records) {
    if (!Number.isInteger(record.surah) || record.surah < 1 || record.surah > 114
      || !Number.isInteger(record.ayah) || record.ayah < 1
      || !Number.isInteger(record.page) || record.page < 1 || record.page > 604
      || record.ayahId !== `${record.surah}:${record.ayah}`
      || typeof record.imlai !== 'string' || !record.imlai.trim()
      || identities.has(record.ayahId)) return false
    identities.add(record.ayahId)
  }
  return true
}
export async function loadPageMap(retry = false): Promise<PageMapPayload> { const payload = await fetchQuranResource('./quran/mushaf/hafs/page-map.json',response=>response.json() as Promise<PageMapPayload>,retry); if (!isValidQuranPageMap(payload)) throw new Error('quran-page-map-invalid'); return payload }

export async function loadMushafSvg(page: number): Promise<string> {
  if (!Number.isInteger(page) || page < 1 || page > 604) throw new Error('quran-svg-page-invalid')
  const existing = mushafSvgCache.get(page)
  if (existing) return existing
  const request = (async () => {
    const name = String(page).padStart(3, '0')
    // صفحات النشر المرفقة SVG أصلية. طلب مسار gzip غير موجود قد يعيده
    // مضيف SPA كصفحة HTML ناجحة (200)، ثم يفشل فك الضغط ويعطّل الغرفة كلها.
    const text = await fetchQuranResource(`./quran/mushaf/hafs/${name}.svg`,response=>response.text())
    // قد يعيد مضيف SPA ملف index.html بحالة 200 للمسار الغائب. قبوله هنا
    // ينتج صفحة مصحف بيضاء، لذلك لا يُقبل إلا مستند SVG حقيقي.
    if (!/^\s*(?:<\?xml[^>]*>\s*)?<svg(?:\s|>)/i.test(text)) throw new Error('quran-svg-page-invalid')
    return text
  })()
  mushafSvgCache.set(page, request)
  while (mushafSvgCache.size > MUSHAF_SVG_CACHE_LIMIT) mushafSvgCache.delete(mushafSvgCache.keys().next().value!)
  request.catch(() => { if (mushafSvgCache.get(page) === request) mushafSvgCache.delete(page) })
  return request
}

function preloadMushafSvg(page: number): void {
  if (page < 1 || page > 604) return
  void loadMushafSvg(page).catch(() => undefined)
}

async function drawPrintedPage(root: HTMLElement, page: number, select: (surah: number, ayah: number) => void): Promise<void> {
  root.replaceChildren(silentSkeleton('reading'))
  const documentSvg = new DOMParser().parseFromString(await loadMushafSvg(page), 'image/svg+xml'), svg = document.importNode(documentSvg.documentElement, true) as unknown as SVGSVGElement
  svg.classList.add('quran-page-svg'); svg.setAttribute('role', 'img'); uiTemplateAttribute(svg, 'aria-label', '7b790678c806391c',{p1:page})
  svg.querySelectorAll<SVGPathElement>('.ayahPolygon').forEach(path => { const surah = Number(path.getAttribute('surah')), ayah = Number(path.getAttribute('ayah')); path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); uiTemplateAttribute(path, 'aria-label', '8c3caf8fc95a9728',{p1:SURAH_NAMES[surah - 1] ?? surah,p2:ayah}); const open = () => { svg.querySelectorAll('.ayahPolygon').forEach(item => item.classList.remove('is-selected')); path.classList.add('is-selected'); select(surah, ayah) }; path.addEventListener('click', open); path.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open() } }) })
  root.replaceChildren(svg)
}

async function drawOriginalSelectablePage(root: HTMLElement, page: number, pageRecords: PageMapRecord[], uthmani: Map<string, FullQuranAyah>, select: (surah: number, ayah: number, word?: string) => void,isCurrent:()=>boolean=()=>root.isConnected): Promise<void> {
  const editor=annotationEditorBoundary(root,()=>{if(isCurrent())void drawOriginalSelectablePage(root,page,pageRecords,uthmani,select,isCurrent)})
  const {addHighlight,getAnnotations}=editor
  root.replaceChildren(silentSkeleton('reading'))
  const documentSvg = new DOMParser().parseFromString(await loadMushafSvg(page), 'image/svg+xml'), svg = document.importNode(documentSvg.documentElement, true) as unknown as SVGSVGElement
  if(!editor.isCurrent()||!isCurrent())return
  svg.classList.add('quran-page-svg'); svg.setAttribute('role', 'img'); uiTemplateAttribute(svg, 'aria-label', '7b790678c806391c',{p1:page})
  const viewBox = (svg.getAttribute('viewBox') ?? '').trim().split(/\s+/).map(Number)
  const pageWidth = viewBox.length === 4 && viewBox[2]! > 0 ? viewBox[2]! : 1
  const pageHeight = viewBox.length === 4 && viewBox[3]! > 0 ? viewBox[3]! : 1
  const pageLeft = viewBox.length === 4 ? viewBox[0]! : 0
  const pageTop = viewBox.length === 4 ? viewBox[1]! : 0
  const overlay = h('div', { class: 'quran-copy-overlay', 'aria-label': 'طبقة تحديد ونسخ نص الصفحة العثماني' })
  const records = pageRecords.filter(record => record.page === page)
  for (const record of records) {
    const path = svg.querySelector<SVGPathElement>(`.ayahPolygon[surah="${record.surah}"][ayah="${record.ayah}"]`)
    if (!path) continue
    const coordinates = (path.getAttribute('d')?.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number), xs = coordinates.filter((_, index) => index % 2 === 0), ys = coordinates.filter((_, index) => index % 2 === 1)
    if (!xs.length || !ys.length) continue
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys)
    // SVG coordinates are physical left/top, independent of the Arabic text direction.
    const verse = h('span', { class: 'quran-copy-overlay__ayah', style: `left:${(minX - pageLeft) / pageWidth * 100}%;top:${(minY - pageTop) / pageHeight * 100}%;width:${(maxX - minX) / pageWidth * 100}%;height:${(maxY - minY) / pageHeight * 100}%`, dataset: { ayahId: record.ayahId } })
    const value = uthmani.get(record.ayahId)?.text ?? record.imlai
    const imlaiWords = record.imlai.trim().split(/\s+/), uthmaniParts = value.trim().split(/(\s+)/)
    let wordPosition = 0
    uthmaniParts.forEach(part => {
      if (!part || /^\s+$/.test(part)) { verse.append(document.createTextNode(part)); return }
      const word = bindQuranUiAttrs(h('span', { class: 'quran-copy-overlay__word', tabindex: 0, role: 'button', 'aria-label': '', dataset: { noTranslate:'', imlai: imlaiWords[wordPosition] ?? part } }, part),[['aria-label','ab71a759f2ab344a',{p1:part}]])
      wordPosition++
      const openWord = () => { const selection = window.getSelection(); if (selection && !selection.isCollapsed) return; select(record.surah, record.ayah, part) }
      word.addEventListener('click', openWord); word.addEventListener('keydown', event => { if (event.key === 'Enter') openWord() }); verse.append(word)
    })
    overlay.append(verse)
    path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button'); uiTemplateAttribute(path, 'aria-label', '8c3caf8fc95a9728',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah})
    const openVerse = () => { svg.querySelectorAll('.ayahPolygon').forEach(item => item.classList.remove('is-selected')); path.classList.add('is-selected'); select(record.surah, record.ayah) }
    path.addEventListener('click', openVerse); path.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openVerse() } })
  }
  const words = [...overlay.querySelectorAll<HTMLElement>('.quran-copy-overlay__word')]
  words.forEach((word, index) => { word.dataset.copyIndex = String(index) })
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
    await writeClipboardText(value)
  }
  const showSelectionMenu = (start: number, end: number, x: number, y: number): void => {
    document.querySelector('.quran-selection-menu')?.remove()
    const low = Math.min(start, end), high = Math.max(start, end), uthmaniText = selectedCopy(low, high, 'uthmani'), imlaiText = selectedCopy(low, high, 'imlai')
    if (!uthmaniText) return
    const menu = h('div', { class: 'reader__selection-menu quran-selection-menu', role: 'toolbar', 'aria-label': 'أدوات النص القرآني المحدد' })
    const close = () => menu.remove()
    const button = (label: string, run: () => void) => { const item = h('button', { type: 'button' }, label); item.addEventListener('click', () => { if(!editor.isCurrent())return; run(); close() }); return item }
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
  // اترك التحديد الأصلي للمتصفح يعمل بلا اعتراض. بعد اكتمال التحديد فقط
  // تُعرض أدوات النص؛ فلا نمنع pointerdown ولا نعيد بناء Range أثناء السحب.
  overlay.addEventListener('pointerup', event => queueMicrotask(() => {
    const selection = window.getSelection()
    if (!selection?.rangeCount || selection.isCollapsed || !selection.anchorNode || !overlay.contains(selection.anchorNode)) return
    const range = selection.getRangeAt(0)
    const selectedIndexes = words.flatMap((word, index) => range.intersectsNode(word) ? [index] : [])
    if (!selectedIndexes.length) return
    showSelectionMenu(selectedIndexes[0]!, selectedIndexes.at(-1)!, event.clientX, event.clientY)
  }))

  // أرقام الآيات المطبوعة موجودة في مجموعة مستقلة داخل SVG وبالترتيب نفسه
  // لآيات الصفحة. النقر على الرقم ينسخ الآية كاملة بعزوها، ولا يفتح الأدوات.
  const markerLayer = svg.querySelector('#ayah_markers')
  const markers = markerLayer ? [...markerLayer.children].filter(marker => marker.hasAttribute('ayah:x')) as SVGGElement[] : []
  markers.forEach((marker, index) => {
    const record = records[index], value = record ? uthmani.get(record.ayahId)?.text ?? record.imlai : ''
    if (!record || !value) return
    const copyVerse = (event: Event) => { event.stopPropagation(); void writeSelected(formatQuranCopy(value, record.surah, record.ayah)).then(() => toast(quranUiMessage('3b400d519621d205',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah}))).catch(() => toast('تعذر النسخ')) }
    marker.setAttribute('tabindex', '0'); marker.setAttribute('role', 'button'); uiTemplateAttribute(marker,'aria-label','e4bac671c8f05b45',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah}); marker.classList.add('quran-ayah-copy-marker')
    marker.addEventListener('click', copyVerse)
    marker.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); copyVerse(event) } })
  })
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
  root.replaceChildren(h('div', { class: `quran-page-canvas quran-page-canvas--facsimile${openingClass}`, style: `aspect-ratio:${pageWidth}/${pageHeight}` }, svg, overlay))
  preloadMushafSvg(page - 1)
  preloadMushafSvg(page + 1)
}

function drawSelectablePage(root: HTMLElement, page: number, pageRecords: PageMapRecord[], uthmani: Map<string, FullQuranAyah>, mode: 'uthmani' | 'imlai', select: (surah: number, ayah: number, word?: string) => void): void {
  const records = pageRecords.filter(record => record.page === page)
  const text = bindQuranUiAttrs(h('div', { class: `quran-selectable-page quran-selectable-page--${mode}`, dir: 'rtl', 'aria-label': '' }),[['aria-label','81e60fe7bd1a141a',{p1:page,p2:uiLabelParameter(mode === 'uthmani' ? 'العثماني' : 'الإملائي')}]])
  const characterCount = records.reduce((sum, record) => sum + (mode === 'uthmani' ? uthmani.get(record.ayahId)?.text.length ?? record.imlai.length : record.imlai.length), 0)
  const fontSize = characterCount > 1350 ? .72 : characterCount > 1000 ? .82 : characterCount > 720 ? .94 : characterCount > 480 ? 1.08 : characterCount > 300 ? 1.25 : 1.55
  text.style.setProperty('--quran-page-font', `${fontSize}rem`)
  for (const record of records) {
    const value = mode === 'uthmani' ? uthmani.get(record.ayahId)?.text ?? record.imlai : record.imlai
    const verse = h('span', { class: 'quran-selectable-ayah', dataset: { ayahId: record.ayahId } })
    value.trim().split(/(\s+)/).forEach(part => {
      if (!part || /^\s+$/.test(part)) { verse.append(document.createTextNode(part)); return }
      const word = bindQuranUiAttrs(h('span', { class: 'quran-selectable-word', tabindex: 0, role: 'button', 'aria-label': '',dataset:{noTranslate:''} }, part),[['aria-label','ab71a759f2ab344a',{p1:part}]])
      const openWord = () => { const selection = window.getSelection(); if (selection && !selection.isCollapsed) return; text.querySelectorAll('.quran-selectable-word').forEach(item => item.classList.remove('is-selected')); word.classList.add('is-selected'); select(record.surah, record.ayah, part) }
      word.addEventListener('click', openWord); word.addEventListener('keydown', event => { if (event.key === 'Enter') openWord() }); verse.append(word)
    })
    verse.append(document.createTextNode(' '))
    const marker = bindQuranUiAttrs(h('button', { type: 'button', class: 'quran-selectable-marker', 'aria-label': '' }, String(record.ayah)),[['aria-label','8c3caf8fc95a9728',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah}]]) as HTMLButtonElement
    marker.addEventListener('click', () => copy(formatQuranCopy(value, record.surah, record.ayah), quranUiMessage('3b400d519621d205',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah})))
    text.append(verse, marker, document.createTextNode(' '))
  }
  root.replaceChildren(h('div', { class: 'quran-page-canvas' }, text))
}

let quranFieldId=0
export function selectControl(title: string, options: { value: string; label: string }[], searchable = false): { label: HTMLLabelElement; select: HTMLSelectElement; setOptions: (next: { value: string; label: string }[]) => void; sync:()=>void } {
  let allOptions = options
  const select = h('select', { 'aria-label': title }) as HTMLSelectElement
  const fill = (items: { value: string; label: string }[]) => { const current = select.value; select.replaceChildren(...items.map(option => h('option', { value: option.value }, option.label))); if (items.some(item => item.value === current)) select.value = current }
  const listId=`quran-location-${++quranFieldId}`
  const list=h('datalist',{id:listId})
  const search = searchable ? h('input', { type: 'text', class: 'quran-field__filter', 'aria-label': title }) as HTMLInputElement : undefined
  if(search)uiTemplateAttribute(search,'placeholder','quran-choose-filter',{p1:uiLabelParameter(title)})
  search?.setAttribute('autocomplete','off')
  search?.setAttribute('list',listId)
  const sync=()=>{if(search)search.value=allOptions.find(option=>option.value===select.value)?.label??''}
  const commit=()=>{
    if(!search)return
    const query=search.value.trim().replace(/[٠-٩]/g,char=>String('٠١٢٣٤٥٦٧٨٩'.indexOf(char)))
    const target=allOptions.find(option=>option.value===query||option.label===query||option.label.replace(/^\d+\.\s*/,'')===query)
    if(!target){search.setCustomValidity(renderBoundUiTemplate('quran-choose-list',{p1:uiLabelParameter(title)},document.documentElement.lang||'ar'));return}
    search.setCustomValidity('');select.value=target.value;sync();select.dispatchEvent(new Event('change',{bubbles:true}))
  }
  search?.addEventListener('input',()=>search.setCustomValidity(''))
  search?.addEventListener('change',commit)
  search?.addEventListener('focus',()=>search.select())
  search?.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();commit()}else if(event.key==='Escape'){sync();search.setCustomValidity('')}})
  if(search){select.hidden=true;select.setAttribute('aria-hidden','true');select.tabIndex=-1}
  const setOptions = (next: { value: string; label: string }[]) => { allOptions = next; fill(next);list.replaceChildren(...next.map(option=>h('option',{value:option.label},option.value)));sync() }
  setOptions(options)
  return { select, setOptions, sync, label: h('label', { class: `quran-field${searchable ? ' quran-field--searchable' : ''}` }, h('span', null, title), ...(search ? [search,list] : []), select) as HTMLLabelElement }
}

function renderSearchHub(root: HTMLElement, records: FullQuranAyah[], imlaiByAyah: ReadonlyMap<string, string>, navigate: (record: FullQuranAyah) => void, prepare: (record: FullQuranAyah) => void): void {
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
      summary.textContent = ''; results.replaceChildren(silentSkeleton('cards'))
      try {
        const rootResult = await searchQuranByRoot(query)
        if (sequence !== searchSequence) return
        const byId = new Map(records.map(record => [record.ayahId, record]))
        const grouped = new Map<string, typeof rootResult.occurrences>()
        for (const occurrence of rootResult.occurrences) { const id = `${occurrence.surah}:${occurrence.ayah}`; const list = grouped.get(id) ?? []; list.push(occurrence); grouped.set(id, list) }
        const ordered = canonicalQuranOrder([...grouped.keys()].map(id => ({ id })))
        summary.replaceChildren(uiTemplateText('f546089b6cc5fe63',{p1:ordered.length,p2:rootResult.occurrences.length,p3:rootResult.root}))
        const shownRecords: FullQuranAyah[] = []
        results.replaceChildren(...ordered.slice(0, 60).map(({ id }) => {
          const record = byId.get(id), occurrences = grouped.get(id) ?? []
          if (!record) return h('span', { hidden: true })
          shownRecords.push(record)
          const label = uiTemplateText('fa15a1673672cd10',{p1:uiLabelParameter(SURAH_NAMES[record.surah - 1] ?? String(record.surah)),p2:record.ayah})
          const button = h('button', { class: 'quran-search-result', type: 'button' }, h('strong', null, label), h('span', {dataset:{noTranslate:''}}, record.text), h('small', {dataset:{noTranslate:''}}, occurrences.map(item => item.word).join(' · ')))
          button.addEventListener('pointerenter', () => prepare(record), { once: true })
          button.addEventListener('focus', () => prepare(record), { once: true })
          button.addEventListener('click', () => { copy(formatQuranCopy(record.text, record.surah, record.ayah), quranUiMessage('3b400d519621d205',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah})); navigate(record) })
          return button
        }))
        shownRecords.slice(0, 3).forEach(prepare)
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
    summary.replaceChildren(query.length < 2 ? '' : uiTemplateText('c48bf49b8244378f',{p1:matches.length,p2:occurrences}))
    const shownRecords: FullQuranAyah[] = []
    results.replaceChildren(...(query.length < 2 ? [] : matches.slice(0, 30).map(match => {
      const record = byId.get(match.id), label = record ? uiTemplateText('fa15a1673672cd10',{p1:uiLabelParameter(SURAH_NAMES[record.surah - 1] ?? String(record.surah)),p2:record.ayah}) : match.id
      const button = h('button', { class: 'quran-search-result', type: 'button' }, h('strong', null, label), h('span', {dataset:{noTranslate:''}}, match.text))
      if (record) {
        shownRecords.push(record)
        button.addEventListener('pointerenter', () => prepare(record), { once: true })
        button.addEventListener('focus', () => prepare(record), { once: true })
        button.addEventListener('click', () => { copy(formatQuranCopy(record.text, record.surah, record.ayah), quranUiMessage('3b400d519621d205',{p1:SURAH_NAMES[record.surah - 1] ?? record.surah,p2:record.ayah})); navigate(record) })
      }
      return button
    })))
    shownRecords.slice(0, 3).forEach(prepare)
  }
  input.addEventListener('input', () => { void update() }); sensitive.addEventListener('change', () => { void update() }); exact.addEventListener('change', () => { void update() }); rootMode.addEventListener('change', () => { void update() })
  root.replaceChildren(h('div', { class: 'quran-search-box' }, input, h('div', { class: 'quran-search-options' }, h('label', { class: 'quran-check' }, exact, h('span', null, 'مطابقة العبارة')), h('label', { class: 'quran-check' }, sensitive, h('span', null, 'مراعاة التشكيل')), h('label', { class: 'quran-check quran-check--root' }, rootMode, h('span', null, 'البحث بالجذر')))), summary, results)
}

type AudioEntry = QuranResource & { reciter?: string; riwaya?: string; chapterIds?: string[]; segmentation?: string; mediaBaseUrl?: string }
type AudioState = { entries: AudioEntry[] }
async function createAudioState(retry = false): Promise<AudioState> { try { const data = await loadQuranAudioCatalog(retry); return { entries: ((data as { entries?: AudioEntry[] }).entries ?? []).filter(entry => (entry.segmentation === 'chapter' || entry.segmentation === 'segment') && entry.mediaBaseUrl) } } catch { return { entries: [] } } }

function emphasizeResourceWord(text: string, selectedWord?: string): Node[] {
  const needle = selectedWord?.trim()
  if (!needle) return [document.createTextNode(text)]
  const marks = /[\u0610-\u061a\u0640\u064b-\u065f\u0670\u06d6-\u06ed]/u
  const normalizedNeedle = [...needle].filter(char => !marks.test(char)).join('')
  const normalized: string[] = [], positions: number[] = []
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]!
    if (marks.test(char)) continue
    normalized.push(char); positions.push(index)
  }
  const start = normalized.join('').indexOf(normalizedNeedle)
  if (start < 0 || !normalizedNeedle) return [document.createTextNode(text)]
  const from = positions[start]!, last = positions[start + normalizedNeedle.length - 1]!
  let to = last + 1
  while (to < text.length && marks.test(text[to]!)) to += 1
  return [
    document.createTextNode(text.slice(0, from)),
    h('strong', { class: 'quran-resource-target-word' }, text.slice(from, to)),
    document.createTextNode(text.slice(to)),
  ]
}

function renderInspector(root: HTMLElement, tafsirRoot: HTMLElement, record: FullQuranAyah, imlai: string, audio: AudioState, modeSwitch: HTMLElement, session: QuranTafsirSession, selectedWord?: string): void {
  const tafsir = h('select', { 'aria-label': 'اختر التفسير' }, ...TAFSIRS.map((definition, index) => h('option', { value: String(index), ...(isSourceEditionTafsir(definition)||isLinkedTafsir(definition)||isReadyBokTafsir(definition)||isIndexedVerseBook(definition) ? {} : { disabled: true }) }, `${arabicNum(index + 1)}. `, isSourceEditionTafsir(definition)||isLinkedTafsir(definition)||isReadyBokTafsir(definition)||isIndexedVerseBook(definition) ? uiTemplateText('e247c72af5db1232',{p1:tafsirDisplayName(definition)}) : uiTemplateText('95a2558ee2f8e7bb',{p1:tafsirDisplayName(definition)})))) as HTMLSelectElement
  tafsir.value = String(session.selectedIndex)
  const tafsirStatus = h('article', { class: 'quran-tafsir-reading', role: 'status', 'aria-live': 'polite' }, 'اختر تفسيرًا لعرضه هنا داخل الخزانة.')
  const tafsirTools = h('div', { class: 'quran-tafsir-tools' })
  let cancelReady:(()=>void)|undefined
  const updateTafsir = () => { cancelReady?.(); const index = Number(tafsir.value), definition = TAFSIRS[index]; tafsirTools.replaceChildren(); if(isIndexedVerseBook(definition)){const request=session.begin(index);cancelReady=loadIstiabReading(record.surah,record.ayah,tafsirStatus,tafsirTools,()=>session.isCurrent(request,index))}else if(isReadyBokTafsir(definition)){const request=session.begin(index);const current=()=>session.isCurrent(request,index);cancelReady=definition.slug==='mujahid'?loadMujahidReading(record.surah,record.ayah,tafsirStatus,tafsirTools,current):loadJalalaynReading(record.surah,record.ayah,tafsirStatus,tafsirTools,current)}else if (isLinkedTafsir(definition)||isSourceEditionTafsir(definition)) void loadTafsir(definition, record, tafsirStatus, tafsirTools, session, index) }
  const bookNavigation = tafsirBookNavigation(tafsir)
  tafsir.addEventListener('change', () => { session.select(Number(tafsir.value)); updateTafsir() })
  updateTafsir()
  const wordServiceStatus = h('article', { class: 'quran-word-service-status', role: 'status', 'aria-live': 'polite', hidden: true })
  const resourceTitles: Record<QuranVerseResourceKind, string> = { gharib: 'الغريب', qiraat: 'القراءات', tasrif: 'التصريف', irab: 'الإعراب' }
  const showLocalResource = async (kind: QuranVerseResourceKind, retry = false): Promise<void> => {
    wordServiceStatus.hidden = false
    wordServiceStatus.replaceChildren(silentSkeleton('reading'))
    try {
      const resource = await loadQuranVerseResource(kind, record.surah, record.ayah, retry)
      if (!resource) {
        wordServiceStatus.replaceChildren(h('strong', null, resourceTitles[kind]), h('p', null, 'لا يوجد مدخل موثّق لهذه الآية في الحزمة المحلية الحالية.'))
        return
      }
      const entries = resource.entries.map(entry => entry.word && entry.meaning
        ? quranGharibEntry(entry.word, entry.meaning)
        : h('p', null, ...emphasizeResourceWord(entry.text, selectedWord)))
      // تبقى هوية المورد وحقوقه في manifest ونتيجة المحمّل الإدارية، ولا
      // تتكرر داخل بطاقة الخدمة؛ زر الخدمة نفسه يحدد نوع النص المعروض.
      wordServiceStatus.replaceChildren(...entries)
    } catch {
      wordServiceStatus.replaceChildren(
        h('p', { role: 'alert' }, kind === 'gharib' ? 'مورد الغريب المعتمد غير متاح محليًا بعد.' : 'تعذر فتح النص المحلي الآن.'),
        action('إعادة المحاولة', () => { void showLocalResource(kind, true) }),
      )
    }
  }
  const wordServices = h('div', { class: 'quran-word-services' },
    action('الغريب', () => { void showLocalResource('gharib') }, 'quran-word-service quran-word-service--ready'),
    action('القراءات', () => { void showLocalResource('qiraat') }, 'quran-word-service quran-word-service--ready'),
    action('التصريف', () => { void showLocalResource('tasrif') }, 'quran-word-service quran-word-service--ready'),
    action('الإعراب', () => { void showLocalResource('irab') }, 'quran-word-service quran-word-service--ready'),
  )
  root.replaceChildren(
    h('section', { class: 'quran-selected', 'aria-label': 'خدمات الآية المحددة' }, modeSwitch, h('h2', { class: 'quran-selected-reference' }, `سورة ${SURAH_NAMES[record.surah - 1] ?? record.surah} · الآية ${record.ayah}`), h('div', { class: 'quran-word-panel' }, wordServices, wordServiceStatus)),
    audioPlayer(record, audio.entries),
  )
  tafsirRoot.replaceChildren(h('section', { class: 'quran-service quran-tafsir-panel' }, h('div', { class: 'quran-tafsir-selector' }, tafsir, tafsirTools), tafsirStatus, bookNavigation))

}

async function loadTafsir(definition: LinkedTafsirDefinition | SourceEditionTafsirDefinition, record: FullQuranAyah, root: HTMLElement, toolsRoot?: HTMLElement, session?: QuranTafsirSession, tafsirIndex = session?.selectedIndex ?? -1, retry = false): Promise<void> {
  const generation=(tafsirLoadGeneration.get(root)??0)+1;tafsirLoadGeneration.set(root,generation)
  const request = session?.begin(tafsirIndex)
  const isCurrent = () => tafsirLoadGeneration.get(root)===generation&&(!session || request === undefined || session.isCurrent(request, tafsirIndex))
  const key = `${definition.slug}:${record.surah}:${record.ayah}`, cached = retry?undefined:tafsirCache.get(key)
  if (cached) { if (isCurrent()) renderTafsirReading(root, cached, definition, record, toolsRoot); return }
  root.replaceChildren(silentSkeleton('reading'))
  try {
    const payload = isSourceEditionTafsir(definition) ? await loadSourceEditionTafsir(definition, record.surah, record.ayah, {retry}) : await loadLocalTafsir(definition.slug, record.surah, record.ayah, retry)
    const range='sharedSourceRange' in payload?payload.sharedSourceRange:undefined
    const sharedSourceRange=range&&typeof range==='object'&&'from' in range&&'to' in range&&typeof range.from==='number'&&typeof range.to==='number'&&Number.isInteger(range.from)&&Number.isInteger(range.to)&&range.from>=1&&range.from<=record.ayah&&range.to>=record.ayah&&range.to<=286?{from:range.from,to:range.to}:undefined
    const value = { title: payload.title || definition.name, html: payload.html, hasDirectCommentary: payload.hasDirectCommentary,...(sharedSourceRange?{sharedSourceRange}:{}) }; tafsirCache.set(key, value)
    if (isCurrent()) renderTafsirReading(root, value, definition, record, toolsRoot)
  } catch { if (isCurrent()) root.replaceChildren(h('p', { role: 'alert' }, 'تعذر تحميل نص هذا التفسير الآن.'), action('إعادة المحاولة', () => { void loadTafsir(definition, record, root, toolsRoot, session, tafsirIndex, true) })) }
}

function renderTafsirReading(root: HTMLElement, value: { title: string; html: string; hasDirectCommentary: boolean; sharedSourceRange?:{from:number;to:number} }, definition: LinkedTafsirDefinition | SourceEditionTafsirDefinition, record: FullQuranAyah, toolsRoot?: HTMLElement): void {
  let size = 1.08
  const body = h('div', { class: 'quran-tafsir-body', dataset: {noTranslate:''} })
  const verse=h('blockquote',{class:'quran-tafsir-selected-verse',dataset:{surah:String(record.surah),ayah:String(record.ayah),noTranslate:''}},h('small',null,`${SURAH_NAMES[record.surah-1]} · ${record.ayah}`),h('p',null,record.text))
  body.append(verse)
  if (value.hasDirectCommentary) body.append(sanitizedTafsirFragment(tafsirVerseExcerpt(value.html,record.surah,record.ayah),tafsirVerseTexts.get(record.surah)??[record.text]))
  else body.append(h('p', { class: 'muted quran-tafsir-empty' }, isSourceEditionTafsir(definition) ? 'لا يتوفر نص لهذه الآية في المصدر المستورد.' : 'لم يذكر المؤلف تفسيرًا مستقلًا لهذه الآية. يمكنك فتح الكتاب كاملًا للقراءة في سياقه.'))
  // Preserve the reviewed production cross-reference during the route migration.
  // It is an explicit reference, not commentary attributed to this verse.
  if (definition.slug === 'abu-saud' && record.surah === 77 && record.ayah === 34 && value.html.trim() === 'ويل يومئذ لممكذبين') {
    body.append(h('aside', {class:'quran-tafsir-cross-reference', 'aria-label':'إحالة إلى موضع آخر'},
      h('p', {class:'muted'}, 'إحالة إلى موضع آخر، وليست شرحًا منقولًا لهذا الموضع.'),
      h('a', {href:'#/quran/tafsir/abu-saud/77/15'}, 'انظر شرح العبارة عند المرسلات:15')))
  }
  body.style.setProperty('--tafsir-size', `${size}rem`)
  body.dataset.citation=`سورة ${SURAH_NAMES[record.surah-1]}، الآية ${record.ayah}`
  installTafsirSelectionTools(body, definition.slug, record.surah * 1000 + record.ayah)
  const minus = action('−', () => { size = Math.max(.85, size - .1); body.style.setProperty('--tafsir-size', `${size.toFixed(2)}rem`) }, 'quran-tafsir-zoom')
  const plus = action('+', () => { size = Math.min(1.8, size + .1); body.style.setProperty('--tafsir-size', `${size.toFixed(2)}rem`) }, 'quran-tafsir-zoom')
  minus.setAttribute('aria-label', 'تصغير نص التفسير'); plus.setAttribute('aria-label', 'تكبير نص التفسير')
  const bookTools=h('span',{class:'quran-tafsir-book-link'})
  const renderBookTools=(sourceBookLink?:SourceEditionBookLink)=>{
    const bookHref=isSourceEditionTafsir(definition)?sourceBookLink?.href:tafsirReaderHref(definition, record.surah, record.ayah)
    bookTools.replaceChildren(bookHref?h('a',{class:'btn btn--ghost quran-tafsir-open',href:bookHref},'افتحه ككتاب'):h('span',{class:'muted',title:'لم يثبت موضع هذه الآية في نسخة المكتبة بعد'},'موضع الكتاب غير موثّق'))
    if(sourceBookLink?.sharedRange){const {from,to}=sourceBookLink.sharedRange;bookTools.append(h('small',{class:'muted quran-tafsir-shared-range'},uiTemplateText('quran-shared-book-range',{p1:from,p2:to})))}
    if(sourceBookLink&&'destinationNote' in sourceBookLink)bookTools.append(h('small',{class:'muted quran-tafsir-destination-note'},sourceBookLink.destinationNote))
  }
  // The multi-MB reviewed link map is not needed to read the Quran. Resolve it
  // only for a source-edition commentary, without delaying the verse or text.
  if(isSourceEditionTafsir(definition)){
    void import('../quran_source_book_links').then(({getSourceEditionBookLink})=>{
      if(bookTools.isConnected&&root.contains(body))renderBookTools(getSourceEditionBookLink(definition.slug,record.surah,record.ayah))
    }).catch(()=>{if(bookTools.isConnected)bookTools.replaceChildren(action('إعادة المحاولة',()=>renderTafsirReading(root,value,definition,record,toolsRoot)))})
  }else renderBookTools()
  const tools = [minus, plus, bookTools]
  if(value.sharedSourceRange){const {from,to}=value.sharedSourceRange;tools.push(h('small',{class:'muted quran-tafsir-source-range'},uiTemplateText('quran-shared-source-range',{p1:from,p2:to})))}
  if (toolsRoot) { toolsRoot.replaceChildren(...tools); root.replaceChildren(body) }
  else root.replaceChildren(h('div', { class: 'quran-tafsir-toolbar' }, h('div', { class: 'quran-tafsir-tools' }, ...tools)), body)
}

export function quranTafsirBookScreen(param: string): HTMLElement {
  if (!isFullQuranInstalled()) installFullQuran()
  const [slug = '', surahText, ayahText] = param.split('/')
  const redirectDefinition = linkedTafsirBySlug(slug)
  if (redirectDefinition) {
    queueMicrotask(() => { routeLocation.hash = tafsirReaderHref(redirectDefinition, Number(surahText) || 1, Number(ayahText) || 1) })
  }
  const definition = redirectDefinition
  const saved = definition ? readTafsirPosition(definition.slug) : undefined
  let surah = Math.min(114, Math.max(1, Number(surahText ?? saved?.surah ?? 1) || 1))
  let ayah = Math.max(1, Number(ayahText ?? saved?.ayah ?? 1) || 1)
  const page = pageContent(); page.classList.add('quran-tafsir-book', 'reader-like-book')
  const position = h('p', { class: 'quran-tafsir-book__position', 'aria-live': 'polite' })
  const reading = h('article', { class: 'quran-tafsir-book__reading', tabindex: 0 }, silentSkeleton('reading'))
  const previous = action('السابق', () => navigate(-1), 'quran-tafsir-book__nav')
  const next = action('التالي', () => navigate(1), 'quran-tafsir-book__nav')
  const surahSelect = h('select', { 'aria-label': 'الانتقال إلى سورة' }, ...SURAH_NAMES.map((name, index) => h('option', { value: String(index + 1) }, `${arabicNum(index + 1)}. ${name}`))) as HTMLSelectElement
  const ayahSelect = h('select', { 'aria-label': 'الانتقال إلى آية' }) as HTMLSelectElement
  surahSelect.value = String(surah)
  const info = h('aside', { class: 'quran-tafsir-book__card', hidden: true, 'aria-label': 'بطاقة كتاب التفسير' },
    h('strong', definition?{dataset:{noTranslate:''}}:null, definition?.name ?? 'التفسير'),
    h('p', definition?.author?{dataset:{noTranslate:''}}:null, definition?.author ?? 'المؤلف مجهول'),
    h('dl', null, h('div', null, h('dt', null, 'المصدر'), h('dd', null, 'نص تفسير محلي داخل الخزانة')), h('div', null, h('dt', null, 'الارتباط'), h('dd', null, 'مرتبط بالسور والآيات'))),
  )
  const infoButton = action('معلومات الكتاب', () => { info.hidden = !info.hidden }, 'quran-tafsir-book__info')
  const header = h('header', { class: 'quran-tafsir-book__header' },
    h('a', { class: 'btn btn--ghost', href: '#/quran' }, 'العودة إلى المصحف'),
    h('p', { class: 'eyebrow' }, 'كتاب تفسير في مكتبتي'), h('h1', definition?{dataset:{noTranslate:''}}:null, definition?.name ?? 'التفسير'),
    definition?.author ? h('p', { class: 'quran-tafsir-book__author',dataset:{noTranslate:''} }, definition.author) : null,
    position,
    h('div', { class: 'quran-tafsir-book__navigation' }, previous, surahSelect, ayahSelect, next),
  )
  const toolbar = h('footer', { class: 'reader__toolbar quran-tafsir-book__toolbar' }, h('div', { class: 'reader__toolbar-inner' },
    h('a', { class: 'tool-btn', href: '#/quran' }, 'المصحف'), infoButton,
    action('نسخ النص', () => copy(reading.innerText, 'نُسخ نص التفسير'), 'tool-btn'),
    action('بحث في الخزانة', () => { routeLocation.hash = `#/search?q=${encodeURIComponent(reading.innerText.slice(0, 120))}&mode=exact` }, 'tool-btn'),
  ))
  page.append(header, info, reading, toolbar)
  let records: FullQuranAyah[] = []
  let currentIndex = -1
  const fillAyahs = () => {
    const count = records.filter(item => item.surah === surah).length || ayah
    ayahSelect.replaceChildren(...Array.from({ length: count }, (_, index) => h('option', { value: String(index + 1) }, uiTemplateText('0a59524734eafb02',{p1:index + 1}))))
    ayah = Math.min(count, Math.max(1, ayah)); ayahSelect.value = String(ayah)
  }
  const open = async () => {
    if (!definition) { reading.replaceChildren(h('p', { role: 'alert' }, 'تعذر تحديد كتاب التفسير.')); return }
    position.replaceChildren(uiTemplateText('fa15a1673672cd10',{p1:uiLabelParameter(SURAH_NAMES[surah - 1] ?? String(surah)),p2:ayah}))
    localStorage.setItem(`khizana:quran-tafsir-position:${definition.slug}`, JSON.stringify({ surah, ayah }))
    currentIndex = records.findIndex(item => item.surah === surah && item.ayah === ayah)
    previous.disabled = currentIndex <= 0; next.disabled = currentIndex < 0 || currentIndex >= records.length - 1
    await loadTafsir(definition, records[currentIndex]??{ ayahId: `${surah}:${ayah}`, surah, ayah, text: '' }, reading)
    installTafsirSelectionTools(reading, definition.slug, currentIndex)
  }
  function navigate(step: number): void {
    const target = records[currentIndex + step]
    if (!target || !definition) return
    surah = target.surah; ayah = target.ayah
    routeLocation.hash = `#/quran/tafsir/${definition.slug}/${surah}/${ayah}`
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

export function tafsirBookNavigation(select: HTMLSelectElement): HTMLElement {
  const root = h('nav', {class:'quran-tafsir-book-switch', 'aria-label':'التنقل بين كتب تفسير الآية'})
  const render = () => {
    const options = [...select.options].filter(option => !option.disabled)
    const index = options.findIndex(option => option.value === select.value)
    root.replaceChildren()
    for (const step of [-1, 1]) {
      const target = options[index + step]
      const label = step < 0 ? 'الكتاب السابق' : 'الكتاب التالي'
      const name = target?.textContent?.replace(/^[\d٠-٩]+\.\s*/u, '') ?? label
      const button = h('button', {type:'button',class:'btn quran-tafsir-book-switch__card','aria-label':label,disabled:!target},icon(step < 0 ? 'chevron-right' : 'chevron-left',18),h('span',target?{dataset:{noTranslate:''}}:null,name)) as HTMLButtonElement
      if(target)uiTemplateAttribute(button,'aria-label','quran-adjacent-book',{p1:uiLabelParameter(label),p2:name})
      button.onclick=()=>{if(!target)return;select.value=target.value;select.dispatchEvent(new Event('change',{bubbles:true}))}
      root.append(button)
    }
  }
  select.addEventListener('change',render);render()
  return root
}

const tafsirSelectionCleanup=new WeakMap<HTMLElement,()=>void>()
export function installTafsirSelectionTools(reading: HTMLElement, slug: string, position: number): void {
  tafsirSelectionCleanup.get(reading)?.()
  const editor=annotationEditorBoundary(reading,()=>installTafsirSelectionTools(reading,slug,position),()=>{
    reading.querySelector('.quran-tafsir-selection')?.remove()
    for(const mark of reading.querySelectorAll('mark.reader-highlight'))mark.replaceWith(...mark.childNodes)
  })
  const {addHighlight}=editor
  for(const highlight of getAnnotations().highlights.filter(item=>item.bookId===`quran-tafsir-${slug}`&&item.pageIndex===position)) {
    markReaderSearchOccurrence(reading,highlight.text,highlight.occurrence??0)
    reading.querySelectorAll<HTMLElement>('mark.reader-search-mark').forEach(mark=>{mark.className='reader-highlight';mark.dataset.highlightColor=highlight.color})
  }
  reading.onpointerup = (event) => {
    if((event.target as Element)?.closest('.quran-tafsir-selection'))return
    if(!editor.isCurrent())return
    const selection = window.getSelection(), text = selection?.toString().trim() ?? ''
    reading.querySelector('.quran-tafsir-selection')?.remove()
    if (!text || !selection?.rangeCount || !reading.contains(selection.anchorNode) || !reading.contains(selection.focusNode)) return
    const range = selection.getRangeAt(0).cloneRange()
    const menu = h('div', { class: 'reader__selection-menu quran-tafsir-selection', role: 'toolbar', 'aria-label': 'أدوات النص المحدد' })
    const listeners=new AbortController()
    const hide=()=>{menu.remove();listeners.abort()}
    tafsirSelectionCleanup.get(reading)?.()
    tafsirSelectionCleanup.set(reading,hide)
    captureRouteResourceScope().add(hide)
    const done = () => { hide(); selection.removeAllRanges() }
    menu.addEventListener('pointerdown',event=>event.preventDefault())
    document.addEventListener('selectionchange',()=>{const live=getSelection();if(!reading.isConnected||!live?.rangeCount||live.isCollapsed||live.toString().trim()!==text||!reading.contains(live.anchorNode)||!reading.contains(live.focusNode))hide()},{signal:listeners.signal})
    document.addEventListener('pointerdown',event=>{if(!reading.contains(event.target as Node))hide()},{signal:listeners.signal})
    const button = (label: string, run: () => void) => {
      const node=action(label, () => { if(!editor.isCurrent())return; run(); done() })
      const name=label.includes('نسخ')?'copy':label==='تظليل'?'palette':label==='حفظ اقتباس'?'bookmark':label==='في الخزانة'?'search':'globe'
      node.replaceChildren(icon(name,16),h('span',null,label));node.setAttribute('aria-label',label)
      return node
    }
    menu.append(
      button('نسخ', () => copy(text, 'نُسخ النص المحدد')),
      button('نسخ موثّق', () => {
        const definition=TAFSIRS.find(item=>'slug' in item&&item.slug===slug)
        const source=`${definition?.name??slug} — ${reading.dataset.citation??`موضع ${position+1}`}`
        const holder=document.createElement('div');holder.append(range.cloneContents())
        void writeRichClipboard(buildRichClipboard(text,source,holder.innerHTML)).then(()=>toast('نُسخ النص مع توثيقه')).catch(()=>toast('تعذّر النسخ'))
      }),
      button('ترجمة', () => openTranslationDialog(text)),
      button('تظليل', () => {
        addHighlight(`quran-tafsir-${slug}`, Math.max(0, position), text, 'important', 0)
        const mark = h('mark', { class: 'reader-highlight', dataset: { highlightColor: 'important' } })
        try { mark.append(range.extractContents()); range.insertNode(mark) } catch { /* يبقى التظليل محفوظًا ولو تعذر لف عناصر مركبة */ }
        toast('حُفظ التظليل')
      }),
      button('في الخزانة', () => { window.open(new URL(`#/search?q=${encodeURIComponent(text)}&mode=exact`, location.href).href, '_blank', 'noopener,noreferrer') }),
      button('حفظ اقتباس', () => openQuotePublishDialog({text,bookId:`quran-tafsir-${slug}`})),
      button('في Google', () => { window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer') }),
    )
    reading.appendChild(menu)
    const rect=range.getBoundingClientRect()
    menu.style.left=`${Math.max(8,Math.min(rect.left,innerWidth-menu.offsetWidth-8))}px`
    menu.style.top=`${Math.max(70,rect.top-menu.offsetHeight-8)}px`
  }
  reading.onkeyup=event=>{if(event.key.startsWith('Arrow')||event.key==='Shift')reading.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))}
}

export function formatQuranCopy(text: string, surah: number, ayah: number): string {
  return `﴿${text.trim()}﴾ [${SURAH_NAMES[surah - 1] ?? surah}: ${ayah}]`
}

export function formatQuranCopyRange(text: string, surah: number, firstAyah: number, lastAyah: number): string {
  if (firstAyah === lastAyah) return formatQuranCopy(text, surah, firstAyah)
  return `﴿${text.trim()}﴾ [${SURAH_NAMES[surah - 1] ?? surah}: ${firstAyah} - ${lastAyah}]`
}

function copyAction(shortLabel: string, label: string, run: () => void): HTMLButtonElement {
  const button = h('button', { class: 'quran-copy-button', type: 'button' },
    h('span', { class: 'quran-copy-button__icon', 'aria-hidden': 'true' }, h('span', null), h('span', null)),
    h('span', { class: 'quran-copy-button__text' }, h('strong', null, uiTemplateText('26f9e4d91456d78a',{p1:uiLabelParameter(shortLabel)})), h('small', null, label)),
  ) as HTMLButtonElement
  uiTemplateAttribute(button,'aria-label','26f9e4d91456d78a',{p1:uiLabelParameter(label)})
  button.addEventListener('click', run)
  return button
}

export function audioPlayer(record: FullQuranAyah, entries: AudioEntry[]): HTMLElement {
  activeQuranAudioCleanup?.()
  const listeners = new AbortController()
  const available = entries.filter(entry => entry.chapterIds?.includes(String(record.surah))).sort((a, b) => Number(a.segmentation === 'segment') - Number(b.segmentation === 'segment'))
  const unique = [...new Map(available.map(entry => [`${entry.reciter}|${entry.riwaya}`, entry])).values()]
  const audioKey = quranAudioEntryKey
  const filter = h('input', { type: 'search', class: 'quran-audio-filter', placeholder: 'اختر القارئ والرواية…', 'aria-label': 'اختر القارئ والرواية', role: 'combobox' }) as HTMLInputElement
  const readerListId = `quran-audio-readers-${record.ayahId.replace(':', '-')}`
  const readerList = h('div', { id: readerListId, class: 'quran-audio-combobox__list', role: 'listbox', hidden: true })
  const readerToggle = h('button', { type: 'button', class: 'quran-audio-combobox__toggle', 'aria-label': 'عرض قائمة القراء', 'aria-expanded': 'false' }, icon('chevron-left', 18)) as HTMLButtonElement
  readerToggle.setAttribute('aria-controls', readerListId)
  filter.setAttribute('aria-autocomplete', 'list'); filter.setAttribute('aria-controls', readerListId); filter.setAttribute('aria-expanded', 'false')
  const filterStatus = h('p', { class: 'quran-audio-filter__status', role: 'status', 'aria-live': 'polite', hidden: true })
  const labelAudioEntry = (entry: AudioEntry) => `${entry.reciter ?? 'قارئ'} — ${entry.riwaya ?? 'رواية'}`
  const savedAudioKey = preferredAudioKey || loadQuranAudioReader(), initialIndex = Math.max(0, unique.findIndex(entry => audioKey(entry) === savedAudioKey))
  let selectedIndex = initialIndex, activeResult = 0, resetAudioSource = () => {}, completedPlays = 0
  let visibleReaderOptions = filterQuranAudioEntries(unique, '')
  const positionReaders = () => { const rect = filter.getBoundingClientRect(), width = Math.min(440, innerWidth - 16), belowSpace = innerHeight - rect.bottom - 8, aboveSpace = rect.top - 8, below = belowSpace >= Math.min(280, aboveSpace), available = Math.max(120, Math.min(440, below ? belowSpace - 5 : aboveSpace - 5)); readerList.style.width = `${width}px`; readerList.style.maxHeight = `${available}px`; readerList.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, rect.left + rect.width / 2 - width / 2))}px`; readerList.style.top = `${below ? rect.bottom + 5 : Math.max(8, rect.top - Math.min(readerList.scrollHeight, available) - 5)}px` }
  const closeReaders = () => { readerList.hidden = true; filter.setAttribute('aria-expanded', 'false'); readerToggle.setAttribute('aria-expanded', 'false'); filter.removeAttribute('aria-activedescendant') }
  const chooseReader = (index: number) => {
    const picked = unique[index]; if (!picked) return
    selectedIndex = index; preferredAudioKey = audioKey(picked); saveQuranAudioReader(preferredAudioKey); filter.value = labelAudioEntry(picked); resetAudioSource(); closeReaders()
  }
  const fillReaders = (open = true, query = filter.value) => {
    const options = filterQuranAudioEntries(unique, query); visibleReaderOptions = options
    activeResult = Math.min(activeResult, Math.max(0, options.length - 1))
    readerList.replaceChildren(...options.map(({ entry, index }, position) => {
      const id = `${readerListId}-option-${index}`, option = h('button', { id, type: 'button', class: `quran-audio-combobox__option${index === selectedIndex ? ' is-selected' : ''}`, role: 'option', 'aria-selected': String(index === selectedIndex) as 'true' | 'false' }, uiTemplateText('db24c6f78ab47c39',{p1:entry.reciter ?? uiLabelParameter('قارئ'),p2:entry.riwaya ?? uiLabelParameter('رواية')}))
      option.addEventListener('click', () => chooseReader(index)); return option
    }))
    filterStatus.hidden = options.length > 0; filterStatus.textContent = options.length ? '' : 'لا يوجد قارئ مطابق.'
    if (open) { readerList.hidden = false; positionReaders(); filter.setAttribute('aria-expanded', 'true'); readerToggle.setAttribute('aria-expanded', 'true'); const active = readerList.children[activeResult] as HTMLElement | undefined; if (active) { active.classList.add('is-active'); filter.setAttribute('aria-activedescendant', active.id); active.scrollIntoView({ block: 'nearest' }) } }
    return options
  }
  if (unique[selectedIndex]) filter.value = labelAudioEntry(unique[selectedIndex]!)
  filter.addEventListener('focus', () => { filter.select(); fillReaders(true, '') })
  filter.addEventListener('input', () => { activeResult = 0; fillReaders() })
  readerToggle.addEventListener('click', () => {
    if (readerList.hidden) { activeResult = 0; fillReaders(true, ''); filter.focus() }
    else { closeReaders(); filter.focus() }
  })
  filter.addEventListener('keydown', event => {
    const options = visibleReaderOptions
    if (event.key === 'Escape') { event.preventDefault(); closeReaders(); return }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); activeResult = Math.max(0, Math.min(options.length - 1, activeResult + (event.key === 'ArrowDown' ? 1 : -1))); fillReaders(); return }
    if (event.key === 'Enter' && !readerList.hidden) { event.preventDefault(); const picked = options[activeResult]; if (picked) chooseReader(picked.index) }
  })
  readerList.addEventListener('pointerdown', event => { if ((event.target as Element).closest('.quran-audio-combobox__option')) event.preventDefault() })
  readerList.addEventListener('wheel', event => event.stopPropagation(), { passive: true })
  document.addEventListener('pointerdown', event => { const target = event.target as Node; if (!readerList.contains(target) && !filter.contains(target) && !readerToggle.contains(target)) closeReaders() }, { signal: listeners.signal })
  document.body.appendChild(readerList)
  window.addEventListener('resize', () => { if (!readerList.hidden) positionReaders() }, { signal: listeners.signal })
  const closeReadersOnOuterScroll = (event: Event) => {
    if (event.target === readerList || readerList.contains(event.target as Node)) return
    closeReaders()
  }
  window.addEventListener('scroll', closeReadersOnOuterScroll, { signal: listeners.signal, capture: true })
  const player = h('audio', { class: 'quran-audio-element' }) as HTMLAudioElement; player.preload = 'none'
  const play = h('button', { type: 'button', class: 'quran-audio-button quran-audio-play', 'aria-label': 'تشغيل التلاوة' }, icon('play', 21)) as HTMLButtonElement
  const repeatActive = () => preferredRepeatCount !== 1
  const repeatLabel = () => preferredRepeatCount === 'infinity' ? '∞' : String(preferredRepeatCount)
  const repeatDescription = () => unique[selectedIndex]?.segmentation === 'chapter' ? '27addd84774213ee' : 'c649e67ae3630466'
  const repeat = h('button', { type: 'button', class: `quran-audio-button quran-audio-repeat${repeatActive() ? ' is-active' : ''}`, 'aria-label': '' }, icon('repeat', 17), h('span', { 'aria-hidden': 'true' }, `×${repeatLabel()}`)) as HTMLButtonElement
  uiTemplateAttribute(repeat,'aria-label',repeatDescription(),{p1:repeatLabel()}); repeat.setAttribute('aria-pressed', String(repeatActive()))
  const timeline = h('input', { type: 'range', class: 'quran-audio-timeline', min: '0', max: '1000', value: '0', 'aria-label': 'موضع التلاوة' }) as HTMLInputElement
  const elapsed = h('span', { class: 'quran-audio-time' }, '0:00 / 0:00')
  const speed = h('select', { class: 'quran-audio-speed', 'aria-label': 'سرعة التلاوة' }, ...[.75, 1, 1.25, 1.5, 2].map(value => h('option', { value: String(value), ...(value === 1 ? { selected: true } : {}) }, `×${value}`))) as HTMLSelectElement
  const sleep = h('select', { class: 'quran-audio-sleep', 'aria-label': 'مؤقت إيقاف التلاوة' },
    h('option', { value: '0' }, 'مؤقت النوم: متوقف'),
    ...[15, 30, 60].map(value => h('option', { value: String(value) }, uiTemplateText('56d213cada890949',{p1:value}))),
  ) as HTMLSelectElement
  let sleepTimer: ReturnType<typeof setTimeout> | undefined
  const cancelSleepTimer = () => { if (sleepTimer !== undefined) clearTimeout(sleepTimer); sleepTimer = undefined }
  const selectedAudioEntry = () => unique[selectedIndex]
  const ensureSource = () => { const entry = selectedAudioEntry(); if (!entry?.mediaBaseUrl) return false; const url = quranAudioUrl(entry, record.surah, record.ayah); if (player.src !== new URL(url, document.baseURI).href) player.src = url; return true }
  resetAudioSource = () => { completedPlays = 0; uiTemplateAttribute(repeat,'aria-label',repeatDescription(),{p1:repeatLabel()}); player.pause(); player.removeAttribute('src'); player.load(); play.replaceChildren(icon('play', 21)); play.setAttribute('aria-label', 'تشغيل التلاوة'); timeline.value = '0'; elapsed.textContent = '0:00 / 0:00' }
  play.addEventListener('click', () => { if (!ensureSource()) return; if (player.paused) void player.play().catch(() => toast('تعذر تشغيل التلاوة الآن')); else player.pause() })
  repeat.addEventListener('click', () => { preferredRepeatCount = nextQuranRepeatCount(preferredRepeatCount); completedPlays = 0; const label = repeatLabel(); repeat.classList.toggle('is-active', repeatActive()); repeat.setAttribute('aria-pressed', String(repeatActive())); repeat.setAttribute('aria-label', repeatDescription()); repeat.querySelector('span')!.textContent = `×${label}` })
  sleep.addEventListener('change', () => { cancelSleepTimer(); const minutes=Number(sleep.value); if(!minutes)return; sleepTimer=setTimeout(()=>{sleepTimer=undefined;player.pause();sleep.value='0';toast('انتهى مؤقت النوم وأُوقفت التلاوة')},quranSleepDelayMs(minutes)) })
  timeline.addEventListener('input', () => { if (Number.isFinite(player.duration)) player.currentTime = Number(timeline.value) / 1000 * player.duration })
  speed.addEventListener('change', () => { player.playbackRate = Number(speed.value) })
  player.addEventListener('play', () => { play.replaceChildren(icon('pause', 21)); play.setAttribute('aria-label', 'إيقاف التلاوة مؤقتًا') })
  player.addEventListener('pause', () => { play.replaceChildren(icon('play', 21)); play.setAttribute('aria-label', 'تشغيل التلاوة') })
  player.addEventListener('timeupdate', () => { const duration = Number.isFinite(player.duration) ? player.duration : 0; timeline.value = duration ? String(Math.round(player.currentTime / duration * 1000)) : '0'; elapsed.textContent = `${audioTime(player.currentTime)} / ${audioTime(duration)}` })
  player.addEventListener('ended', () => { timeline.value = '0'; completedPlays += 1; if (shouldRepeatQuranAyah(completedPlays, preferredRepeatCount)) { player.currentTime = 0; void player.play().catch(() => toast('تعذر تشغيل التلاوة الآن')) } else { completedPlays = 0; quranAudioAdvance?.(record, selectedAudioEntry()?.segmentation) } })
  activeQuranAudioCleanup = () => { cancelSleepTimer(); listeners.abort(); readerList.remove(); player.pause(); player.removeAttribute('src') }
  if (quranAudioAutoplayAyah === record.ayahId) { quranAudioAutoplayAyah = ''; queueMicrotask(() => { if (ensureSource()) void player.play().catch(() => toast('تعذر متابعة التلاوة تلقائيًا')) }) }
  return h('section', { class: 'quran-service quran-audio-card' }, h('div', { class: 'quran-audio-heading' }, h('h2', null, 'استماع القرآن الكريم'), h('span', { class: 'quran-audio-badge' }, uiTemplateText('0df12322cb222d30',{p1:uiLabelParameter(SURAH_NAMES[record.surah - 1] ?? String(record.surah))}))), unique.length ? h('div', { class: 'quran-audio-panel' }, h('div', { class: 'quran-audio-combobox' }, filter, readerToggle), filterStatus, h('div', { class: 'quran-audio-transport' }, play, elapsed, repeat, speed), timeline, sleep, player) : h('p', null, 'لا توجد تلاوة متاحة لهذه السورة الآن.'))
}

export function quranAudioUrl(entry: Pick<AudioEntry, 'segmentation' | 'mediaBaseUrl'>, surah: number, ayah: number): string {
  const base = (entry.mediaBaseUrl ?? '').replace(/\/$/, '')
  const chapter = String(surah).padStart(3, '0')
  return entry.segmentation === 'segment' ? `${base}/${chapter}${String(ayah).padStart(3, '0')}.mp3` : `${base}/${chapter}.mp3`
}
export function nextQuranRepeatCount(value: QuranRepeatCount): QuranRepeatCount { return value === 1 ? 3 : value === 3 ? 7 : value === 7 ? 'infinity' : 1 }
export function shouldRepeatQuranAyah(completedPlays: number, target: QuranRepeatCount): boolean { return target === 'infinity' || completedPlays < target }
export function quranSleepDelayMs(minutes:number):number { return Number.isFinite(minutes)&&minutes>0?Math.round(minutes*60_000):0 }
export function nextQuranAudioRecord(records: FullQuranAyah[], current: Pick<FullQuranAyah, 'ayahId'>, segmentation='segment'): FullQuranAyah | undefined {
  const index=records.findIndex(item=>item.ayahId===current.ayahId)
  if(index<0)return undefined
  if(segmentation==='chapter')return records.slice(index+1).find(item=>item.surah!==records[index]!.surah)
  return records[index+1]
}
function audioTime(value: number): string { const seconds = Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0; return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}` }
function action(label: string, run: () => void, extraClass = ''): HTMLButtonElement { const button = h('button', { class: `btn btn--ghost ${extraClass}`.trim() }, label) as HTMLButtonElement; button.addEventListener('click', run); return button }
async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return }
  const input = document.createElement('textarea')
  input.value = text; input.style.position = 'fixed'; input.style.opacity = '0'; document.body.append(input); input.select()
  const copied = document.execCommand('copy'); input.remove()
  if (!copied) throw new Error('copy-failed')
}

function copy(text: string, success: string): void { void writeClipboardText(text).then(() => toast(success)).catch(() => toast('تعذر النسخ')) }
function retryButton(retry: () => void): HTMLButtonElement { return action('إعادة المحاولة', retry) }
import { loadIstiabReading } from '../quran_istiab'
import { quranGharibEntry } from '../quran_gharib_entry'
import { loadJalalaynReading } from '../quran_jalalayn'
import { loadMujahidReading } from '../quran_mujahid'

type QuranUiParams = Parameters<typeof uiTemplateText>[1]
function bindQuranUiAttrs<T extends Element>(element:T, bindings:ReadonlyArray<readonly ['aria-label'|'placeholder',string,QuranUiParams]>):T {
 for(const [name,id,parameters] of bindings)uiTemplateAttribute(element,name,id,parameters)
 return element
}

function quranUiMessage(id:string,parameters:QuranUiParams):string{return renderBoundUiTemplate(id,parameters,document.documentElement.lang||'ar')}
import {routeLocation,legacyHashToPath} from "../path_location"
