/* قشرة القارئ: تعرض DOCX، وتتيح تنزيل الأصل ونسخة PDF المحوّلة من Word نفسه. */

import { bookById } from '../data'
import { readerLoadingPaper } from '../reader_loading'
import {publishedBookControls} from '../published_book_controls'
import {bookLoadFailureDescription} from '../book_load_error'
import { h, toast, arabicNum } from '../ui'
import { icon } from '../icons'
import { appHeader, runtimeEnvironmentNotice, skipToContent } from '../shell'
import { loadBook, loadBookFromBuffer, type LoadedBook } from '../engine/bridge'
import type { BodyParagraph, DocumentModelV0 } from '@engine/ooxml-model'
import { releaseRenderedPageAssets, renderBookLeadingPages, renderBookPreviewPage, streamBookPages, fitPageToWidth } from '../engine/dom_render'
import { downloadBytes, getBook as getStoredBook, hasCurrentReaderModel, saveReaderModel as saveStoredReaderModel, saveReaderPageCount as saveStoredReaderPageCount, updateBokDerivedText as updateStoredBokDerivedText, type WordPageMap, type StoredBook } from '../engine/library_store'
import {createPublicReaderRegistry,isPublicReaderId} from '../public_reader_registry'
import {resolveAccountBookOriginal} from '../account_book_resolver'
import { convertStoredBookToPdf as convertPrivateStoredBookToPdf, needsPdfRefresh, pdfCreationOptions } from '../engine/word_pdf'
import { addHighlight, addNote, deleteHighlight, deleteNote, getAnnotations, toggleBookmark, type HighlightColor, type ReaderHighlight } from '../annotation_store'
import { bookCover } from '../book_cover'
import { brandMark } from '../brand'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { authorLink, bookAuthorLinks, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import { stateView } from '../state_view'
import { buildRichClipboard, writeRichClipboard } from '../rich_clipboard'
import { availableReaderPage, parseReaderDeepLink, readyReaderTotal, readerHydrationWindow, readerIndexForDisplayedPage, readerProgressState, requestedReaderPage } from '../reader_navigation'
import { persistCompletedReaderPageCount } from '../reader_page_count_persistence'
import { bookPageCount, bookVolumeCount, cacheReaderPageCount } from '../book_page_count'
import { getReadingMode, nextReadingMode, readingModeLabel, saveReadingMode, type ReadingMode } from '../reading_mode'
import { normalizeWordBookmark, pageIndexForBookmark, renderedBookmarkTarget } from '../reader_bookmark_mapping'
import { readerScrollBehavior } from '../motion_preference'
import { readerBoundaryIndex } from '../reader_boundary_navigation'
import { annotationDeletePrompt } from '../annotation_accessibility'
import { captureRouteResourceScope, routeAnimationFrame, routeEventListener, routeObserver, routeTimeout, type ResourceScope } from '../resource_lifecycle'
import { readerDocumentTitle, readerIdentityLabel } from '../reader_identity'
import { getRuntimeCapabilities } from '../runtime_capabilities'
import { classifyReaderFailure, plainReaderGroups, type ReaderFailure, type ReaderFailureStage } from '../reader_failure'
import { bestEffortClone } from '../reader_cache'
import { ReaderPreviewCache } from '../reader_preview_cache'
import { hasAuthoritativeWordPageMaps } from '../reader_page_authority'
import { inferBookFormat } from '../book_format'
import { managedBookLock } from '../managed_book_lock'
import { shouldParseRawBok } from '../shamela_reader_contract'
import { assertBookFormat, invalidBookFormatMessage } from '../book_format_validation'
import { storedTextSource, textParagraphs } from '../text_import'
import {isTocHeading} from '../toc_heading_match'
import {independentPdfPanel} from '../independent_pdf_panel'
import { extractPdfOutline, normalizeTocQuery, type PdfTocDestination } from '../reader_toc'
import { pdfJsLocalAssets } from '../pdfjs_assets'
import { openTranslationDialog, setSourceDocumentTitle } from '../translation'
import { ensurePublishedWorkSeeded } from '../published_library_seed'
import { cleanShamelaFootnoteMarks, isShamelaBasmalah, parseTextualFootnoteLine, shamelaSymbolParts, splitTextualFootnoteEntries } from '../shamela_text_presentation'
import { shamelaSourceBookId } from '../shamela_public_identity'
import { createReaderErrorReportButton } from '../reader_error_report'
import { localOriginalAsset } from '../library_card_state'
import { markReaderSearchOccurrence, nextReaderSearchIndex, searchReaderPageTexts } from '../reader_in_book_search'
import { readerPositionText, readerWordSheetPosition } from '../reader_position_label'
import {uiTemplateText,uiTemplateAttribute,uiLabelParameter} from '../ui_template_binding'
import { silentSkeleton } from '../silent_skeleton'
import { rememberReaderReturnPoint } from '../reader_return_bar'
import { migrateReadingThemeDataset, type ReadingTheme } from '../reader_theme'
import { initialPdfCompanionIndex, pdfPersistedReaderIndex, pdfReaderEventSyncTarget, pdfTextSyncIndex } from '../pdf_scroll_sync'
import { bokLocalPageNumbers } from '../bok_page_numbering'
import { ORIGINAL_PDF_MISSING_TOOLTIP, hasOriginalBookPdf, pdfButtonAction } from '../pdf_button_policy'
import { withExtractedEditionMetadata } from '../edition_metadata'
import { createBookIssueReportButton } from '../book_issue_report'
import {openHighlightComment} from '../highlight_comment'
import {captureReadingIdentity} from '../reading_identity_scope'
import {readingPosition} from '../reading_plan'
import {annotationEditorBoundary} from '../annotation_editor_boundary'
import {captureAnnotationStores} from '../annotation_identity_store'
import {openQuotePublishDialog} from '../quote_publish_form'

const readerIdentities = new WeakMap<object, ReturnType<typeof captureReadingIdentity>>()
const publicReaderRegistry=createPublicReaderRegistry()
const accountReaderRegistry=createPublicReaderRegistry(resolveAccountBookOriginal,true)
const isAccountReaderId=(id:string)=>id.startsWith('account-book:')
const isRemoteReaderId=(id:string)=>isPublicReaderId(id)||isAccountReaderId(id)
const getBook=(id:string)=>isAccountReaderId(id)?Promise.resolve(accountReaderRegistry.get(id)):isPublicReaderId(id)?Promise.resolve(publicReaderRegistry.get(id)):getStoredBook(id)
const saveReaderModel:typeof saveStoredReaderModel=(id,...args)=>isRemoteReaderId(id)?Promise.resolve():saveStoredReaderModel(id,...args)
const saveReaderPageCount:typeof saveStoredReaderPageCount=(id,...args)=>isRemoteReaderId(id)?Promise.resolve():saveStoredReaderPageCount(id,...args)
const updateBokDerivedText:typeof updateStoredBokDerivedText=(id,...args)=>isRemoteReaderId(id)?Promise.resolve():updateStoredBokDerivedText(id,...args)
const convertStoredBookToPdf:typeof convertPrivateStoredBookToPdf=(id,...args)=>isRemoteReaderId(id)?Promise.reject(new Error('تحويل هذا المنشور إلى PDF لم يُربط بالخدمة بعد')):convertPrivateStoredBookToPdf(id,...args)
function identityForReader(owner:object){let identity=readerIdentities.get(owner);if(!identity){identity=captureReadingIdentity();readerIdentities.set(owner,identity)}return identity}

/** كاش جلسة القراءة: يمنع إعادة فك OOXML عند الرجوع إلى كتاب مفتوح مؤخرًا. */
const loadedBookCache = new Map<string, LoadedBook>()
// A preview contains a complete cloned Word page (including images). Keep the
// session fast on reopen without retaining one heavy DOM tree for every book
// ever opened in a long-lived tab.
const FIRST_PAGE_CACHE_LIMIT = 8
const firstPageCache = new ReaderPreviewCache<HTMLElement>(FIRST_PAGE_CACHE_LIMIT)
let activePageNavigation: PageNavigation | undefined
let activePageNumbers: number[] = []
let activePartNumbers: number[] = []
let activeDisplayedTotal = 0
let activeReaderPageIndex = 0

const READER_PAGE_EVENT = 'alkhizana:reader-page'
const READER_PAGE_REQUEST_EVENT = 'alkhizana:reader-page-request'

function announceReaderPage(index: number, total: number, source: 'text' | 'pdf' = 'text'): void {
  window.dispatchEvent(new CustomEvent(READER_PAGE_EVENT, { detail: { index, total, source } }))
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => routeAnimationFrame(() => resolve()))
}

/** يمنح التفاعل/التمرير الأولوية قبل بدء التصفيح الكامل مرتفع الكلفة. */
function readerIdleTurn(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise(resolve => {
    let done = false
    const finish = (): void => { if (done) return; done = true; resolve() }
    const idle = globalThis.requestIdleCallback?.(() => finish(), { timeout: 350 })
    const timer = idle == null ? globalThis.setTimeout(finish, 32) : undefined
    signal?.addEventListener('abort', () => {
      if (idle != null) globalThis.cancelIdleCallback?.(idle)
      if (timer != null) globalThis.clearTimeout(timer)
      finish()
    }, { once: true })
  })
}

export function readerScreen(id: string): HTMLElement {
  // هوية التنقل تخص الكتاب الحالي فقط. إبقاؤها من قارئ سابق كان يجعل PDF
  // المستقل يرث أحيانًا عدد صفحات/موضع كتاب Word فتح قبله في جلسة SPA.
  activePageNavigation = undefined
  activePageNumbers = []
  activePartNumbers = []
  activeDisplayedTotal = 0
  const resourceScope = captureRouteResourceScope()
  const identity = identityForReader(resourceScope)
  const book = bookById(id)
  const initialTitle = book?.title ?? ''
  let citationBook: { title: string; author: string; authorId?: string } = { title: initialTitle, author: book?.author ?? '' }
  const savedReturnPage = Math.max(0, Number(identity.getItem(`alkhizana:reading-position:${id}`)) || 0)
  rememberReaderReturnPoint({ bookId: id, title: initialTitle, pageIndex: savedReturnPage })
  routeEventListener(window, READER_PAGE_EVENT, ((event: CustomEvent<{ index?: number }>) => {
    const index = event.detail?.index
    if (identity.isCurrent() && Number.isInteger(index) && Number(index) >= 0) {
      rememberReaderReturnPoint({ bookId: id, title: citationBook.title, pageIndex: Number(index) })
    }
  }) as EventListener, undefined, resourceScope)
  setSourceDocumentTitle(readerDocumentTitle(initialTitle))
  const theme = migrateReadingThemeDataset(document.documentElement)
  let tocEntries: TocEntry[] = []
  let readingMode: ReadingMode = getReadingMode()
  const reader = h('div', { class: `reader${readingMode === 'flow' ? ' reader--flow' : ''}` })
  reader.appendChild(skipToContent())
  reader.appendChild(appHeader(routeLocation.hash))
  reader.appendChild(runtimeEnvironmentNotice())
  const asideEl = tocAside(theme, tocEntries)
  const infoEl = bookInfoAside(id, initialTitle)
  readerIdentities.set(infoEl, identity)
  const bookCardEl = bookInfoDialog(initialTitle)
  resourceScope.add(() => closePdfPreview(infoEl))
  resourceScope.add(() => document.body.classList.remove('reader-book-card-open'))
  reader.appendChild(
    h(
      'div',
      { class: 'reader__body' },
      asideEl,
      h('main', { class: 'reader__stage', id: 'main-content', tabindex: -1, 'aria-label': 'متن الكتاب' }, readingColumn()),
      infoEl,
    ),
  )
  reader.appendChild(bookCardEl)

  // قفل أفقي فعلي لقارئ الصفحات: قد ينشئ CSS zoom مجال تمرير داخليًا حتى
  // مع overflow:clip في بعض إصدارات Chromium. لا نسمح لذلك المجال أن يغير
  // موضع الورقة؛ التمرير العمودي وحده يبقى متاحًا.
  const previousRootOverflowX = document.documentElement.style.overflowX
  const previousBodyOverflowX = document.body.style.overflowX
  document.documentElement.style.overflowX = 'hidden'
  document.body.style.overflowX = 'hidden'
  const lockReaderHorizontalPosition = (): void => {
    document.documentElement.scrollLeft = 0
    document.body.scrollLeft = 0
    if (window.scrollX !== 0) window.scrollTo(0, window.scrollY)
    for (const element of reader.querySelectorAll<HTMLElement>('.reader__body,.reader__stage,.reading,.reading__stream,.reading__page-slot')) {
      if (element.scrollLeft !== 0) element.scrollLeft = 0
    }
  }
  routeEventListener(window, 'scroll', lockReaderHorizontalPosition, { capture: true, passive: true }, resourceScope)
  routeEventListener(reader, 'scroll', lockReaderHorizontalPosition, { capture: true, passive: true }, resourceScope)
  resourceScope.add(() => {
    document.documentElement.style.overflowX = previousRootOverflowX
    document.body.style.overflowX = previousBodyOverflowX
  })
  requestAnimationFrame(lockReaderHorizontalPosition)

  reader.appendChild(readerToolbar(reader,
    () => void downloadOriginalBook(id, book),
    () => void downloadConvertedPdf(id),
    () => {
      toggleBookInfoDialog(bookCardEl)
    },
    () => togglePdfBesideBook(id, infoEl),
    () => toggleToc(reader),
    () => { if(identity.isCurrent())toggleCurrentBookmark(id) },
    () => { if(identity.isCurrent())createBookIssueReportButton({id,title:citationBook.title||initialTitle||'كتاب'},()=>readerReportContext(reader,id)).click() },
    () => toggleSearch(reader),
    () => toggleSerenity(reader),
    () => {
      readingMode = nextReadingMode(readingMode)
      saveReadingMode(readingMode)
      reader.classList.toggle('reader--flow', readingMode === 'flow')
      return readingMode
    },
  ))
  void configureReaderPdfActions(reader, id)
  installSelectionMenu(reader, id, () => citationBook)

  // عند الرجوع إلى كتاب مفتوح في الجلسة، تظهر الورقة السابقة قبل قراءة IndexedDB.
  const cachedPage = firstPageCache.get(id)
  if (cachedPage) {
    const cachedClone = cloneReaderPage(cachedPage)
    const stage = reader.querySelector<HTMLElement>('.reader__stage')
    if (cachedClone) {
      const instant = readingColumn()
      stage?.replaceChildren(instant)
      renderDomPages(instant, [cachedClone], initialTitle, citationBook.author, citationBook.authorId, resourceScope, { preview: true })
      instant.dataset.status = 'preview'
    }
  }
  // يبقى التخطيط الهندسي أداة تشخيص داخلية إلى أن يجتاز اختبار قراءة العربية.
  // لا نعرض مبدّله للقارئ لأن مسارات الحروف الحالية غير صالحة للقراءة بعد.

  // قفص تحميل: HTML فوري أولًا (بلا WASM)، ثم المشهد في الخلفية
  const loadFrom = (title: string, loadPromise: Promise<LoadedBook | LoadedBook[]>, wordPageMap?: WordPageMap | Array<WordPageMap | undefined>, physicalPageCount?: number): void => {
    const pipelineStarted=performance.now(),trace=(phase:string,extra:Record<string,unknown>={})=>{if(location.hostname==='localhost'||location.hostname==='127.0.0.1')console.debug(`reader_open_phase ${JSON.stringify({bookId:id,phase,ms:Math.round(performance.now()-pipelineStarted),...extra})}`)}
    const stage = reader.querySelector<HTMLElement>('.reader__stage')
    const cachedLive = stage?.querySelector<HTMLElement>('.reading[data-status="preview"]')
    const live = cachedLive ?? readingColumn()
    if (!cachedLive) stage?.replaceChildren(live)
    if (!cachedLive) live.dataset.status = 'loading'
    const prog = live.querySelector('.reading__progress-fill') as HTMLElement | null
    const label = live.querySelector('.reading__progress-label') as HTMLElement | null

    const setProgress = (pct: number, msg: string): void => {
      if (prog) prog.style.width = `${pct}%`
      if (label) label.textContent = msg
    }

    setProgress(5, 'جلب البيانات…')

    loadPromise
      .then(async (loadedResult) => {
        trace('model-ready')
        if (resourceScope.disposed) return
        const loadedBooks = Array.isArray(loadedResult) ? loadedResult : [loadedResult]
        const pageMaps = Array.isArray(wordPageMap) ? wordPageMap : [wordPageMap]
        const authoritativePagination = hasAuthoritativeWordPageMaps(pageMaps, loadedBooks.length)
        setProgress(30, 'ترسيم الصفحات…')

        let pipelineStage: ReaderFailureStage = 'preview'
        try {
          // نعرض أول ورقة قبل بناء جميع الصفحات أو انتظار تحميل كل الخطوط.
          const preview = renderBookPreviewPage(loadedBooks[0]!.model, pageMaps[0])
          if (preview) {
            resourceScope.add(() => releaseRenderedPageAssets([preview]))
            preview.dataset.partNumber = '1'
            renderDomPages(live, [preview], title, citationBook.author, citationBook.authorId, resourceScope, {
              preview: true,
              ...(physicalPageCount === undefined ? {} : { physicalPageCount }),
            })
            live.dataset.status = 'preview'
            cacheReaderPage(id, preview)
            await nextPaint()
            trace('first-paint')
          }

          // اجعل الصفحة الثانية والثالثة قابلة للتنقل قبل تصفيح الكتاب كله.
          // الإلغاء تابع للمسار، فلا يستمر قياس DOCX بعد مغادرة القارئ.
          const pagination = new AbortController()
          resourceScope.add(() => pagination.abort())
          // ثماني صفحات أولى جاهزة عقدٌ للقارئ: تغيير التكبير لا يجوز أن
          // يصل بالمستخدم إلى نهاية الدفعة الأولية بعد الصفحة الثالثة بينما
          // التصفيح الخلفي ما زال يعمل.
          const leading = await renderBookLeadingPages(loadedBooks[0]!.model, 8, pageMaps[0], pagination.signal)
          trace('leading-pages',{pages:leading.length})
          if (resourceScope.disposed) return
          resourceScope.add(() => releaseRenderedPageAssets(leading))
          leading.forEach(page => { page.dataset.partNumber = '1' })
          activePageNavigation = renderDomPages(live, leading, title, citationBook.author, citationBook.authorId, resourceScope, {
            preview: true,
            ...(physicalPageCount === undefined ? {} : { physicalPageCount }),
          })
          live.dataset.status = 'progressive'
          await nextPaint()
          await readerIdleTurn(pagination.signal)
          trace('background-stream-start')

          // تابع من الصفحة الرابعة عبر المنتج نفسه؛ كل صفحة تُضاف فور قياسها
          // ولا يوجد حاجز مصفوفة كاملة بين القارئ والصفحة التالية.
          pipelineStage = 'layout'
          const pages: HTMLElement[] = [...leading]
          const nav = activePageNavigation!
          tocEntries = []
          for (let partIndex = 0; partIndex < loadedBooks.length; partIndex++) {
            if (resourceScope.disposed) return
            const offset = partIndex === 0 ? 0 : pages.length
            tocEntries.push(...extractToc(loadedBooks[partIndex]!.model.paragraphs)
              .map(entry => ({ ...entry, num: offset + entry.num })))
            renderTocAside(asideEl, theme, tocEntries)
            enableTocNavigation(tocEntries, nav)
            const skip = partIndex === 0 ? leading.length : 0
            for await (const page of streamBookPages(loadedBooks[partIndex]!.model, pageMaps[partIndex], skip, pagination.signal)) {
              if (resourceScope.disposed) return
              page.dataset.partNumber = String(partIndex + 1)
              pages.push(page)
              resourceScope.add(() => releaseRenderedPageAssets([page]))
              nav.appendPages?.([page])
            }
          }
          renderTocAside(asideEl, theme, tocEntries)
          setProgress(80, 'عرض الصفحات…')
          // لا نعلن العرض الكامل جاهزًا قبل تثبيت عدده؛ وإلا قد يعود المستخدم
          // إلى بطاقة الكتاب بينما ما تزال معاملة IndexedDB في الخلفية.
          if (authoritativePagination) {
            cacheReaderPageCount(id, pages.length)
            await persistCompletedReaderPageCount(id, pages.length, saveReaderPageCount)
          }
          if (resourceScope.disposed) return
          pipelineStage = 'dom'
          nav.finish?.(pages.length)
          trace('all-pages',{pages:pages.length})
          activePageNavigation = nav
          enableTocNavigation(tocEntries, nav)
          enableDocumentLinkNavigation(live, nav)
          setProgress(100, `${title}`)
          if (authoritativePagination) {
            live.dataset.status = 'ready'
          } else {
            live.dataset.status = 'approximate'
            live.prepend(readerFidelityNotice(() => reprocessReaderFromOriginal(id, loadFrom)))
          }
          if (pages[0]) cacheReaderPage(id, pages[0])

          // لا نبني المشهد الهندسي التشخيصي أثناء القراءة؛ كان يستهلك المعالج
          // بعد ظهور الكتاب بلا فائدة مرئية. يبقى متاحًا في اختبارات المحرك فقط.
        } catch (e) {
          const failure = classifyReaderFailure(e, pipelineStage)
          // خريطة Word دليل اختياري قوي، لكنها لا يجوز أن تحجب أصلًا صالحًا.
          // عند رفضها نعيد الترسيم مرة واحدة بلا أرقام Word ونعلن التقريب.
          if (failure.stage === 'page-map' && pageMaps.some(Boolean)) {
            console.warn('reader_page_map_rejected_truthful_fallback', id)
            const conversionFact = reader.querySelector<HTMLElement>('.reader-quality__facts [data-kind="conversion"]')
            if (conversionFact) conversionFact.textContent = 'خريطة صفحات Word مرفوضة؛ العرض تقريبي'
            loadFrom(title, Promise.resolve(loadedResult), loadedBooks.map(() => undefined), undefined)
            return
          }
          console.warn('reader_render_failed', failure.code)
          live.dataset.status = 'error'
          live.replaceChildren(readerFailurePanel(failure, {
            bookTitle: title, bookId: id,
            retry: () => loadFrom(title, Promise.resolve(loadedResult), wordPageMap, physicalPageCount),
            fallback: () => renderPlainReaderFallback(live, loadedBooks, title, citationBook.author, citationBook.authorId, resourceScope),
            download: () => void downloadOriginalBook(id, book),
          }))
        }
      })
      .catch((err: unknown) => {
        const failure = classifyReaderFailure(err, 'parse')
        console.warn('reader_open_failed', failure.code)
        live.dataset.status = 'error'
        live.replaceChildren(readerFailurePanel(failure, {
          bookTitle: title, bookId: id,
          retry: () => location.reload(),
          download: () => void downloadOriginalBook(id, book),
        }))
      })
  }

  // تحميل من المكتبة المحفوظة أو من الكتاب التجريبي
  if (id === 'upload') {
  } else if (book?.docx) {
    loadFrom(book.title, loadBook(book.docx))
  } else if (id && id !== 'hadith-1') {
    // محاولة التحميل من IndexedDB
    void (async () => {
      const sourceStarted=performance.now(),sourceTrace=(phase:string,extra:Record<string,unknown>={})=>{if(location.hostname==='localhost'||location.hostname==='127.0.0.1')console.debug(`reader_source_phase ${JSON.stringify({bookId:id,phase,ms:Math.round(performance.now()-sourceStarted),...extra})}`)}
      // روابط الشاملة الرقمية تفتح الكتاب المطلوب مباشرة، ولا تنتظر غرس آلاف
      // بطاقات الكتالوج الجاري في الخلفية عند بداية جلسة باردة.
      const publicSource=isRemoteReaderId(id)
      const remoteRegistry=isAccountReaderId(id)?accountReaderRegistry:publicReaderRegistry
      const publicAbort=new AbortController()
      if(publicSource)resourceScope.add(()=>publicAbort.abort())
      let stored = publicSource ? await remoteRegistry.resolve(id,publicAbort.signal) : shamelaSourceBookId(id) ? await ensurePublishedWorkSeeded(id) : await getBook(id)
      if(publicSource&&stored){const transient=stored;resourceScope.add(()=>{remoteRegistry.release(transient);loadedBookCache.delete(id)})}
      if (!identity.isCurrent()) return
      sourceTrace('source-ready',{bytes:stored?.data?.byteLength??0,format:stored?inferBookFormat(stored):'missing'})
      // قد يسبق فتح رابط كتاب منشور اكتمال غرس manifest في IndexedDB، ولا
      // ينبغي أن تظهر عندها هوية وهمية أو صفحة مفقودة.
      if (!publicSource && (!stored || (stored.managedSource === 'published' && !stored.data?.byteLength))) {
        stored = await ensurePublishedWorkSeeded(id) ?? stored
      } else if (!publicSource && stored?.managedSource === 'published' && inferBookFormat(stored) === 'shamela-bok' && shouldParseRawBok(stored, 'shamela-bok')) {
        // سجلات BOK المنشورة القديمة قد تحمل الأصل الصحيح مع مشتقات ناقصة.
        // تحديثها قبل أول رسم يمنع فشل Jet المتكرر، ولا يمس كتب المستخدم.
        stored = await ensurePublishedWorkSeeded(id) ?? stored
      } else if (!publicSource && stored?.managedSource === 'published') {
        // افتح النسخة الموثقة الموجودة فورًا؛ فحص manifest/الخريطة عملية صيانة
        // خلفية ولا يجوز أن يحبس أول رسم على الشبكة أو كتابة IndexedDB. إذا
        // وصلت سلطة صفحات أحدث، أعد الرسم بها في المسار نفسه دون إعادة تحميل.
        const visible = stored
        void ensurePublishedWorkSeeded(id).then((refreshed) => {
          if (!refreshed || routeLocation.hash.split('?')[0] !== `#/reader/${id}`) return
          const oldFragments = visible.wordPageMap?.fragments?.length ?? 0
          const newFragments = refreshed.wordPageMap?.fragments?.length ?? 0
          if (oldFragments === newFragments) return
          const loaded = loadedBookCache.get(id) ?? loadBookFromBuffer(refreshed.data)
          loadedBookCache.set(id, loaded)
          loadFrom(refreshed.title, Promise.resolve(loaded), refreshed.wordPageMap, refreshed.physicalPageCount)
        }).catch(() => undefined)
      }
      if (stored) {
        if (!identity.isCurrent()) return
        const resolvedTitle = storedReaderTitle(stored)
        citationBook = { title: resolvedTitle, author: stored.author, ...(stored.authorId ? { authorId: stored.authorId } : {}) }
        // Publish only the identity that has passed the reader's visibility
        // checks, so offline metadata need not depend on an unavailable API.
        reader.dataset.readerTitle = resolvedTitle
        reader.dataset.readerAuthor = stored.author
        rememberReaderReturnPoint({
          bookId: id,
          title: resolvedTitle,
          pageIndex: Math.max(0, Number(identity.getItem(`alkhizana:reading-position:${id}`)) || 0),
        })
        setSourceDocumentTitle(readerDocumentTitle(resolvedTitle))
        configureReaderSourceLabel(reader, stored)
        renderReaderInfoIdentity(infoEl, stored)
        renderBookInfo(bookCardEl, stored)
        if (inferBookFormat(stored) === 'text' || inferBookFormat(stored) === 'markdown' || inferBookFormat(stored) === 'epub' || inferBookFormat(stored) === 'shamela-bok') {
          void renderTextSource(reader, stored, resourceScope)
          return
        }
        if (inferBookFormat(stored) === 'pdf') {
          const stage = reader.querySelector<HTMLElement>('.reader__stage')
          stage?.replaceChildren()
          void showPdfBesideBook(id, infoEl, true)
          return
        }
        if (stored.volumes && stored.volumes.length > 1) {
          const ordered = [...stored.volumes].sort((a, b) => a.number - b.number)
          loadFrom(stored.title, Promise.resolve(ordered.map(volume => loadBookFromBuffer(volume.data))), ordered.map(volume => volume.wordPageMap), stored.physicalPageCount)
          return
        }
        let loaded = loadedBookCache.get(id)
        // لا نعيد استعمال نموذج OOXML من إصدار أقدم: بايتات DOCX قد تكون هي
        // نفسها بينما تطور استخراج header/footer/footnotes. كان هذا يجعل
        // اختبارات الأصل تمر، لكن القارئ الحي يعرض نموذج IndexedDB القديم.
        if (!loaded && hasCurrentReaderModel(stored)) {
          loaded = { model: stored.readerModel, pages: [] }
          loadedBookCache.set(id, loaded)
        }
        if (!loaded) {
          const parseStarted=performance.now()
          loaded = loadBookFromBuffer(stored.data)
          sourceTrace('model-parsed',{parseMs:Math.round(performance.now()-parseStarted),paragraphs:loaded.model.paragraphs.length})
          loadedBookCache.set(id, loaded)
          // الحفظ غير حاجب للعرض؛ الزيارة التالية تتجاوز فك ZIP وXML كليًا.
          void saveReaderModel(id, loaded.model).catch(() => undefined)
        }
        else sourceTrace('model-cache-hit',{persistent:Boolean(stored.readerModel)})
        loadFrom(stored.title, Promise.resolve(loaded), stored.wordPageMap, stored.physicalPageCount)
      } else {
        const stage = reader.querySelector('.reader__stage')
        if (stage) {
          stage.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'لم يُعثر على الكتاب في المكتبة', description: 'قد يكون حُذف من هذا الجهاز؛ يمكنك إضافته من جديد.', actionLabel: 'فتح المكتبة', href: '#/library' }))
        }
      }
    })().catch((error: unknown) => {
      if(isRemoteReaderId(id)){
        if(resourceScope.disposed||!identity.isCurrent())return
        const code=error instanceof Error?error.message:''
        const title=isAccountReaderId(id)?'تعذّر فتح كتاب الحساب':code==='public_book_format_unsupported'?'صيغة الكتاب المنشور تحتاج معالجة قبل القراءة':code==='public_book_unavailable'?'الكتاب غير متاح للنشر العام الآن':'تعذّر فتح الكتاب المنشور'
        reader.querySelector('.reader__stage')?.replaceChildren(stateView({kind:'error',icon:'book',title,description:'لم تُضف أو تُحذف أي ملفات من مكتبتك الخاصة.',actionLabel:'فتح المكتبة',href:'#/library'}))
        return
      }
      console.warn('text_reader_open_failed', error)
      const stage = reader.querySelector<HTMLElement>('.reader__stage')
      const diagnostic = error instanceof Error && /^shamela_pack_[a-z0-9_]+$/u.test(error.message) ? error.message : undefined
      const showFailure = (retryError: unknown = error): void => {
        if(resourceScope.disposed||!identity.isCurrent())return
        const retryDiagnostic = retryError instanceof Error && /^shamela_pack_[a-z0-9_]+$/u.test(retryError.message) ? retryError.message : diagnostic
        stage?.replaceChildren(stateView({ kind: 'error', icon: 'book', title: 'تعذّر فتح الكتاب الآن', description: `${bookLoadFailureDescription(retryError)}${retryDiagnostic ? ` رمز التشخيص: ${retryDiagnostic}` : ''}`, actionLabel: 'إعادة المحاولة', onAction: () => {
          stage?.replaceChildren(stateView({ kind: 'loading', icon: 'book', title: 'جارٍ إعادة التحقق من الكتاب', description: 'يُعاد جلب المشتقات الموثقة فقط؛ يبقى الأصل محفوظًا.' }))
          void ensurePublishedWorkSeeded(id).then(retried => {
            if (!retried) throw new Error('published_book_retry_missing')
            return renderTextSource(reader, retried, resourceScope)
          }).catch(showFailure)
        } }))
      }
      showFailure()
    })
  }

  return reader
}

async function renderTextSource(reader: HTMLElement, stored: StoredBook, resourceScope: ResourceScope): Promise<void> {
  const identity = identityForReader(resourceScope)
  const textStarted=performance.now(),textTrace=(phase:string,extra:Record<string,unknown>={})=>{if(location.hostname==='localhost'||location.hostname==='127.0.0.1')console.debug(`reader_text_phase ${JSON.stringify({bookId:stored.id,phase,ms:Math.round(performance.now()-textStarted),...extra})}`)}
  const stage = reader.querySelector<HTMLElement>('.reader__stage')
  if (!stage) return
  try {
    reader.classList.add('reader--textual')
    stage.classList.add('reader__stage--textual')
    const format = inferBookFormat(stored)
    if (shouldParseRawBok(stored, format)) {
      const runtime = globalThis as typeof globalThis & {
        process?: { browser: true; env: Record<string, string | undefined>; version: string; nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void }
      }
      runtime.process ??= { browser: true, env: {}, version: '', nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)) }
      const { parseBok, CURRENT_BOK_TEXT_VERSION } = await import('../bok_import')
      const parsed = parseBok(stored.data, stored.fileName)
      textTrace('bok-parsed',{pages:parsed.pages.length})
      stored = { ...stored, extractedText: parsed.extractedText, bokPages: parsed.pages, bokToc: parsed.toc, bokTextVersion: CURRENT_BOK_TEXT_VERSION }
      await updateBokDerivedText(stored.id, { extractedText: parsed.extractedText, pages: parsed.pages, toc: parsed.toc, version: CURRENT_BOK_TEXT_VERSION })
    }
    const sourceText = format === 'epub' || format === 'shamela-bok'
      ? stored.extractedText ?? ''
      : storedTextSource(stored.data, stored.extractedText)
    if (format === 'markdown') {
      const { renderMarkdownPages } = await import('../markdown_render')
      const rendered = renderMarkdownPages(sourceText, stored.markdownAssets)
      resourceScope.add(() => rendered.assetUrls.forEach(url => URL.revokeObjectURL(url)))
      if (!rendered.pages.length) throw new Error('لا يوجد محتوى Markdown قابل للقراءة')
      reader.classList.add('reader--markdown')
      const live = readingColumn(); stage.replaceChildren(live)
      const nav = renderDomPages(live, rendered.pages, stored.title, stored.author, stored.authorId, resourceScope)
      activePageNavigation = nav
      live.querySelector('.reading__stream')?.prepend(textBookTitlePage(stored))
      if (rendered.toc.length) {
        const entries = rendered.toc.map(entry => ({ num: entry.page, label: entry.title, bookmark: entry.bookmark, level: entry.level }))
        const aside = document.querySelector<HTMLElement>('.reader__toc')
        if (aside) { renderTocAside(aside, 'day', entries); enableTocNavigation(entries, nav) }
      }
      live.dataset.status = 'ready'
      cacheReaderPageCount(stored.id, rendered.pages.length)
      await persistCompletedReaderPageCount(stored.id, rendered.pages.length, saveReaderPageCount)
      printTextBookWhenRequested(stored)
      return
    }
    if (format === 'epub') {
      const { renderEpubRendition } = await import('../epub_rendition')
      const rendered = renderEpubRendition(stored.data, stored.fileName)
      resourceScope.add(rendered.cleanup)
      if (!rendered.pages.length) throw new Error('لا يوجد محتوى EPUB قابل للقراءة')
      reader.classList.add('reader--epub')
      const live = readingColumn(); stage.replaceChildren(live)
      const nav = renderDomPages(live, rendered.pages, stored.title, stored.author, stored.authorId, resourceScope)
      activePageNavigation = nav
      live.querySelector('.reading__stream')?.prepend(textBookTitlePage(stored))
      live.addEventListener('click', (event) => {
        const link = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[data-epub-chapter]')
        if (!link) return
        event.preventDefault()
        const chapter = Number(link.dataset.epubChapter)
        const bookmark = link.hash.slice(1)
        if (!Number.isInteger(chapter)) return
        nav.goTo(chapter)
        routeAnimationFrame(() => document.getElementById(bookmark)?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' }), resourceScope)
      })
      if (rendered.toc.length) {
        const entries = rendered.toc.map(entry => ({ num: entry.page, label: entry.title, bookmark: entry.bookmark, level: entry.level }))
        const aside = document.querySelector<HTMLElement>('.reader__toc')
        if (aside) { renderTocAside(aside, 'day', entries); enableTocNavigation(entries, nav) }
      }
      live.dataset.status = 'ready'
      cacheReaderPageCount(stored.id, rendered.pages.length)
      await persistCompletedReaderPageCount(stored.id, rendered.pages.length, saveReaderPageCount)
      printTextBookWhenRequested(stored)
      return
    }
    const paragraphs = textParagraphs(sourceText)
    if (!paragraphs.length) throw new Error('لا يوجد نص مستخرج قابل للقراءة')
    if (format === 'shamela-bok' && stored.bokPages?.length) {
      const bokDisplayPages = bokLocalPageNumbers(stored.bokPages)
      const tocByPage = new Map<number, Array<{ title: string; bookmark: string; level: number }>>()
      for (const [tocIndex, entry] of (stored.bokToc ?? []).entries()) {
        const titles = tocByPage.get(entry.id) ?? []
        titles.push({ title: entry.title, bookmark: `bok-toc-${tocIndex + 1}`, level: entry.level })
        tocByPage.set(entry.id, titles)
      }
      const deepIndex=parseReaderDeepLink(routeLocation.hash.split('?')[1]??'').pageIndex,savedIndex=Number(identity.getItem(`alkhizana:reading-position:${stored.id}`)),focusIndex=deepIndex??(Number.isInteger(savedIndex)&&savedIndex>=0?savedIndex:0)
      const hydratePage=(page:HTMLElement,source:NonNullable<StoredBook['bokPages']>[number],index:number):void=>{
        if(page.dataset.hydrated==='true')return
        page.dataset.hydrated='true';page.replaceChildren(h('div', { class: 'reader__text-folio', 'aria-hidden': 'true' },
          h('span', null, `الجزء ${arabicNum(source.part)} · الصفحة ${arabicNum(bokDisplayPages[index] ?? source.page)}`),
          ...(source.hadithNumber ? [h('strong', { class: 'reader__hadith-number' }, `حديث ${arabicNum(source.hadithNumber)}`)] : []),
        ))
        const pendingHeadings = [...(tocByPage.get(source.id) ?? [])]
        const compact = (value: string): string => value.replace(/\s+/g, ' ').trim()
        let footnoteContainer: HTMLElement | undefined
        for (const block of shamelaTextBlocks(source.text,source.controls)) {
          if(block.separator){page.appendChild(h('hr',{class:'reader__layer-separator','aria-hidden':'true'}));continue}
          if (block.footnote && !footnoteContainer) {
            footnoteContainer = h('section', { class: 'reader__text-notes', 'aria-label': 'حواشي الصفحة' },
              h('hr', { class: 'reader__text-footnote-rule', 'aria-hidden': 'true' }),
            )
            page.appendChild(footnoteContainer)
          }
          const blockText = compact(block.text)
          const matches = block.footnote ? [] : pendingHeadings.filter(entry => isTocHeading(block.text,entry.title)||blockText.includes(compact(entry.title)))
          for (const entry of matches) {
            pendingHeadings.splice(pendingHeadings.indexOf(entry), 1)
          }
          const exactHeading = matches.find(entry => isTocHeading(block.text,entry.title))
          if (exactHeading) {
            page.appendChild(h('h2', { class: 'reader__text-heading', id: exactHeading.bookmark, dataset: { level: String(exactHeading.level) } }, block.text))
            for (const entry of matches) if (entry !== exactHeading) page.appendChild(h('span', { class: 'reader__text-toc-anchor', id: entry.bookmark, 'aria-hidden': 'true' }))
          } else {
            const basmalah = !block.footnote && isShamelaBasmalah(block.text)
            const paragraph=decorateTextParagraph(block.text,{footnote:block.footnote,indent:block.indent,basmalah})
            // مرساة BOK يجب أن تكون على كتلة النص نفسها، لا span صفري الحجم
            // قبلها؛ وإلا يحسب المتصفح موضعًا قريبًا بعد تحجيم الصفحة.
            // An outline title embedded in prose still receives its own visible
            // heading; leave the original paragraph intact rather than trimming it.
            for (const entry of matches) page.appendChild(h('h2', { class: 'reader__text-heading', id: entry.bookmark, dataset: { level: String(entry.level) } }, entry.title))
            if(block.styleLevel!=null){paragraph.classList.add('reader__layered-text');paragraph.dataset.layer=String(block.styleLevel)}
            const host = block.footnote ? footnoteContainer! : page
            host.appendChild(paragraph)
          }
        }
        // العناوين غير الموجودة حرفيًا في المتن تبقى مرساها عند رأس الصفحة
        // الموثقة بدل إسقاطها أو تخمين فقرة أخرى.
        for (const entry of pendingHeadings.reverse()) page.insertBefore(h('h2', { class: 'reader__text-heading', id: entry.bookmark, dataset: { level: String(entry.level) } }, entry.title), page.children[1] ?? null)
      }
      const pages = stored.bokPages.map((source, index) => {const displayed=bokDisplayPages[index]??source.page;const page=h('section',{class:'page reader__text-page reader__text-page--bok','aria-label':`الجزء ${arabicNum(source.part)} الصفحة ${arabicNum(displayed)}${source.hadithNumber?` الحديث ${arabicNum(source.hadithNumber)}`:''}`});page.dataset.pageIndex=String(index);page.dataset.wordPageNumber=String(displayed);page.dataset.sourcePageNumber=String(source.page);page.dataset.partNumber=String(source.part);if(source.hadithNumber)page.dataset.hadithNumber=String(source.hadithNumber);page.dataset.searchText=source.text;page.dataset.tocBookmarks=(tocByPage.get(source.id)??[]).map(entry=>entry.bookmark).join('|');return page})
      const eager=new Set([0,1,2,focusIndex-2,focusIndex-1,focusIndex,focusIndex+1,focusIndex+2].filter(index=>index>=0&&index<pages.length));for(const index of eager)hydratePage(pages[index]!,stored.bokPages[index]!,index)
      textTrace('bok-dom-built',{pages:pages.length})
      const live = readingColumn(); stage.replaceChildren(live)
      const hydration=new AbortController();resourceScope.add(()=>hydration.abort())
      // BOK pages carry their full source text in memory. Hydrate the current
      // page and a small direction-aware window synchronously, so a deep jump
      // can never land on an empty shell. Superseded distant work is cancelled
      // by generation instead of making a weak device finish an obsolete scan.
      const prepareBokWindow=(center:number,direction:-1|0|1=0):void=>{
        if(hydration.signal.aborted)return
        for(const index of readerHydrationWindow(center,pages.length,direction))hydratePage(pages[index]!,stored.bokPages![index]!,index)
      }
      const nav = renderDomPages(live, pages, stored.title, stored.author, stored.authorId, resourceScope, undefined, prepareBokWindow)
      activePageNavigation = nav
      await nextPaint();textTrace('bok-first-paint',{pages:pages.length})
      textTrace('bok-window-ready',{center:focusIndex})
      live.querySelector('.reading__stream')?.prepend(textBookTitlePage(stored))
      const bokToc = (stored.bokToc ?? []).map((entry, index) => ({
        num: (() => { const pageIndex = stored.bokPages?.findIndex(page => page.id === entry.id) ?? -1; return pageIndex >= 0 ? bokDisplayPages[pageIndex]! : entry.id })(),
        label: entry.title,
        bookmark: `bok-toc-${index + 1}`,
        level: entry.level,
      }))
      const aside = document.querySelector<HTMLElement>('.reader__toc')
      if (aside) { renderTocAside(aside, 'day', bokToc); enableTocNavigation(bokToc, nav) }
      live.dataset.status = 'ready'
      cacheReaderPageCount(stored.id, pages.length); await persistCompletedReaderPageCount(stored.id, pages.length, saveReaderPageCount)
      printTextBookWhenRequested(stored)
      return
    }
    const perPage = 18
    const pages: HTMLElement[] = []
    const headingsByIndex = new Map<number, NonNullable<StoredBook['textToc']>>()
    for (const entry of stored.textToc ?? []) headingsByIndex.set(entry.paragraphIndex, [...(headingsByIndex.get(entry.paragraphIndex) ?? []), entry])
    for (let offset = 0; offset < paragraphs.length; offset += perPage) {
      const pageNumber = pages.length + 1
      const page = h('section', { class: 'page reader__text-page', 'aria-label': `صفحة نصية ${arabicNum(pageNumber)}` })
      page.dataset.pageIndex = String(pageNumber - 1)
      page.dataset.wordPageNumber = String(pageNumber)
      page.appendChild(h('div', { class: 'reader__text-folio', 'aria-hidden': 'true' }, `الصفحة ${arabicNum(pageNumber)}`))
      for (const [relative, text] of paragraphs.slice(offset, offset + perPage).entries()) {
        const headings = headingsByIndex.get(offset + relative)
        const heading = headings?.[0]
        page.appendChild(heading ? h('h2', { class: 'reader__text-heading', id: heading.bookmark ?? `text-heading-${offset + relative}`, dataset: { level: String(heading.level) } }, text.replace(/^#{1,6}\s+/u, '')) : decorateTextParagraph(text, { basmalah: isShamelaBasmalah(text) }))
      }
      pages.push(page)
    }
    const live = readingColumn()
    stage.replaceChildren(live)
    const nav = renderDomPages(live, pages, stored.title, stored.author, stored.authorId, resourceScope)
    activePageNavigation = nav
    live.querySelector('.reading__stream')?.prepend(textBookTitlePage(stored))
    if (stored.textToc?.length) {
      const primaryBookmark = new Map<number, string>()
      for (const entry of stored.textToc) primaryBookmark.set(entry.paragraphIndex, primaryBookmark.get(entry.paragraphIndex) ?? entry.bookmark ?? `text-heading-${entry.paragraphIndex}`)
      const entries = stored.textToc.map(entry => ({ num: Math.floor(entry.paragraphIndex / perPage) + 1, label: entry.title, bookmark: primaryBookmark.get(entry.paragraphIndex)!, level: entry.level }))
      const aside = document.querySelector<HTMLElement>('.reader__toc')
      if (aside) { renderTocAside(aside, 'day', entries); enableTocNavigation(entries, nav) }
    }
    live.dataset.status = 'ready'
    cacheReaderPageCount(stored.id, pages.length)
    await persistCompletedReaderPageCount(stored.id, pages.length, saveReaderPageCount)
    printTextBookWhenRequested(stored)
  } catch (error) {
    console.warn('text_reader_render_failed', stored.id, error)
    const format = inferBookFormat(stored)
    const failure = classifyReaderFailure(error, 'parse', format)
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') stage.dataset.readerError = error instanceof Error ? error.message : String(error)
    stage.replaceChildren(readerFailurePanel(failure, {
      bookTitle: stored.title, bookId: stored.id,
      retry: () => void renderTextSource(reader, stored, resourceScope),
      download: () => downloadBytes(stored.data, stored.fileName, stored.mimeType),
      downloadLabel: format === 'epub' ? 'تنزيل EPUB الأصلي' : format === 'shamela-bok' ? 'تنزيل BOK الأصلي' : 'تنزيل النص الأصلي',
    }))
  }
}

function textBookTitlePage(book: StoredBook): HTMLElement {
  const authors = book.authors?.length ? book.authors.map(author => author.name) : [book.author]
  const metadata = [
    book.investigator ? ['تحقيق', book.investigator] : undefined,
    book.publisher ? ['الناشر', book.publisher] : undefined,
    book.edition ? ['الطبعة', book.edition] : undefined,
    book.publicationYearHijri ? ['سنة النشر', `${book.publicationYearHijri} هـ`] : undefined,
    book.category ? ['التصنيف', book.category] : undefined,
  ].filter((item): item is string[] => Boolean(item))
  const titlePage=h('section', { class: 'reader__text-title-page' },
    brandMark('reader__text-title-logo brand-mark'),
    h('p', { class: 'reader__text-title-kicker' }, 'الخِزانة'),
    h('h2', { dataset: { noTranslate: '' } }, book.title),
    h('p', { class: 'reader__text-title-authors', dataset: { noTranslate: '' } }, authors.filter(Boolean).join('، ')),
    ...(metadata.length ? [h('dl', null, ...metadata.flatMap(([label, value]) => [h('dt', null, label), h('dd', {dataset:{noTranslate:''}}, value)]))] : []),
    h('p', { class: 'reader__text-title-format' }, inferBookFormat(book) === 'shamela-bok' ? 'نسخة نصية من ملف BOK الأصلي' : 'نسخة نصية من ملف EPUB الأصلي'),
  )
  uiTemplateAttribute(titlePage,'aria-label','d7c2d9934cfcf7bf',{p1:book.title})
  return titlePage
}

function printTextBookWhenRequested(book: StoredBook): void {
  const query = routeLocation.hash.split('?')[1] ?? ''
  if (new URLSearchParams(query).get('print') !== '1') return
  const cleanHash = routeLocation.hash.replace(/([?&])print=1(?:&|$)/, (_match, separator: string) => separator === '?' ? '?' : '').replace(/[?&]$/, '')
  history.replaceState(null, '', legacyHashToPath(cleanHash))
  setSourceDocumentTitle(`${book.title} — نسخة PDF منسقة — الخزانة`)
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
}

interface TextBlockOptions { footnote?: boolean; indent?: number; basmalah?: boolean }

function shamelaTextBlocks(text:string,controls:Array<{kind:'separator'|'style';offset:number;level?:number}> = []):Array<{text:string;footnote:boolean;indent:number;separator?:boolean;styleLevel?:number}>{
  for(const control of [...controls].sort((a,b)=>b.offset-a.offset)){const marker=control.kind==='separator'?'\n\uE000separator\n':`\n\uE000style:${control.level??0}\n`;text=text.slice(0,control.offset)+marker+text.slice(control.offset)}
  const normalized = text.replace(/\r\n?/g, '\n')
  const lines = normalized.includes('\n') ? normalized.split('\n') : textParagraphs(normalized)
  const blocks:Array<{text:string;footnote:boolean;indent:number;separator?:boolean;styleLevel?:number}>=[]
  let footnoteSection=false,styleLevel:number|undefined
  for (const raw of lines) {
    const value = cleanShamelaFootnoteMarks(raw.trim())
    if (!value) continue
    if(value==='\uE000separator'){blocks.push({text:'',footnote:false,indent:0,separator:true});continue}
    if(value.startsWith('\uE000style:')){styleLevel=Number(value.slice(7));continue}
    if (/^(?:[_ـ=-]{3,}|الحواشي\s*:?)$/u.test(value)) { footnoteSection = true; continue }
    const explicitFootnote = /^(?:\(\s*\d+\s*\)|\[\s*\d+\s*\]|=)\s*/u.test(value)
    // الفراغات الأولية في قواعد الشاملة ليست تفقيرًا موثوقًا؛ إبقاؤها كان
    // يضيّق بعض الفقرات عشوائيًا من الجانبين في القارئ.
    const footnote = footnoteSection || explicitFootnote
    for (const entry of splitTextualFootnoteEntries(value, footnote)) blocks.push({ text:entry,footnote,indent:0,...styleLevel!=null?{styleLevel}:{} })
  }
  return blocks
}

function decorateTextParagraph(text: string, options: TextBlockOptions = {}): HTMLElement {
  const paragraph = h('p', { class: 'reader__text-paragraph' })
  text = cleanShamelaFootnoteMarks(text)
  if (options.indent) paragraph.dataset.indent = String(options.indent)
  if (options.basmalah) paragraph.classList.add('reader__text-basmalah')
  const isNote = options.footnote || /^(?:\[?\d+[\]\).:\-]|الهامش|حاشية)/u.test(text.trim())
  if (isNote) paragraph.classList.add('reader__text-paragraph--note')
  if (/(?:قال رسول الله|عن النبي|صلى الله عليه وسلم|ﷺ)/u.test(text)) paragraph.classList.add('reader__text-paragraph--hadith')
  // الأقواس وحدها ليست دليلًا قرآنيًا. لا نلوّن متنًا مرشحًا قبل مطابقته
  // exact مع أثر quran-annotations ذي corpusVersion/checksum موثّقين.
  const noteLine = isNote ? parseTextualFootnoteLine(text, true) : undefined
  const visibleText = noteLine?.body ?? text
  if (noteLine?.marker) paragraph.appendChild(h('span', { class: 'reader__text-note-number', 'aria-label': `الحاشية ${noteLine.marker}` }, `(${noteLine.marker}) `))
  if (noteLine?.continuation) paragraph.classList.add('reader__text-paragraph--note-continuation')
  const content = isNote ? h('span', { class: 'reader__text-note-body' }) : paragraph
  const versePattern = /(\[[^\]\n]{2,40}:\s*[\d٠-٩۰-۹][^\]\n]{0,18}\]|\(\s*[\d٠-٩۰-۹]{1,3}\s*\))/gu
  let cursor = 0
  for (const match of visibleText.matchAll(versePattern)) {
    const start = match.index ?? 0
    if (start > cursor) appendShamelaAccessibleText(content, visibleText.slice(cursor, start))
    const token = match[0]
    const className = token.startsWith('[') ? 'reader__text-verse-ref' : 'reader__text-note-ref'
    content.appendChild(h('span', { class: className }, token))
    cursor = start + match[0].length
  }
  if (cursor < visibleText.length) appendShamelaAccessibleText(content, visibleText.slice(cursor))
  if (content !== paragraph) paragraph.appendChild(content)
  return paragraph
}

function appendShamelaAccessibleText(target: HTMLElement, value: string): void {
  for (const part of shamelaSymbolParts(value)) {
    if (!part.label) target.append(document.createTextNode(part.text))
    else target.appendChild(h('span', { class: 'reader__text-shamela-symbol', 'aria-label': part.label, title: part.label }, part.text))
  }
}

function configureReaderSourceLabel(reader: HTMLElement, stored: StoredBook): void {
  const button = reader.querySelector<HTMLElement>('[data-reader-source-action="download"]')
  const original = localOriginalAsset(stored)
  if (!original) { button?.remove(); return }
  const label = button?.querySelector('span')
  if (!label) return
  const format = inferBookFormat(stored)
  const shortLabel = format === 'pdf' ? 'PDF' : format === 'markdown' ? 'Markdown' : format === 'text' ? 'نص' : format === 'epub' ? 'EPUB' : format === 'shamela-bok' ? 'BOK' : 'Word'
  const fullLabel = format === 'pdf' ? 'تحميل PDF' : `تنزيل ${shortLabel} الأصلي`
  label.textContent = shortLabel
  button?.setAttribute('aria-label', fullLabel)
  button?.setAttribute('title', fullLabel)
  if(button && format!=='pdf')for(const attribute of ['aria-label','title'] as const)uiTemplateAttribute(button,attribute,'a42ac02d751540dc',{p1:uiLabelParameter(shortLabel)})
  // PDF المستقل هو نفسه الأصل القابل للتنزيل؛ لا نعرض زر «PDF» مشتقًا
  // ولا «PDF بجوار النص» لكتاب لا يملك متن Word موازيًا.
  if (format === 'pdf') {
    reader.classList.add('reader--pdf-source')
    reader.querySelector<HTMLElement>('[data-reader-pdf-action="download"]')?.remove()
    reader.querySelector<HTMLElement>('[data-reader-pdf-action="beside"]')?.remove()
    // Canvas PDF لا يملك DOM نصيًا يعاد تدفقه أو بحثه؛ إبقاء الزرين كان
    // يوحي بوظائف غير موجودة. بقية الأدوات (السكينة/العلامات/الملاحظات) حقيقية.
    reader.querySelector<HTMLElement>('[data-reader-action="flow"]')?.remove()
  }
}

function cloneReaderPage(page: HTMLElement): HTMLElement | undefined {
  return bestEffortClone(page, source => source.cloneNode(true) as HTMLElement, () => console.warn('reader_page_cache_clone_failed', 'READER-CACHE-CLONE-001'))
}

function cacheReaderPage(id: string, page: HTMLElement): void {
  // Blob-backed pictures belong to the current route and are revoked on exit;
  // retaining such a clone would either leak the URL or reopen a broken image.
  if (page.querySelector('img[src^="blob:"]')) { firstPageCache.delete(id); return }
  const clone = cloneReaderPage(page)
  if (!clone) { firstPageCache.delete(id); return }
  firstPageCache.set(id, clone)
}

function readerFailurePanel(failure: ReaderFailure, actions: {
  bookTitle: string
  bookId: string
  retry: () => void
  fallback?: () => void
  reprocess?: () => void
  download: () => void
  downloadLabel?: string
}): HTMLElement {
  const panel = stateView({ kind: 'error', title: failure.title, description: failure.description })
  panel.prepend(h('p', { class: 'reader-failure__book-title' }, actions.bookTitle))
  panel.dataset.bookId = actions.bookId
  panel.dataset.errorCode = failure.code
  panel.appendChild(h('small', { class: 'reader-failure__code' }, `رمز التشخيص: ${failure.code}`))
  const controls = h('div', { class: 'reader-failure__actions' })
  controls.appendChild(h('button', { class: 'btn btn--primary', type: 'button', 'aria-label': 'إعادة محاولة فتح الكتاب', onclick: actions.retry }, 'إعادة المحاولة'))
  if (actions.reprocess) controls.appendChild(h('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'إعادة معالجة الملف الأصلي', onclick: actions.reprocess }, 'إعادة معالجة الأصل'))
  if (actions.fallback) controls.appendChild(h('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'عرض النص الاحتياطي للكتاب', onclick: actions.fallback }, 'عرض نصي احتياطي'))
  const downloadLabel = actions.downloadLabel ?? 'تنزيل Word الأصلي'
  controls.appendChild(h('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': downloadLabel, onclick: actions.download }, downloadLabel))
  controls.appendChild(h('a', { class: 'btn btn--secondary', href: '#/library' }, 'العودة إلى المكتبة'))
  controls.appendChild(createReaderErrorReportButton({ bookTitle: actions.bookTitle, bookId: actions.bookId, errorCode: failure.code }))
  panel.appendChild(controls)
  return panel
}

function renderPlainReaderFallback(
  live: HTMLElement,
  loadedBooks: LoadedBook[],
  title: string,
  author: string,
  authorId: string | undefined,
  resourceScope: ResourceScope,
): void {
  const pages: HTMLElement[] = []
  loadedBooks.forEach((loaded, partIndex) => {
    for (const group of plainReaderGroups(loaded.model.paragraphs)) {
      const page = h('section', { class: 'page reader__plain-fallback-page' })
      page.lang = 'ar'
      page.dir = 'rtl'
      page.style.width = '794px'
      page.style.minHeight = '1123px'
      page.dataset.partNumber = String(partIndex + 1)
      for (const text of group) page.appendChild(h('p', null, text))
      pages.push(page)
    }
  })
  const nav = renderDomPages(live, pages, title, author, authorId, resourceScope)
  activePageNavigation = nav
  live.dataset.status = 'fallback'
  const warning = h('p', { class: 'reader__fallback-warning', role: 'status' }, 'عرض نصي احتياطي: يحفظ القراءة والتنقل، لكنه لا يدّعي مطابقة صفحات Word أو تنسيقها الطباعي.')
  live.querySelector('.reading__chapter-title')?.after(warning)
}

function readerFidelityNotice(onReprocess: () => Promise<void>): HTMLElement {
  const notice = h('section', { class: 'reader__fidelity-notice', role: 'status', 'aria-live': 'polite' },
    h('strong', null, 'نسخة قراءة تقديرية'),
    h('p', null, 'النص متاح للقراءة، لكن أرقام الصفحات وتخطيطها لم تُوثق بعد من Word؛ لا تعتمدها كنسخة مطبوعة مطابقة.'))
  // HEAD capability probe فقط؛ لا تُرسل بايتات الكتاب. الرفع/المعالجة لا يبدأان
  // إلا من معالج click التالي.
  void getRuntimeCapabilities().then(capabilities => {
    if (!notice.isConnected || !capabilities.wordPdfConversionAvailable) return
    const action = h('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'إعادة معالجة الكتاب عبر Word المحلي' }, 'إعادة المعالجة عبر Word المحلي')
    action.addEventListener('click', async () => {
      action.setAttribute('aria-busy', 'true'); action.setAttribute('disabled', ''); action.textContent = 'جارٍ إعادة المعالجة…'
      try { await onReprocess() }
      catch { toast('تعذّرت إعادة المعالجة؛ بقيت نسخة القراءة الحالية متاحة.') }
      finally { action.removeAttribute('aria-busy'); action.removeAttribute('disabled'); action.textContent = 'إعادة المعالجة عبر Word المحلي' }
    })
    notice.appendChild(action)
  })
  return notice
}

async function reprocessReaderFromOriginal(
  id: string,
  loadFrom: (title: string, loadPromise: Promise<LoadedBook | LoadedBook[]>, wordPageMap?: WordPageMap | Array<WordPageMap | undefined>, physicalPageCount?: number) => void,
): Promise<void> {
  const stored = await getBook(id)
  if (!stored) { toast('لم يُعثر على أصل الكتاب؛ نزّل Word وأضفه من جديد.'); return }
  if (inferBookFormat(stored) !== 'word') { toast('إعادة معالجة Word متاحة لملفات Word فقط.'); return }
  const capabilities = await getRuntimeCapabilities()
  if (!capabilities.wordPdfConversionAvailable) { toast('إعادة المعالجة تحتاج تشغيل الخِزانة المحلي وخدمة Word.'); return }
  // هذا هو الموضع الوحيد الذي يرسل الأصل إلى خدمة المعالجة، وقد وصل إليه
  // المستخدم بنقرة صريحة على زر إعادة المعالجة.
  await convertStoredBookToPdf(id)
  const rebuilt = await getBook(id)
  if (!rebuilt) { toast('تعذّر استعادة الكتاب بعد المعالجة.'); return }
  loadedBookCache.delete(id)
  firstPageCache.delete(id)
  if (rebuilt.volumes?.length) {
    const ordered = [...rebuilt.volumes].sort((a, b) => a.number - b.number)
    loadFrom(rebuilt.title, Promise.resolve(ordered.map(volume => loadBookFromBuffer(volume.data))), ordered.map(volume => volume.wordPageMap), rebuilt.physicalPageCount)
    return
  }
  const fresh = loadBookFromBuffer(rebuilt.data)
  loadedBookCache.set(id, fresh)
  loadFrom(rebuilt.title, Promise.resolve(fresh), rebuilt.wordPageMap, rebuilt.physicalPageCount)
}

async function configureReaderPdfActions(reader: HTMLElement, id: string): Promise<void> {
  const buttons = Array.from(reader.querySelectorAll<HTMLButtonElement>('[data-reader-pdf-action]'))
  if (!buttons.length) return
  const [capabilities, stored] = await Promise.all([getRuntimeCapabilities(), getBook(id)])
  const beside = buttons.find(button => button.dataset.readerPdfAction === 'beside')
  if (beside && stored && pdfButtonAction(stored, 'pdf-text') === 'unavailable') {
    // التوضيح tooltip فقط كما في الأدوات المكتبية؛ لا نفتح نافذة ولا toast
    // عند النقر، ونمنع callback الأصلي من محاولة إنشاء PDF مشتق للمقارنة.
    beside.title = ORIGINAL_PDF_MISSING_TOOLTIP
    beside.dataset.tooltip = ORIGINAL_PDF_MISSING_TOOLTIP
    beside.setAttribute('aria-label', ORIGINAL_PDF_MISSING_TOOLTIP)
    beside.setAttribute('aria-disabled', 'true')
    beside.onclick = event => { event.preventDefault(); event.stopPropagation() }
  }
  if (!needsPdfRefresh(stored ?? {})) return
  if (stored && (stored.bokPages?.length || stored.extractedText?.trim())) {
    return
  }
  if (capabilities.wordPdfConversionAvailable) return
  for (const button of buttons) {
    button.disabled = true
    button.title = 'لا توجد نسخة PDF جاهزة؛ إنشاؤها من Word يحتاج تشغيل الخِزانة المحلي.'
    uiTemplateAttribute(button,'aria-label','0587dc3f680fd785',{p1:uiLabelParameter(button.dataset.readerPdfAction==='beside'?'PDF+نص':'PDF')})
  }
}

/** تفعيل القفز في الفهرس على صفحات DOM (goTo تُقلّب الصفحة المعروضة). */
type TocEntry = { num: number; label: string; bookmark?: string; level?: number; pdfDestination?: PdfTocDestination }
type PageNavigation = { goTo: (i: number) => void; goToDisplayedPage: (page: number) => void; goToBookmark?: (bookmark: string) => boolean; goToPdfDestination?: (page: number, destination: PdfTocDestination) => void; appendPages?: (next: HTMLElement[]) => void; finish?: (total: number) => void; total: number }

/** مساحة القراءة هي المرجع: النافذة الضيقة تحتاج درجًا حتى على لوحة جانبية في الحاسوب. */
function isPhoneReaderViewport(): boolean {
  return window.matchMedia('(max-width: 1024px)').matches
}

/** يركّب نافذة آمنة حول الصفحة المرئية، مع قصها عند أول وآخر الكتاب. */
export function mountReaderPageWindow(pageCount: number, index: number, mount: (pageIndex: number) => void): void {
  const radius = 4
  for (let candidate = Math.max(0, index - radius); candidate <= Math.min(pageCount - 1, index + radius); candidate++) mount(candidate)
}

function enableTocNavigation(_entries: TocEntry[], nav: PageNavigation): void {
  const aside = document.querySelector('.reader__toc')
  if (!aside) return
  const items: { el: HTMLElement; num: number; bookmark?: string; pdfDestination?: PdfTocDestination }[] = (aside as any)?.__tocItems ?? []
  if (items.length === 0) return

  for (const item of items) {
    item.el.onclick = () => {
      const moved = Boolean(item.bookmark && nav.goToBookmark?.(item.bookmark))
      if (!moved && item.pdfDestination && nav.goToPdfDestination) nav.goToPdfDestination(item.num, item.pdfDestination)
      else if (!moved) nav.goToDisplayedPage(item.num)
      // الهاتف يعامل الفهرس كدرج مؤقت؛ أمّا الحاسوب واللوحي فالفهرس عمود
      // ثابت ولا يجوز أن يختفي كلما اختار القارئ عنوانًا.
      if (isPhoneReaderViewport()) {
        aside.classList.remove('reader__toc--mobile-open')
        document.querySelector<HTMLButtonElement>('.reader__toc-toggle')?.setAttribute('aria-expanded', 'false')
      }
    }
  }
}

/** روابط Word الداخلية تقع أحيانًا في صفحة غير مركبة حاليًا؛ بدّل الصفحة أولًا. */
function enableDocumentLinkNavigation(container: HTMLElement, nav: PageNavigation): void {
  container.addEventListener('click', (event) => {
    const link = (event.target as Element | null)?.closest<HTMLElement>('[data-word-bookmark]')
    const bookmark = link?.dataset.wordBookmark
    if (!bookmark || !nav.goToBookmark) return
    event.preventDefault()
    event.stopImmediatePropagation()
    nav.goToBookmark(bookmark)
  }, { capture: true })
}


type ReaderBoundaryButtons = { element: HTMLElement; update: (index: number, total: number) => void }

function readerBoundaryButtons(goFirst: () => void, goLast: () => void): ReaderBoundaryButtons {
  const first = h('button', { class: 'reader__page-boundary-button', type: 'button', title: 'الصفحة الأولى', 'aria-label': 'الصفحة الأولى' }, '↑') as HTMLButtonElement
  const last = h('button', { class: 'reader__page-boundary-button', type: 'button', title: 'الصفحة الأخيرة', 'aria-label': 'الصفحة الأخيرة' }, '↓') as HTMLButtonElement
  first.addEventListener('click', event => { event.preventDefault(); goFirst() })
  last.addEventListener('click', event => { event.preventDefault(); goLast() })
  const update = (index: number, total: number): void => {
    const safeTotal = Math.max(1, Math.floor(Number.isFinite(total) ? total : 1))
    const safeIndex = Math.max(0, Math.min(Math.floor(Number.isFinite(index) ? index : 0), safeTotal - 1))
    first.disabled = safeIndex === 0
    last.disabled = safeIndex === safeTotal - 1
  }
  update(0, 1)
  return { element: h('span', { class: 'reader__page-boundaries', 'aria-label': 'الانتقال إلى طرفي الكتاب' }, first, last), update }
}
/** عرض عمودي مستمر مثل PDF؛ content-visibility يمنع رسم الصفحات البعيدة. */
function renderDomPages(container: HTMLElement, pages: HTMLElement[], title: string, author: string, authorId: string | undefined, resourceScope: ResourceScope, preview?: { preview: true; physicalPageCount?: number }, preparePage?: (index: number, direction: -1 | 0 | 1) => void): PageNavigation {
  const readingIdentity = identityForReader(resourceScope)
  const columnWidth = (): number => container.clientWidth || 680
  const stream = h('div', { class: 'reading__stream', 'aria-label': `${title} — صفحات متتابعة` })
  uiTemplateAttribute(stream,'aria-label','06af96cb55cedae6',{p1:title})
  let progressiveUnknownTotal = Boolean(preview?.preview && preview.physicalPageCount == null)
  const positionText = h('span', { class: 'reading__position-text', role: 'status', 'aria-live': 'polite' },
    readerPositionText(1, progressiveUnknownTotal ? undefined : preview?.physicalPageCount ?? pages.length))
  const identity = h(
    'span',
    { class: 'reading__identity', title: readerIdentityLabel(title, author) },
    h('span', { class: 'reading__book-title' }, title || 'كتاب بدون عنوان'),
    h('span', { class: 'reading__identity-separator', 'aria-hidden': 'true' }, '—'),
    authorLink(author, 'reading__author-link', authorId),
  )
  const progressFill = h('span', { class: 'reading__position-fill' })
  const jumpInput = h('input', { type: 'number', 'aria-label': 'رقم الصفحة للانتقال المباشر' }) as HTMLInputElement
  jumpInput.min = '1'; jumpInput.placeholder = 'صفحة'
  const partNumbers = Array.from(new Set(pages.map(page => Number(page.dataset.partNumber) || 1)))
  const partSelect = h('select', { 'aria-label': 'رقم الجزء' }) as HTMLSelectElement
  for (const part of partNumbers) partSelect.appendChild(h('option', { value: String(part) }, `الجزء ${arabicNum(part)}`))
  let jumpToPage = (_page: number): void => undefined
  let jumpToBoundary = (_boundary: 'first' | 'last'): void => undefined
  const boundaryButtons = readerBoundaryButtons(() => jumpToBoundary('first'), () => jumpToBoundary('last'))
  const jumpForm = h('form', { class: 'reading__page-jump' }, ...(partNumbers.length > 1 ? [partSelect] : []), jumpInput, boundaryButtons.element, h('button', { type: 'submit', 'aria-label': 'الانتقال إلى الصفحة المحددة' }, 'انتقل'))
  jumpForm.addEventListener('submit', (event) => { event.preventDefault(); const page = Number(jumpInput.value); if (Number.isFinite(page) && page > 0) jumpToPage(page) })
  const position = h('div', { class: 'reading__position', 'aria-label': readerIdentityLabel(title, author) }, identity, positionText, jumpForm, h('span', { class: 'reading__position-track', 'aria-hidden': 'true' }, progressFill))
  const bookId = routeLocation.hash.match(/^#\/reader\/([^?]+)/)?.[1] ?? 'book'
  const deepLink = parseReaderDeepLink(routeLocation.hash.split('?')[1] ?? '')
  const requestedParagraph = deepLink.paragraphIndex
  const requestedTafsirPage = deepLink.surah && deepLink.ayah ? pages.findIndex(page => [...page.querySelectorAll<HTMLElement>('[data-tafsir-surah]')].some(node => Number(node.dataset.tafsirSurah) === deepLink.surah && Number(node.dataset.tafsirFrom) <= deepLink.ayah! && Number(node.dataset.tafsirTo) >= deepLink.ayah!)) : -1
  const positionKey = `alkhizana:reading-position:${bookId}`
  activePageNumbers = pages.map((page, index) => Number(page.dataset.wordPageNumber) || index + 1)
  activePartNumbers = pages.map(page => Number(page.dataset.partNumber) || 1)
  activeDisplayedTotal = preview?.physicalPageCount ?? readyReaderTotal(pages.length)
  const slots: HTMLElement[] = []
  let lazyObserver: IntersectionObserver | undefined
  let positionObserver: IntersectionObserver | undefined
  let lastPreparedIndex = -1
  const appendSlot = (page: HTMLElement, index: number): HTMLElement => {
    const width = parseFloat(page.style.width) || 680
    const height = parseFloat(page.style.minHeight) || 960
    const scale = Math.min(1, columnWidth() / width)
    const displayed = arabicNum(page.dataset.wordPageNumber ?? index + 1)
    const knownTotal = page.dataset.wordTotalPages ?? preview?.physicalPageCount
    const slot = h('div', { class: 'reading__page-slot', 'aria-label': knownTotal
      ? `صفحة ${displayed} من ${arabicNum(knownTotal)}`
      : `صفحة ${displayed}` })
    slot.style.minHeight = `${Math.round(height * scale)}px`
    slot.dataset.pageIndex = String(index)
    slot.dataset.partNumber = page.dataset.partNumber ?? '1'
    slot.dataset.partCount = String(partNumbers.length)
    slot.dataset.wordPageNumber = page.dataset.wordPageNumber ?? String(index + 1)
    if (page.dataset.hadithNumber) slot.dataset.hadithNumber = page.dataset.hadithNumber
    slot.dataset.searchText = page.dataset.searchText ?? page.textContent ?? ''
    stream.appendChild(slot)
    slots.push(slot)
    return slot
  }
  pages.forEach((page, index) => appendSlot(page, index))
  const mountedCleanup: Array<Array<() => void> | undefined> = []
  const unmount = (index: number): void => {
    const slot = slots[index]
    const page = pages[index]
    if (!slot || !page || slot.dataset.mounted !== 'true') return
    const wrap = slot.firstElementChild
    if (wrap?.contains(page)) wrap.removeChild(page)
    for (const cleanup of mountedCleanup[index] ?? []) cleanup()
    mountedCleanup[index] = undefined
    slot.replaceChildren()
    slot.dataset.mounted = 'false'
    const width = parseFloat(page.style.width) || 680
    const height = parseFloat(page.style.minHeight) || 960
    const measured = Number(slot.dataset.measuredHeight)
    const reserved = Number.isFinite(measured) && measured > 0
      ? measured : Math.round(height * Math.min(1, columnWidth() / width))
    slot.style.height = `${reserved}px`
    slot.style.minHeight = `${reserved}px`
  }
  const pruneMountedPages = (center: number): void => {
    for (let index = 0; index < slots.length; index++) if (Math.abs(index - center) > 4) unmount(index)
  }
  const updatePosition = (index: number): void => {
    activeReaderPageIndex = Math.max(0, index)
    const page = pages[index]
    const current = page?.dataset.wordPageNumber ?? index + 1
    const progress = readerProgressState(index, pages.length, Boolean(preview?.preview), preview?.physicalPageCount)
    const wordMaximum = Math.max(...pages.map(item => Number(item.dataset.wordTotalPages) || 0), ...pages.map(item => Number(item.dataset.wordPageNumber) || 0))
    const part = Number(page?.dataset.partNumber) || 1
    const total = wordMaximum || progress.total || preview?.physicalPageCount || (progressiveUnknownTotal ? 0 : pages.length)
    const percent = progress.percent ?? Math.max(1, Math.min(100, Math.round(((index + 1) / Math.max(1, total)) * 100)))
    const physicalWord = Boolean(page?.dataset.wordPaginationSource) && partNumbers.length === 1
    const sheet = physicalWord ? readerWordSheetPosition(index,Number(page?.dataset.wordTotalPages)||preview?.physicalPageCount||pages.length,current) : undefined
    positionText.title = sheet?.printedHint ?? ''
    positionText.replaceChildren(readerPositionText(sheet?.current??current, sheet?.total??total, percent))
    progressFill.style.width = `${percent}%`
    boundaryButtons.update(index, pages.length)
    if (partNumbers.length > 1) partSelect.value = String(part)
  }
  container.replaceChildren(
    h('div', { class: 'reading__chapter-title' }, h('h1', null, title), h('span', { class: 'ornament' })),
    position,
    stream,
  )
  const alignPositionToReadingStream = (): void => {
    const rect = stream.getBoundingClientRect()
    if (rect.width > 0) position.style.left = `${Math.round(rect.left + rect.width / 2)}px`
  }
  alignPositionToReadingStream()
  const mount = (index: number): void => {
    if(!readingIdentity.isCurrent())return
    const slot = slots[index]
    const page = pages[index]
    if (!slot || !page || slot.dataset.mounted === 'true') return
    const direction: -1 | 0 | 1 = lastPreparedIndex < 0 ? 0 : index > lastPreparedIndex ? 1 : index < lastPreparedIndex ? -1 : 0
    preparePage?.(index, direction)
    lastPreparedIndex = index
    slot.dataset.mounted = 'true'
    const cleanups: Array<() => void> = []
    mountedCleanup[index] = cleanups
    const wrap = fitPageToWidth(page, columnWidth(), cleanup => cleanups.push(cleanup))
    resourceScope.add(() => { for (const cleanup of cleanups) cleanup() })
    wrap.classList.add('reading__stream-page')
    wrap.tabIndex = 0
    wrap.dataset.pageIndex = String(index)
    // الصفحة قد تُفك من DOM ثم تُركّب مجددًا أثناء التمرير. اقرأ الحالة
    // المحفوظة عند كل تركيب حتى لا يختفي تظليل أُضيف بعد فتح القارئ.
    applyHighlights(wrap, getAnnotations().highlights.filter((highlight) => highlight.bookId === bookId && highlight.pageIndex === index))
    slot.replaceChildren(wrap)
    // التقدير القديم للصفحة غير المركبة لا يبقى خلف الورقة بعد قياسها؛
    // بقاؤه كان يظهر كفاصل بني طويل بين صفحتين.
    slot.style.minHeight = '0px'
  }
  // لا نعتمد على إشعار مراقب التحميل لكل فتحة بمفردها: عند التمرير السريع
  // قد يصبح موضع الصفحة هو المرئي أولًا بينما يتأخر إشعار تركيبه، فتظهر
  // خلفية القارئ وحدها. ظهور أي موضع يعيد الصفحة وجارتيها فورًا، ويضمن كذلك
  // أن الرجوع إلى صفحة سبق فكها لا يحتاج إعادة تحميل الكتاب.
  const mountVisibleWindow = (index: number): void => {
    mountReaderPageWindow(pages.length, index, mount)
  }
  // بعد تكبير صفحات Word تتغير ارتفاعات slots جذريًا، وقد يتأخر
  // IntersectionObserver أو يبقى ممسكًا بالصفحة القديمة. تتبع التمرير
  // المباشر هو المرجع الاحتياطي الحتمي: يركب أقرب صفحة وجارتيها ويحدث بطاقة
  // اسم الكتاب/رقم الصفحة. لا نفك الصفحات التي سبق تركيبها.
  let viewportSyncFrame = 0
  const syncVisiblePageFromViewport = (): void => {
    if (!readingIdentity.isCurrent()) return
    viewportSyncFrame = 0
    alignPositionToReadingStream()
    const viewportCenter = window.innerHeight / 2
    let nearestIndex = 0
    let nearestDistance = Number.POSITIVE_INFINITY
    for (let index = 0; index < slots.length; index++) {
      const rect = slots[index]!.getBoundingClientRect()
      const distance = rect.top <= viewportCenter && rect.bottom >= viewportCenter
        ? 0 : Math.min(Math.abs(rect.top - viewportCenter), Math.abs(rect.bottom - viewportCenter))
      if (distance < nearestDistance) {
        nearestDistance = distance
        nearestIndex = index
        if (distance === 0) break
      }
    }
    mountVisibleWindow(nearestIndex)
    const previousIndex = activeReaderPageIndex
    updatePosition(nearestIndex)
    if (!readingIdentity.setItem(positionKey, String(nearestIndex))) return
    // هذا المسار هو المرجع الاحتياطي عندما تتغير ارتفاعات Word ولا يوقظ
    // IntersectionObserver. يجب أن يعلن الصفحة أيضًا كي يزامن PDF المجاور.
    if (nearestIndex !== previousIndex) announceReaderPage(nearestIndex, pages.length)
  }
  const scheduleViewportSync = (): void => {
    if (viewportSyncFrame) return
    viewportSyncFrame = requestAnimationFrame(syncVisiblePageFromViewport)
  }
  // تغيير نسبة Word ليس تغييرًا بصريًا للصفحة الحالية وحدها: كل slot في
  // التيار يعتمد ارتفاعه على النسبة. إبقاء الصفحات البعيدة غير مركبة كان
  // يترك لها ارتفاع 100% التقديري، ثم يظهر بعد الصفحة الثالثة بياض طويل
  // ويتوقف عداد الموضع عند آخر صفحة سبق قياسها. عند التكبير نقيس الدفعة
  // الموجودة كلها؛ والصفحات التي تصل لاحقًا تقاس في appendPages أدناه.
  const refitAllPagesAfterZoom = (): void => {
    if (pages[0]?.classList.contains('reader__text-page')) {
      // Native-flow text reflows itself; do not hydrate the entire book on +/-.
      // Pin the current page after the new font/zoom metrics settle so changing
      // preceding page heights cannot silently move the reader backwards.
      const anchor = activeReaderPageIndex
      mountVisibleWindow(anchor)
      routeAnimationFrame(() => scrollTo(anchor), resourceScope)
      return
    }
    for (let index = 0; index < pages.length; index++) mount(index)
    scheduleViewportSync()
    routeAnimationFrame(scheduleViewportSync, resourceScope)
  }
  window.addEventListener('scroll', scheduleViewportSync, { passive: true })
  window.addEventListener('resize', scheduleViewportSync, { passive: true })
  window.addEventListener('reader-content-zoom', refitAllPagesAfterZoom)
  resourceScope.add(() => {
    window.removeEventListener('scroll', scheduleViewportSync)
    window.removeEventListener('resize', scheduleViewportSync)
    window.removeEventListener('reader-content-zoom', refitAllPagesAfterZoom)
    if (viewportSyncFrame) cancelAnimationFrame(viewportSyncFrame)
  })
  if (typeof IntersectionObserver === 'undefined') pages.forEach((_, index) => mount(index))
  else {
    lazyObserver = routeObserver(new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const index = Number((entry.target as HTMLElement).dataset.pageIndex)
        mountVisibleWindow(index)
      }
    }, { rootMargin: '1400px 0px' }), resourceScope)
    slots.forEach((slot) => lazyObserver?.observe(slot))
    positionObserver = routeObserver(new IntersectionObserver((entries) => {
      if (!readingIdentity.isCurrent()) return
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      const index = Number((visible.target as HTMLElement).dataset.pageIndex)
      const page = pages[index]
      mountVisibleWindow(index)
      updatePosition(index)
      if (!readingIdentity.setItem(positionKey, String(index))) return
      announceReaderPage(index, pages.length)
    }, { threshold: [0.35, 0.6] }), resourceScope)
    slots.forEach((slot) => positionObserver?.observe(slot))
  }
  mountVisibleWindow(0)
  updatePosition(0)
  const scrollTo = (index: number): void => {
    if (!readingIdentity.isCurrent()) return
    const safe = Math.max(0, Math.min(index, slots.length - 1))
    const direction: -1 | 0 | 1 = lastPreparedIndex < 0 ? 0 : safe > lastPreparedIndex ? 1 : safe < lastPreparedIndex ? -1 : 0
    preparePage?.(safe, direction)
    lastPreparedIndex = safe
    mountVisibleWindow(safe)
    updatePosition(safe)
    if (!readingIdentity.setItem(positionKey, String(safe))) return
    // الانتقال المباشر (الفهرس/الجزء/الصفحة) يجب أن يثبت الهدف قبل أن يرى
    // مراقب الموضع صفحة الطريق ويعيد تقليم نافذة BOK حولها. التمرير الناعم
    // كان يجعل 5/55 يقف عند صفحة قريبة مثل 5/50 في الكتب الكبيرة.
    slots[safe]?.scrollIntoView({ behavior: 'auto', block: 'start' })
    announceReaderPage(safe, pages.length)
  }
  let followLastBoundary = false
  jumpToBoundary = boundary => {
    followLastBoundary = boundary === 'last'
    scrollTo(readerBoundaryIndex(pages.length, boundary))
  }
  const scrollToBookmark = (bookmark: string): void => {
    const target = renderedBookmarkTarget(container, bookmark)
    if (!target) return
    target.scrollIntoView({ behavior: readerScrollBehavior(), block: 'start' })
    // fitPageToWidth والصور/الخطوط قد يغيران قياس الصفحة في الطلاء التالي؛
    // أعد تثبيت العنوان نفسه بعد اكتمال القياس بدل ترك القفزة قربه.
    routeAnimationFrame(() => renderedBookmarkTarget(container, bookmark)?.scrollIntoView({
      behavior: 'auto', block: 'start',
    }), resourceScope)
  }
  jumpToPage = (requested) => {
    if (pages[0]?.dataset.wordPaginationSource && partNumbers.length === 1) { scrollTo(Math.max(0,requested-1)); return }
    const selectedPart = partNumbers.length > 1 ? Number(partSelect.value) : undefined
    const mapped = pages.findIndex((page) => Number(page.dataset.wordPageNumber) === requested && (selectedPart === undefined || Number(page.dataset.partNumber) === selectedPart))
    // عند اختيار جزء لا يجوز السقوط إلى أول صفحة تحمل الرقم نفسه في جزء آخر.
    // إن غاب الرقم المطلوب نبقى داخل الجزء المختار ونذهب إلى أقرب صفحة فيه.
    if (selectedPart !== undefined) {
      const samePart = pages.map((page, index) => ({ page, index }))
        .filter(item => Number(item.page.dataset.partNumber) === selectedPart)
      const nearest = samePart.sort((a, b) => Math.abs(Number(a.page.dataset.wordPageNumber) - requested) - Math.abs(Number(b.page.dataset.wordPageNumber) - requested))[0]?.index
      if (mapped >= 0 || nearest !== undefined) scrollTo(mapped >= 0 ? mapped : nearest!)
      return
    }
    scrollTo(mapped >= 0 ? mapped : readerIndexForDisplayedPage(activePageNumbers, requested))
  }
  // لا تقصّ رابط pageIndex إلى آخر صفحة من الدفعة الأولى؛ صفحات DOCX
  // الموثقة تُلحق تدريجيًا، فاحتفظ بالهدف حتى تصل صفحته الدقيقة.
  const requestedPage = requestedTafsirPage >= 0 ? requestedTafsirPage
    : availableReaderPage(deepLink, pages)
  let pendingRequestedPage = requestedPage < 0 ? deepLink.pageIndex : undefined
  let pendingRequestedParagraph = requestedPage < 0 ? requestedParagraph : undefined
  let pendingWordBookmark: string | undefined
  if (requestedPage >= 0) {
    routeAnimationFrame(() => {
      scrollTo(requestedPage)
      if (requestedParagraph !== undefined) routeAnimationFrame(() => pages[requestedPage]?.querySelector<HTMLElement>(`[data-idx="${requestedParagraph}"]`)?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' }), resourceScope)
      else if (requestedTafsirPage >= 0) routeAnimationFrame(() => {
        const target = [...container.querySelectorAll<HTMLElement>(`[data-tafsir-surah="${deepLink.surah}"]`)].find(node => Number(node.dataset.tafsirFrom) <= deepLink.ayah! && Number(node.dataset.tafsirTo) >= deepLink.ayah!)
        target?.classList.add('reader-deep-link-target'); target?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' })
        if (target) routeTimeout(() => target.classList.remove('reader-deep-link-target'), 2600, resourceScope)
      }, resourceScope)
    }, resourceScope)
  } else {
    const savedIndex = Number(readingIdentity.getItem(positionKey))
    if (Number.isFinite(savedIndex) && savedIndex > 0 && savedIndex < slots.length) routeAnimationFrame(() => scrollTo(savedIndex), resourceScope)
  }
  const appendPages = (next: HTMLElement[]): void => {
    for (const page of next) {
      const index = pages.length
      pages.push(page)
      activePageNumbers.push(Number(page.dataset.wordPageNumber) || index + 1)
      activePartNumbers.push(Number(page.dataset.partNumber) || 1)
      const slot = appendSlot(page, index)
      lazyObserver?.observe(slot)
      positionObserver?.observe(slot)
      // إن كان المستخدم قد غيّر نسبة القراءة قبل اكتمال التصفيح فلا نُلحق
      // صفحة بارتفاع 100% داخل تيار مكبر؛ قِسها فور وصولها كي لا تتحول إلى
      // فراغ أبيض، وليتمكن مراقب الموضع من تحديث العداد عليها مباشرة.
      const reader = container.closest<HTMLElement>('.reader')
      const zoom = Math.max(.1, Number.parseFloat(
        reader ? getComputedStyle(reader).getPropertyValue('--reader-content-zoom') : '',
      ) || 1)
      if (Math.abs(zoom - 1) > .001) mount(index)
    }
    // البحث قد يكون مفتوحًا قبل اكتمال التصفيح التدريجي لملف Word.
    // أخبره بوصول صفحات جديدة بدل إبقائه محصورًا في الدفعة الأولى.
    if(next.length)container.dispatchEvent(new CustomEvent('reader-pages-appended',{bubbles:true,detail:{count:next.length}}))
    if (followLastBoundary && next.length) scrollTo(readerBoundaryIndex(pages.length, 'last'))

    if (pendingWordBookmark) {
      const targetBookmark = pendingWordBookmark
      const pageIndex = pageIndexForBookmark(pages, targetBookmark)
      if (pageIndex >= 0) {
        pendingWordBookmark = undefined
        scrollTo(pageIndex)
        routeAnimationFrame(() => scrollToBookmark(targetBookmark), resourceScope)
      }
    }
    if (pendingRequestedPage !== undefined && pendingRequestedPage < pages.length) {
      const target = pendingRequestedPage
      const paragraph = pendingRequestedParagraph
      pendingRequestedPage = undefined
      pendingRequestedParagraph = undefined
      routeAnimationFrame(() => {
        scrollTo(target)
        if (paragraph !== undefined) routeAnimationFrame(() => pages[target]?.querySelector<HTMLElement>(`[data-idx="${paragraph}"]`)?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' }), resourceScope)
      }, resourceScope)
    } else if (pendingRequestedParagraph !== undefined) {
      const target = availableReaderPage({...deepLink,paragraphIndex:pendingRequestedParagraph},pages)
      if (target >= 0) {
        const paragraph = pendingRequestedParagraph
        pendingRequestedParagraph = undefined
        routeAnimationFrame(() => {
          scrollTo(target)
          routeAnimationFrame(() => pages[target]?.querySelector<HTMLElement>(`[data-idx="${paragraph}"]`)?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' }), resourceScope)
        }, resourceScope)
      }
    }
  }
  return {
    goTo: scrollTo,
    goToDisplayedPage: (page) => scrollTo(readerIndexForDisplayedPage(activePageNumbers, page)),
    goToBookmark: (bookmark) => {
      const targetBookmark = normalizeWordBookmark(bookmark)
      let pageIndex = pageIndexForBookmark(pages, targetBookmark)
      if (pageIndex < 0) pageIndex = pages.findIndex(page => (page.dataset.tocBookmarks ?? '').split('|')
        .some(candidate => normalizeWordBookmark(candidate) === targetBookmark))
      // الصفحة قد لا تكون وصلت بعد من بث Word. قبول الرابط يمنع الرجوع إلى
      // رقم TOC التقريبي؛ appendPages ينفذ الهدف الدقيق عند وصول bookmark.
      if (pageIndex < 0) { pendingWordBookmark = targetBookmark; return Boolean(targetBookmark) }
      scrollTo(pageIndex)
      routeAnimationFrame(() => scrollToBookmark(targetBookmark), resourceScope)
      return true
    },
    appendPages,
    finish: (total) => {
      activeDisplayedTotal = total
      progressiveUnknownTotal = false
      if (followLastBoundary) {
        followLastBoundary = false
        scrollTo(readerBoundaryIndex(pages.length, 'last'))
      } else {
        const current = Math.max(0, slots.findIndex(slot => slot.dataset.mounted === 'true'))
        updatePosition(current)
      }
    },
    get total() { return pages.length },
  }
}

function markText(root: HTMLElement, text: string, className: string, color?: string, onlyOccurrence?: number): void {
  if (!text) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, { acceptNode: (node) => node.parentElement?.closest('mark') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT })
  const nodes: Text[] = []
  let occurrence = 0
  let node: Text | null
  while ((node = walker.nextNode() as Text | null)) nodes.push(node)
  for (const textNode of nodes) {
    const value = textNode.data
    if (!value.includes(text)) continue
    const fragment = document.createDocumentFragment()
    let cursor = 0
    let index = value.indexOf(text)
    while (index >= 0) {
      fragment.append(value.slice(cursor, index))
      if (onlyOccurrence === undefined || occurrence === onlyOccurrence) {
        const mark = document.createElement('mark')
        mark.className = className
        if (color) mark.dataset.highlightColor = color
        mark.textContent = text
        fragment.append(mark)
      } else fragment.append(text)
      occurrence++
      cursor = index + text.length
      index = value.indexOf(text, cursor)
    }
    fragment.append(value.slice(cursor))
    textNode.replaceWith(fragment)
  }
}

function applyHighlights(page: HTMLElement, highlights: ReaderHighlight[]): void {
  for (const highlight of highlights) if(!highlight.sourceReviewRequired) markText(page, highlight.text, 'reader-highlight', highlight.color, highlight.occurrence ?? 0)
}

/** نص الكتاب وحده: مؤشرات الجزء/الصفحة واجهة للقارئ وليست من المصدر. */
export function readerSelectionText(range: Range): string {
  const fragment = range.cloneContents()
  fragment.querySelectorAll('.reader__text-folio').forEach(node => node.remove())
  return (fragment.textContent ?? '').replace(/\s+\n/gu, '\n').trim()
}

function installSelectionMenu(reader: HTMLElement, bookId: string, citation: () => { title: string; author: string }): void {
  const editor=captureAnnotationStores()
  const {addNote,addHighlight}=editor
  const hide = (): void => reader.querySelector('.reader__selection-menu')?.remove()
  routeEventListener(window,'alkhizana:account-changed',hide)
  const show = (): void => {
    if(!editor.isCurrent())return
    const selection = window.getSelection()
    if (!selection?.rangeCount) { hide(); return }
    const range = selection.getRangeAt(0).cloneRange()
    const text = readerSelectionText(range)
    const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement
    const slot = anchor?.closest<HTMLElement>('.reading__page-slot')
    if (!text || !slot) { hide(); return }
    const rect = range.getBoundingClientRect()
    const pageIndex = Number(slot.dataset.pageIndex) || 0
    hide()
    const menu = h('div', { class: 'reader__selection-menu', role: 'toolbar', 'aria-label': 'أدوات النص المحدد' })
    const restoreSelection = (): void => { const live = window.getSelection(); live?.removeAllRanges(); live?.addRange(range) }
    const plainCopy = h('button', { type: 'button', 'aria-label': 'نسخ النص المحدد' }, icon('copy', 16), h('span', null, 'نسخ'))
    plainCopy.addEventListener('click', () => {
      void writeClipboardText(text).then(() => { hide(); selection.removeAllRanges(); toast('نُسخ النص') }).catch(() => toast('تعذّر النسخ'))
    })
    const copy = h('button', { type: 'button', 'aria-label': 'نسخ النص المحدد مع توثيقه' }, icon('box', 16), h('span', null, 'نسخ موثّق'))
    copy.addEventListener('click', () => {
      const meta = citation()
      const part = Number(slot.dataset.partNumber) || 1
      const displayedPage = Number(slot.dataset.wordPageNumber) || pageIndex + 1
      const hadith = Number(slot.dataset.hadithNumber)
      const hadithLabel = Number.isSafeInteger(hadith) && hadith > 0 ? `، حديث ${arabicNum(hadith)}` : ''
      const location = Number(slot.dataset.partCount) > 1 ? `${meta.title} (${arabicNum(part)} / ${arabicNum(displayedPage)}${hadithLabel})` : `${meta.title} (ص ${arabicNum(displayedPage)}${hadithLabel})`
      const source = `${location}${meta.author ? `: ${meta.author}` : ''}`
      const holder = document.createElement('div')
      holder.appendChild(range.cloneContents())
      holder.querySelectorAll('script,style,button,input,textarea,select,.reader__text-folio').forEach(node => node.remove())
      holder.querySelectorAll<HTMLElement>('[id],[data-page-index],[data-part-number],[data-word-page-number]').forEach(node => {
        node.removeAttribute('id'); for (const key of Object.keys(node.dataset)) delete node.dataset[key]
      })
      const payload = buildRichClipboard(text, source, holder.innerHTML)
      void writeRichClipboard(payload).then((mode) => { hide(); selection.removeAllRanges(); toast(mode === 'rich' ? 'نُسخ النص منسقًا مع توثيقه' : 'نُسخ النص مع توثيقه') }).catch(() => toast('تعذّر النسخ'))
    })
    const highlight = h('button', { type: 'button', 'aria-label': 'تظليل النص المحدد' }, h('span', { class: 'highlight-dot', 'aria-hidden': 'true' }), h('span', null, 'تظليل'))
    highlight.addEventListener('click', () => { if(!editor.isCurrent())return; restoreSelection(); hide(); showHighlightPalette(reader, bookId, true) })
    const librarySearch = h('button', { type: 'button', 'aria-label': 'البحث عن النص المحدد في الخزانة' }, icon('search', 16), h('span', null, 'في الخِزانة'))
    librarySearch.addEventListener('click', () => {
      const target = new URL(`#/search?q=${encodeURIComponent(text)}&mode=exact`, location.href).href
      window.open(target, '_blank', 'noopener,noreferrer')
      hide(); selection.removeAllRanges()
    })
    const googleSearch = h('button', { type: 'button', 'aria-label': 'البحث عن النص المحدد في Google' }, icon('globe', 16), h('span', null, 'في Google'))
    googleSearch.addEventListener('click', () => { window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer'); hide(); selection.removeAllRanges() })
    const translation = h('button', { type: 'button', class: 'reader__selection-translate', 'aria-label': 'ترجمة النص المحدد' }, icon('globe', 16), h('span', null, 'ترجم'))
    translation.addEventListener('click', () => { hide(); selection.removeAllRanges(); openTranslationDialog(text) })
    const quote=h('button',{type:'button','aria-label':'حفظ النص المحدد اقتباسًا'},'حفظ اقتباس')
    quote.addEventListener('click',()=>{if(!editor.isCurrent())return;hide();selection.removeAllRanges();openQuotePublishDialog({text,bookId,pageIndex})})
    menu.append(plainCopy, copy, translation, highlight, quote, librarySearch, googleSearch)
    const menuWidth = Math.min(900, window.innerWidth - 16)
    menu.style.insetInlineStart = `${Math.max(8, Math.min(window.innerWidth - menuWidth, rect.left + rect.width / 2 - menuWidth / 2))}px`
    menu.style.insetBlockStart = `${Math.max(70, rect.top - 52)}px`
    reader.appendChild(menu)
  }
  reader.addEventListener('pointerup', (event) => {
    if ((event.target as Element | null)?.closest('.reader__toolbar, .reader__selection-menu, .reader__highlight-menu')) return
    routeAnimationFrame(show)
  })
  reader.addEventListener('keyup', (event) => { if (event.key.startsWith('Arrow') || event.key === 'Shift') routeAnimationFrame(show) })
}

function showHighlightPalette(reader: HTMLElement, bookId: string, saveYellow = false): void {
  const editor=captureAnnotationStores()
  const {addHighlight}=editor
  routeEventListener(window,'alkhizana:account-changed',()=>{reader.querySelector('.reader__highlight-menu')?.remove()})
  const selection = window.getSelection()
  const text = selection?.toString().trim() ?? ''
  const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement
  const slot = anchor?.closest<HTMLElement>('.reading__page-slot')
  if (!text || !slot) { toast('حدّد نصًا من الكتاب أولًا'); return }
  const page = slot.querySelector<HTMLElement>('.reading__stream-page') ?? slot
  const range = selection?.rangeCount ? selection.getRangeAt(0) : undefined
  let occurrence = 0
  if (range) {
    const before = document.createRange(); before.selectNodeContents(page); before.setEnd(range.startContainer, range.startOffset)
    const prefix = before.toString(); let offset = 0
    while ((offset = prefix.indexOf(text, offset)) >= 0) { occurrence++; offset += Math.max(1, text.length) }
  }
  const existing = reader.querySelector('.reader__highlight-menu'); existing?.remove()
  if(saveYellow){
    const saved=addHighlight(bookId, Number(slot.dataset.pageIndex)||0, text, 'important', occurrence)
    markText(page,text,'reader-highlight','important',occurrence)
    selection?.removeAllRanges();openHighlightComment(saved.id);return
  }
  const menu = h('div', { class: 'reader__highlight-menu', role: 'dialog', 'aria-label': 'اختر لون التظليل' }, h('strong', null, 'لون التظليل'))
  const colors: { id: HighlightColor; label: string }[] = [{ id: 'important', label: 'مهم' }, { id: 'evidence', label: 'دليل' }, { id: 'review', label: 'مراجعة' }, { id: 'correction', label: 'تصحيح' }]
  for (const color of colors) {
    const button = h('button', { type: 'button', class: 'reader__highlight-choice', 'aria-label': `تظليل بلون ${color.label}` }, h('span', { 'aria-hidden': 'true' }), color.label)
    button.dataset.highlightColor = color.id
    button.addEventListener('click', () => {
      if(!editor.isCurrent())return
      const saved=addHighlight(bookId, Number(slot.dataset.pageIndex) || 0, text, color.id, occurrence)
      markText(page, text, 'reader-highlight', color.id, occurrence)
      selection?.removeAllRanges(); menu.remove(); openHighlightComment(saved.id)
    })
    menu.appendChild(button)
  }
  reader.querySelector('.reader__toolbar')?.appendChild(menu)
}

function bookInfoAside(bookId: string, title: string): HTMLElement {
  return h('aside', { class: 'reader__info', 'aria-label': 'معلومات الكتاب ومعاينة PDF' },
    h('div', { class: 'reader__info-head' },
      h('div', { class: 'reader__info-identity' },
        h('strong', { class: 'reader__info-book-link', dataset: { bookId } }, title),
        h('span', { class: 'reader__info-author-placeholder', 'aria-hidden': 'true' }),
      ),
    ),
    h('div', { class: 'reader__info-content' }, h('h2', null, title), h('p', null, 'تظهر بيانات الكتاب هنا بعد تحميله.')),
  )
}

function bookInfoDialog(title: string): HTMLElement {
  const close = h('button', { class: 'reader__book-card-close', type: 'button', 'aria-label': 'إغلاق بطاقة الكتاب' }, icon('close', 20))
  const dialog = h('div', {
    class: 'reader__book-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'بطاقة الكتاب', hidden: true,
  },
  h('div', { class: 'reader__book-card-panel' },
    h('div', { class: 'reader__book-card-head' }, h('strong', null, 'بطاقة الكتاب'), close),
    h('div', { class: 'reader__info-identity' }, h('strong', { class: 'reader__info-book-link' }, title)),
    h('div', { class: 'reader__info-content', 'aria-busy': 'true' }, silentSkeleton('cards')),
  ))
  const hide = (): void => { dialog.hidden = true; document.body.classList.remove('reader-book-card-open') }
  close.addEventListener('click', hide)
  dialog.addEventListener('click', event => { if (event.target === dialog) hide() })
  routeEventListener(window, 'keydown', event => { if ((event as KeyboardEvent).key === 'Escape' && !dialog.hidden) hide() })
  return dialog
}

function toggleBookInfoDialog(dialog: HTMLElement): void {
  const opening = dialog.hidden !== false
  dialog.hidden = !opening
  document.body.classList.toggle('reader-book-card-open', opening)
  if (opening) dialog.querySelector<HTMLElement>('.reader__book-card-close')?.focus()
}

function currentPageIndex(bookId: string): number {
  return readingPosition(bookId)
}
function readerReportContext(reader:HTMLElement,bookId:string){
 const selection=window.getSelection(),anchor=selection?.anchorNode instanceof Element?selection.anchorNode:selection?.anchorNode?.parentElement,slot=anchor?.closest<HTMLElement>('.reading__page-slot')
 const inBook=Boolean(slot&&reader.contains(slot)),index=inBook?Number(slot!.dataset.pageIndex)||0:currentPageIndex(bookId),paragraph=inBook?anchor?.closest<HTMLElement>('[data-idx]'):null,paragraphIndex=paragraph?Number(paragraph.dataset.idx):undefined
 const text=inBook?selection?.toString().trim().slice(0,500):''
 return{pageIndex:index,part:activePartNumbers[index]??1,page:activePageNumbers[index]??index+1,...(text?{selectedText:text}:{}),...(typeof paragraphIndex==='number'&&Number.isSafeInteger(paragraphIndex)?{paragraphIndex}: {})}
}

function toggleCurrentBookmark(bookId: string): void {
  const page = currentPageIndex(bookId)
  const added = toggleBookmark(bookId, page)
  toast(added ? `أُضيفت علامة للصفحة ${arabicNum(page + 1)}` : `أزيلت علامة الصفحة ${arabicNum(page + 1)}`)
}

function showAnnotations(panel: HTMLElement, bookId: string): void {
  closePdfPreview(panel)
  panel.classList.add('reader__info--open')
  panel.classList.remove('reader__info--pdf')
  const content = panel.querySelector<HTMLElement>('.reader__info-content')
  if (!content) return
  const editor=annotationEditorBoundary(content)
  const {getAnnotations,addNote,deleteNote,deleteHighlight}=editor
  const render = (): void => {
    if(!editor.isCurrent())return
    const state = getAnnotations()
    const bookmarks = state.bookmarks[bookId] ?? []
    const notes = state.notes.filter((note) => note.bookId === bookId)
    const highlights = state.highlights.filter((highlight) => highlight.bookId === bookId)
    const form = h('form', { class: 'annotation-form' })
    const textarea = h('textarea', { class: 'annotation-form__input', placeholder: `اكتب ملاحظة على الصفحة ${arabicNum(currentPageIndex(bookId) + 1)}…`, 'aria-label': 'نص الملاحظة' }) as HTMLTextAreaElement
    textarea.rows = 4
    form.append(textarea, h('button', { class: 'btn btn--primary', type: 'submit', 'aria-label': 'حفظ الملاحظة' }, 'حفظ الملاحظة'))
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if(!editor.isCurrent())return
      if (!textarea.value.trim()) { toast('اكتب الملاحظة أولًا'); return }
      addNote(bookId, currentPageIndex(bookId), textarea.value)
      toast('حُفظت الملاحظة')
      render()
    })
    const bookmarkList = h('div', { class: 'annotation-list' })
    for (const page of bookmarks) bookmarkList.appendChild(annotationJump(`علامة الصفحة ${arabicNum(page + 1)}`, page, true))
    const noteList = h('div', { class: 'annotation-list' })
    for (const note of notes) {
      const item = annotationJump(note.text, note.pageIndex)
      const remove = h('button', { class: 'annotation-delete', type: 'button', 'aria-label': 'حذف الملاحظة' }, icon('close', 15))
      remove.addEventListener('click', (event) => { event.stopPropagation(); if(!editor.isCurrent())return; if (!confirm(annotationDeletePrompt('ملاحظة', note.pageIndex + 1)) || !editor.isCurrent()) return; deleteNote(note.id); render() })
      item.appendChild(remove)
      noteList.appendChild(item)
    }
    const highlightList = h('div', { class: 'annotation-list' })
    for (const highlight of highlights) {
      const item = annotationJump(highlight.text, highlight.pageIndex)
      if(highlight.sourceReviewRequired)item.append(h('small',null,'تغيّر نص الصفحة؛ التظليل محفوظ ويحتاج إعادة تحديد موضعه.'))
      item.dataset.highlightColor = highlight.color
      const remove = h('button', { class: 'annotation-delete', type: 'button', 'aria-label': 'حذف التظليل' }, icon('close', 15))
      remove.addEventListener('click', (event) => { event.stopPropagation(); if(!editor.isCurrent())return; if (!confirm(annotationDeletePrompt('تظليل', highlight.pageIndex + 1)) || !editor.isCurrent()) return; deleteHighlight(highlight.id); render() })
      item.appendChild(remove); highlightList.appendChild(item)
    }
    content.replaceChildren(
      h('p', { class: 'home-kicker' }, 'قراءتي'), h('h2', null, 'العلامات والملاحظات'), form,
      h('h3', { class: 'annotation-heading' }, `العلامات · ${bookmarks.length}`), bookmarks.length ? bookmarkList : stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد علامات بعد', compact: true }),
      h('h3', { class: 'annotation-heading' }, `الملاحظات · ${notes.length}`), notes.length ? noteList : stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد ملاحظات بعد', compact: true }),
      h('h3', { class: 'annotation-heading' }, `التظليلات · ${highlights.length}`), highlights.length ? highlightList : stateView({ kind: 'empty', icon: 'bookmark', title: 'لا توجد تظليلات بعد', compact: true }),
    )
  }
  render()
}

function annotationJump(label: string, pageIndex: number, bookmarkLabel=false): HTMLElement {
  const item = h('div', { class: 'annotation-item' })
  const jump = h('button', { class: 'annotation-item__jump', type: 'button' }, bookmarkLabel?h('span',null,uiTemplateText('b05c94a3b280ca0d',{p1:arabicNum(pageIndex+1)})):h('span', {dataset:{noTranslate:''}}, label), h('small', null, `صفحة ${arabicNum(pageIndex + 1)}`))
  uiTemplateAttribute(jump,'aria-label','b8ac3058cdde7b1e',{p1:bookmarkLabel?uiLabelParameter(label):label,p2:arabicNum(pageIndex+1)})
  jump.addEventListener('click', () => {
    const page = document.querySelector<HTMLElement>(`.reading__page-slot[data-page-index="${pageIndex}"]`)
    if (page) page.scrollIntoView({ behavior: readerScrollBehavior(), block: 'start' })
    else window.dispatchEvent(new CustomEvent(READER_PAGE_REQUEST_EVENT, { detail: { index: pageIndex } }))
  })
  item.appendChild(jump)
  return item
}

function renderBookInfo(panel: HTMLElement, book: StoredBook): void {
  const metadataBook = withExtractedEditionMetadata(book)
  const category = effectiveBookCategory(book)
  const resolvedTitle = storedReaderTitle(book)
  const content = panel.querySelector('.reader__info-content')
  content?.removeAttribute('aria-busy')
  const identity = panel.querySelector<HTMLElement>('.reader__info-identity')
  identity?.replaceChildren(
    h('strong', { class: 'reader__info-book-link', dataset:{noTranslate:''} }, resolvedTitle),
    bookAuthorLinks(book, 'reader__info-author-link'),
  )
  const format = inferBookFormat(book)
  const formatNames: Record<string, string> = { word: 'Word', pdf: 'PDF', 'shamela-bok': 'BOK', epub: 'EPUB', text: 'نص', markdown: 'Markdown' }
  const sourceLabel = format === 'pdf' ? 'تحميل PDF' : `تحميل ${formatNames[format] ?? 'الملف'} الأصلي`
  const original = localOriginalAsset(book)
  const source = original ? h('button', { class: 'reader__metadata-download', type: 'button', title: sourceLabel, 'aria-label': sourceLabel }, icon('download',18)) : undefined
  source?.addEventListener('click', () => downloadBytes(original!.bytes, original!.fileName, original!.mimeType))
  const pdfLabel = needsPdfRefresh(book) ? 'إنشاء PDF من عرض المتصفح' : 'تحميل PDF'
  const pdf = h('button', { class: 'reader__metadata-link', type: 'button', 'aria-label': pdfLabel }, pdfLabel) as HTMLButtonElement
  pdf.addEventListener('click', () => void downloadConvertedPdf(book.id))
  const edit = h('button', { class: 'reader__metadata-link', type: 'button' }, 'تعديل الكتاب') as HTMLButtonElement
  edit.addEventListener('click', () => {
    void import('./library').then(({ openLibraryBookEditor }) => {
      openLibraryBookEditor(edit, book, saved => renderBookInfo(panel, saved))
    }).catch(error => toast(error instanceof Error ? error.message : 'تعذّر فتح تعديل الكتاب'))
  })
  const facts: HTMLElement[] = [
    h('div', null, h('dt', null, 'الصيغة'), h('dd', {class:'reader__format-actions'}, h('span',null,formatNames[format] ?? format), ...(source ? [source] : []))),
    h('div', null, h('dt', null, 'التصنيف'), h('dd', null, categoryLink(category))),
  ]
  if (book.tags?.length) facts.push(h('div', null, h('dt', null, 'الوسوم'), h('dd', { class: 'reader__book-tags' }, ...book.tags.map(tag => h('a', { class: 'book-tag', href: `#/library?tag=${encodeURIComponent(tag.name)}`, title: tag.source === 'toc' ? 'مستخرج من فهرس الكتاب' : 'أضيف يدويًا' }, h('span',{dataset:{noTranslate:''}},`#${tag.name}`))))))
  if (metadataBook.publisher) facts.push(h('div', null, h('dt', null, 'الناشر'), h('dd', null, metadataBook.publisher)))
  if (metadataBook.edition) facts.push(h('div', null, h('dt', null, 'الطبعة'), h('dd', null, metadataBook.edition)))
  if (metadataBook.investigator) facts.push(h('div', null, h('dt', null, 'التحقيق'), h('dd', null, metadataBook.investigator)))
  if (metadataBook.publicationYearHijri) facts.push(h('div', null, h('dt', null, 'سنة النشر'), h('dd', null, `${arabicNum(metadataBook.publicationYearHijri)}هـ`)))
  if (book.sourceCitation && !isTechnicalSourceCitation(book.sourceCitation)) facts.push(h('div', null, h('dt', null, 'المصدر'), h('dd', null, book.sourceCitation)))
  const volumeCount = bookVolumeCount(metadataBook)
  const pageCount = bookPageCount(book)
  if (volumeCount > 1) facts.push(h('div', null, h('dt', null, 'عدد الأجزاء'), h('dd', null, arabicNum(volumeCount))))
  facts.push(h('div', null, h('dt', null, 'عدد الصفحات'), h('dd', null, pageCount > 0 ? `${arabicNum(pageCount)} صفحة` : 'غير متاح')))
  const actions = h('div', { class: 'reader__book-card-actions reader__book-card-actions--compact', role:'group', 'aria-label':'إجراءات الكتاب' })
  const editorHost = h('section', {hidden:true, 'aria-label':'تعديل الكتاب'})
  const compactActions = (): void => {
    for (const button of actions.querySelectorAll<HTMLButtonElement>('button')) {
      if (button.dataset.compactAction) continue
      const label = button.getAttribute('aria-label') || button.textContent || ''
      button.setAttribute('aria-label', label); button.title ||= label
      const name = /حذف/.test(label) ? 'trash' : /تعديل/.test(label) ? 'settings' : /ملاحظات|علامات/.test(label) ? 'bookmark' : /خطأ|بلاغ/.test(label) ? 'info' : /فتح PDF|بجوار/.test(label) ? 'book' : 'download'
      button.replaceChildren(icon(name, 24))
      button.dataset.compactAction = 'true'
    }
  }
  actions.append(h('button',{type:'button',class:'btn btn--secondary',onclick:()=>showAnnotations(panel,book.id)},'ملاحظاتي الشخصية والعلامات'))
  // Exactly the same policy and handler as the reader's bottom PDF action.
  if (format !== 'pdf') {
    if (pdfButtonAction(book,'standard')==='formatted') {
      pdf.setAttribute('aria-label','فتح PDF المنسق');pdf.title='فتح PDF المنسق'
    }
    actions.appendChild(pdf)
    if(pdfButtonAction(book,'pdf-text')==='original')actions.append(h('button',{type:'button',class:'reader__metadata-link','aria-label':'فتح PDF بجوار النص',title:'فتح PDF بجوار النص',onclick:()=>togglePdfBesideBook(book.id,panel)},icon('book',20)))
  }
  if (format === 'word' && needsPdfRefresh(book)) {
    pdf.title = 'ينشئ PDF داخل المتصفح من صفحات محرك العرض؛ قد تختلف النتيجة قليلًا عن Microsoft Word.'
    void getRuntimeCapabilities().then(capabilities => {
      if (!actions.isConnected) return
      const options = pdfCreationOptions(capabilities)
      pdf.textContent = options.primaryLabel
      delete pdf.dataset.compactAction
      pdf.setAttribute('aria-label', options.primaryLabel)
      if (options.officeHelperAvailable && options.officeLabel) {
        const office = h('button', { class: 'reader__metadata-link', type: 'button', 'aria-label': options.officeLabel, title: 'خيار أعلى دقة يستخدم Microsoft Word المحلي عبر مساعد الخِزانة.' }, options.officeLabel)
        office.addEventListener('click', () => void downloadConvertedPdf(book.id, true))
        actions.appendChild(office)
      }
      compactActions()
    })
  }
  if (book.managedSource !== 'published') {
    actions.appendChild(edit)
    const identity=captureReadingIdentity()
    const remove=h('button',{type:'button',class:'reader__metadata-link','aria-label':'حذف الكتاب من مكتبتي',title:'حذف الكتاب من مكتبتي'},icon('trash',20)) as HTMLButtonElement
    remove.onclick=async()=>{
      if(remove.disabled||!identity.isCurrent()||!confirm(`حذف «${book.title}» من مكتبتك على هذا الجهاز؟`)||!identity.isCurrent())return
      remove.disabled=true
      try{
        const {deleteBook}=await import('../engine/library_store')
        if(!identity.isCurrent())return
        await deleteBook(book.id)
        if(identity.isCurrent()){window.dispatchEvent(new Event('library-changed'));routeLocation.hash='#/library'}
      }catch{if(identity.isCurrent())toast('تعذّر حذف الكتاب؛ أعد المحاولة.')}
      finally{remove.disabled=false}
    }
    actions.append(remove)
  }
  else {
    actions.appendChild(createBookIssueReportButton(book,()=>{
      const pageIndex=currentPageIndex(book.id),selection=window.getSelection()?.toString().replace(/\s+/gu,' ').trim()??''
      return{pageIndex,part:activePartNumbers[pageIndex]??1,page:activePageNumbers[pageIndex]??pageIndex+1,...(selection?{selectedText:selection.slice(0,500)}:{})}
    }))
    const admin = publishedBookControls(book, editorHost)
    if (admin.childElementCount) actions.appendChild(admin)
    else actions.appendChild(managedBookLock('reader__metadata-fixed'))
  }
  compactActions()
  // The linked-edition explanation and any failure detail stay behind a small
  // keyboard-accessible disclosure, beside the managed-source lock.
  actions.append(independentPdfPanel(book,false,true))
  for (const fact of facts) {
    const label = fact.querySelector('dt')
    const name = label?.textContent === 'الصيغة' ? 'book' : label?.textContent === 'التصنيف' ? 'box' : label?.textContent === 'عدد الصفحات' ? 'list' : 'info'
    const title = label?.textContent ?? ''
    if (label && ['الصيغة', 'التصنيف', 'سنة النشر', 'عدد الصفحات'].includes(title)) {
      label.title = title
      label.setAttribute('aria-label', title)
      label.tabIndex = 0
      label.replaceChildren(icon(name, 20))
    } else label?.prepend(icon(name, 18))
  }
  content?.replaceChildren(
    bookCover(book, 'reader__book-cover'),
    actions,
    h('dl', { class: 'reader__metadata' }, ...facts),
    ...(book.description ? [h('section', { class: 'reader__book-card-description' }, h('h3', null, 'عن الكتاب'), h('p', null, book.description))] : []),
    editorHost,
  )
}

function isTechnicalSourceCitation(value: string): boolean {
  return /(?:الشاملة\s*4(?:\.1)?|shamela4_1)\s*(?:—|-|:)/iu.test(value)
}

function storedReaderTitle(book: StoredBook): string {
  const title = book.title?.trim()
  if (title) return title
  const file = book.fileName?.replace(/\.(?:pdf|docx?|rtf|bok|epub|txt|md)$/iu, '').trim()
  return file || 'كتاب محفوظ'
}

function renderReaderInfoIdentity(panel: HTMLElement, book: StoredBook): void {
  panel.querySelector<HTMLElement>('.reader__info-identity')?.replaceChildren(
    h('strong', { class: 'reader__info-book-link', dataset: { bookId: book.id } }, storedReaderTitle(book)),
    bookAuthorLinks(book, 'reader__info-author-link'),
  )
}

function togglePdfBesideBook(id: string, panel: HTMLElement): void {
  if (panel.classList.contains('reader__info--pdf')) {
    closePdfPreview(panel)
    void getBook(id).then(stored => {
      if (!stored || panel.classList.contains('reader__info--pdf')) return
      renderReaderInfoIdentity(panel, stored)
      renderBookInfo(panel, stored)
    })
    return
  }
  const companionReaderIndex = activeReaderPageIndex
  void getBook(id).then(stored => {
    if (!stored || pdfButtonAction(stored, 'pdf-text') === 'unavailable') {
      return
    }
    void showPdfBesideBook(id, panel, false, companionReaderIndex)
  })
}

async function showPdfBesideBook(id: string, panel: HTMLElement, standalone = false, requestedReaderIndex?: number): Promise<void> {
  const identity = identityForReader(panel)
  closePdfPreview(panel)
  const pdfPanel = panel as HTMLElement & {
    __pdfCleanup?: () => void
    __pdfGeneration?: number
    __wordLayoutSnapshot?: Array<{ node: HTMLElement; style: string }>
  }
  const generation = pdfPanel.__pdfGeneration ?? 0
  const isCurrentPreview = (): boolean => identity.isCurrent() && pdfPanel.__pdfGeneration === generation && panel.classList.contains('reader__info--pdf')
  panel.classList.add('reader__info--open', 'reader__info--pdf')
  const readerBody = panel.closest<HTMLElement>('.reader__body')
  const companionReaderIndex = standalone ? undefined : Math.max(0, requestedReaderIndex ?? activeReaderPageIndex)
  if (!standalone && readerBody) {
    pdfPanel.__wordLayoutSnapshot = [...readerBody.querySelectorAll<HTMLElement>('.reader__stage .reading__stream-page, .reader__stage .reading__stream-page > *')]
      .map(node => ({ node, style: node.getAttribute('style') ?? '' }))
  }
  readerBody?.classList.add('reader__body--pdf')
  readerBody?.classList.toggle('reader__body--pdf-only', standalone)
  readerBody?.classList.toggle('reader__body--pdf-companion', !standalone)
  if (!standalone) scheduleWordPageRefit(readerBody, companionReaderIndex)
  const content = panel.querySelector<HTMLElement>('.reader__info-content')
  if (!content) return
  // Keep the reading surface stable while PDF.js prepares the first page.
  // Loading is an implementation detail; only actionable failures are shown.
  content.replaceChildren(h('div', { class: 'reader__pdf-pending', 'aria-hidden': 'true' }))
  try {
    let stored = await getBook(id)
    if (!standalone && (!stored || pdfButtonAction(stored, 'pdf-text') !== 'original')) throw new Error(ORIGINAL_PDF_MISSING_TOOLTIP)
    if (stored && needsPdfRefresh(stored) && !hasOriginalBookPdf(stored)) {
      if (stored.bokPages?.length || stored.extractedText?.trim()) throw new Error('لا توجد نسخة PDF أصلية صالحة لهذا الكتاب.')
        const capabilities = await getRuntimeCapabilities()
        if (!capabilities.wordPdfConversionAvailable) throw new Error('إنشاء PDF يتطلب تشغيل الخِزانة المحلي؛ يمكنك متابعة قراءة Word في نسخة الويب.')
        await convertStoredBookToPdf(id); stored = await getBook(id)
    }
    if (!stored) throw new Error('لم يُعثر على الكتاب في المكتبة')
    const storedPdfBytes = inferBookFormat(stored ?? {}) === 'pdf' && stored?.data?.length ? stored.data : stored?.pdfData
    if (!storedPdfBytes?.length) throw new Error('لا توجد نسخة PDF لهذا الكتاب')
    assertBookFormat(storedPdfBytes, 'pdf')
    const originalPdfBytes = new Uint8Array(storedPdfBytes)
    const pdfRenderBytes = originalPdfBytes.slice()
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    // بعض الخطوط العربية القديمة تتفكك حين يحولها PDF.js إلى WebFont. رسم
    // glyphs من أوامر PDF نفسها يحافظ على تشكيل Word البصري.
    const loadingTask = pdfjs.getDocument({
      data: pdfRenderBytes,
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: true,
      ...pdfJsLocalAssets(),
    })
    pdfPanel.__pdfCleanup = () => { void loadingTask.destroy() }
    const pdfDocument = await loadingTask.promise
    let softwareLoadingTask: ReturnType<typeof pdfjs.getDocument> | undefined
    let softwareDocumentPromise: Promise<typeof pdfDocument> | undefined
    const softwarePdfDocument = (): Promise<typeof pdfDocument> => {
      if (!softwareDocumentPromise) {
        softwareLoadingTask = pdfjs.getDocument({
          data: originalPdfBytes.slice(),
          disableFontFace: true,
          useSystemFonts: false,
          useWasm: false,
          ...pdfJsLocalAssets(),
        })
        softwareDocumentPromise = softwareLoadingTask.promise
      }
      return softwareDocumentPromise
    }
    if (!isCurrentPreview()) { void loadingTask.destroy(); return }
    const total = Math.max(1, pdfDocument.numPages)
    const displayedTotal = standalone ? total : activeDisplayedTotal || total
    // في العرض المستقل تصبح activePageNavigation لاحقًا واجهة PDF نفسها.
    // الاحتفاظ بها بوصفها هدف مزامنة يجعل مراقب التمرير يستدعي goTo على
    // القارئ ذاته؛ ومع عدم وجود خريطة Word كان التحويل يرجع دائمًا إلى 0،
    // فتقفز الصفحة إلى الأولى كلما مرّر القارئ إلى أسفل. هدف المزامنة يجب
    // أن يكون قارئ النص السابق فقط في وضع «PDF بجوار النص».
    const textPageNavigation = standalone ? undefined : activePageNavigation
    const parts = [...(stored.parts ?? [])].sort((a, b) => a.number - b.number)
    const readerIndexForPdf = (pdfIndex: number): number => {
      const pdfPage = pdfIndex + 1
      const part = parts.find(item => pdfPage >= item.startPage && pdfPage <= item.endPage)
      if (!part) return Math.max(0, Math.min(pdfIndex, activePageNumbers.length - 1))
      const wordPage = (part.wordStartPage ?? 1) + pdfPage - part.startPage
      const found = activePageNumbers.findIndex((number, index) => number === wordPage && activePartNumbers[index] === part.number)
      return found >= 0 ? found : Math.max(0, Math.min(pdfIndex, activePageNumbers.length - 1))
    }
    const pdfIndexForReader = (readerIndex: number): number => {
      const part = parts.find(item => item.number === (activePartNumbers[readerIndex] ?? 1))
      if (!part) return Math.max(0, Math.min(readerIndex, total - 1))
      return Math.max(0, Math.min(part.startPage + (activePageNumbers[readerIndex] ?? 1) - (part.wordStartPage ?? 1) - 1, total - 1))
    }
    let pageIndex = initialPdfCompanionIndex(standalone, currentPageIndex(id), companionReaderIndex ?? activeReaderPageIndex, pdfIndexForReader)
    const displayedPage = (pdfIndex: number): number => standalone ? pdfIndex + 1 : activePageNumbers[readerIndexForPdf(pdfIndex)] ?? pdfIndex + 1
    const label = h('strong', { class: 'reader__pdf-page-label', role: 'status' })
    const previous = h('button', { class: 'pager-btn', type: 'button', 'aria-label': 'صفحة PDF السابقة' }, icon('chevron-right', 18)) as HTMLButtonElement
    const next = h('button', { class: 'pager-btn', type: 'button', 'aria-label': 'صفحة PDF التالية' }, icon('chevron-left', 18)) as HTMLButtonElement
    const viewport = h('div', { class: 'reader__pdf-viewport' })
    uiTemplateAttribute(viewport,'aria-label','b9feed4c63fbad24',{p1:stored.title})
    const stream = h('div', { class: 'reader__pdf-stream' })
    const slots = Array.from({ length: total }, (_, index) => {
      const slot = h('section', { class: 'reader__pdf-page', 'aria-label': `صفحة PDF ${arabicNum(index + 1)} من ${arabicNum(total)}` })
      slot.dataset.pdfPageIndex = String(index)
      slot.dataset.pageIndex = String(index)
      slot.dataset.wordPageNumber = String(index + 1)
      slot.dataset.mounted = 'false'
      slot.style.minHeight = '900px'
      stream.appendChild(slot)
      return slot
    })
    viewport.appendChild(stream)
    const alignCompanionPageSlots = (): void => {
      if (standalone || !readerBody) return
      const textStream = readerBody.querySelector<HTMLElement>('.reader__stage .reading__stream')
      const textSlots = [...readerBody.querySelectorAll<HTMLElement>('.reader__stage .reading__page-slot')]
      if (!textStream || !textSlots.length || !slots.length) return
      stream.style.marginBlockStart = '0px'
      const firstTextTop = textSlots[0]!.getBoundingClientRect().top
      const firstPdfTop = slots[0]!.getBoundingClientRect().top
      stream.style.marginBlockStart = `${Math.round(firstTextTop - firstPdfTop)}px`
      const textGap = parseFloat(getComputedStyle(textStream).rowGap) || 0
      const pdfGap = parseFloat(getComputedStyle(stream).rowGap) || 0
      const gapCorrection = textGap - pdfGap
      for (let pdfIndex = 0; pdfIndex < slots.length; pdfIndex++) {
        const textSlot = textSlots[readerIndexForPdf(pdfIndex)]
        if (!textSlot) continue
        const targetHeight = Math.max(1, textSlot.getBoundingClientRect().height + (pdfIndex < slots.length - 1 ? gapCorrection : 0))
        slots[pdfIndex]!.style.height = ''
        slots[pdfIndex]!.style.minHeight = `${Math.round(targetHeight)}px`
      }
      // لا يكفي جمع الارتفاعات النظرية: canvas أو حدود الورقة قد تزيد بضعة
      // بكسلات، ويتراكم الفرق حتى يصير صفحة. صحّح كل رأس بالقياس الحي، وضع
      // كامل الفرق في الفراغ اللاحق للصفحة السابقة من PDF فقط.
      for (let pdfIndex = 1; pdfIndex < slots.length; pdfIndex++) {
        const textSlot = textSlots[readerIndexForPdf(pdfIndex)]
        const previousPdfSlot = slots[pdfIndex - 1]
        if (!textSlot || !previousPdfSlot) continue
        const difference = textSlot.getBoundingClientRect().top - slots[pdfIndex]!.getBoundingClientRect().top
        if (Math.abs(difference) < 1) continue
        const currentHeight = previousPdfSlot.getBoundingClientRect().height
        const canvasHeight = previousPdfSlot.querySelector('canvas')?.getBoundingClientRect().height ?? 0
        const correctedHeight = Math.max(canvasHeight, currentHeight + difference)
        previousPdfSlot.style.height = `${Math.round(correctedHeight)}px`
        previousPdfSlot.style.minHeight = `${Math.round(correctedHeight)}px`
      }
    }
    let companionAlignmentQueued = false
    const scheduleCompanionAlignment = (): void => {
      if (standalone || companionAlignmentQueued) return
      companionAlignmentQueued = true
      routeAnimationFrame(() => { companionAlignmentQueued = false; alignCompanionPageSlots() })
    }
    // صور Word والخطوط وإعادة الملاءمة قد تزيد ارتفاع الصفحة بعد فتح PDF.
    // راقب عمود Word نفسه وأعد محاذاة رؤوس الصفحات، بدل تثبيت قياس أولي
    // يتراكم خطؤه صفحة بعد صفحة. لا يغيّر هذا أي نمط داخل صفحة Word.
    const companionLayoutObserver = !standalone && readerBody && typeof ResizeObserver !== 'undefined'
      ? routeObserver(new ResizeObserver(scheduleCompanionAlignment)) : undefined
    if (companionLayoutObserver && readerBody) {
      const textStream = readerBody.querySelector<HTMLElement>('.reader__stage .reading__stream')
      if (textStream) companionLayoutObserver.observe(textStream)
      readerBody.querySelectorAll<HTMLElement>('.reader__stage .reading__page-slot').forEach(slot => companionLayoutObserver.observe(slot))
    }
    const onCompanionPagesAppended = (): void => {
      if (!companionLayoutObserver || !readerBody) return
      // صفحات Word تُضاف تدريجيًا بعد فتح المقارنة. كانت الصفحات الجديدة
      // خارج ResizeObserver، فيبقى قياس PDF مبنيًا على الدفعة الأولى ويتراكم
      // فرق بضعة أسطر حتى يصير فرق صفحة كاملة.
      readerBody.querySelectorAll<HTMLElement>('.reader__stage .reading__page-slot')
        .forEach(slot => companionLayoutObserver.observe(slot))
      scheduleCompanionAlignment()
    }
    if (readerBody) routeEventListener(readerBody, 'reader-pages-appended', onCompanionPagesAppended)
    const readerRoot = panel.closest<HTMLElement>('.reader')
    let pdfSearchCancelled = false
    // PDF ذو طبقة نصية يُفهرس محليًا في الخلفية. لا تظهر شاشة تحميل ولا
    // يُحجب الرسم؛ كل دفعة توقظ لوحة البحث المفتوحة لتضيف النتائج الجديدة.
    const indexPdfText = async (): Promise<void> => {
      for (let index = 0; index < total && !pdfSearchCancelled; index++) {
        try {
          const pdfPage = await pdfDocument.getPage(index + 1)
          const content = await pdfPage.getTextContent()
          slots[index]!.dataset.searchText = content.items
            .map(item => 'str' in item ? String(item.str) : '').filter(Boolean).join(' ')
          delete slots[index]!.dataset.searchIndexError
        } catch {
          slots[index]!.dataset.searchText = ''
          slots[index]!.dataset.searchIndexError = 'true'
        }
        slots[index]!.dataset.searchIndexed = 'true'
        if (index % 8 === 7 || index === total - 1) {
          readerRoot?.dispatchEvent(new CustomEvent('reader-pages-appended', { detail: { count: Math.min(8, index + 1) } }))
          await readerIdleTurn()
        }
      }
    }
    void indexPdfText()
    const pageInput = h('input', { type: 'number', 'aria-label': 'رقم صفحة PDF للانتقال' }) as HTMLInputElement
    pageInput.min = '1'; pageInput.max = String(displayedTotal); pageInput.value = String(displayedPage(pageIndex))
    const partInput = h('select', { 'aria-label': 'رقم الجزء للانتقال' }) as HTMLSelectElement
    for (const part of parts) partInput.appendChild(h('option', { value: String(part.number) }, part.title || `الجزء ${arabicNum(part.number)}`))
    let goPdfBoundary = (_boundary: 'first' | 'last'): void => undefined
    const pdfBoundaryButtons = readerBoundaryButtons(() => goPdfBoundary('first'), () => goPdfBoundary('last'))
    const jump = h('form', { class: 'reader__pdf-jump' }, ...(parts.length > 1 ? [partInput] : []), pageInput, pdfBoundaryButtons.element, h('button', { type: 'submit', 'aria-label': 'الانتقال إلى صفحة PDF المحددة' }, 'انتقل'))
    let suppressPdfObserverUntil = 0
    let companionTextTarget: number | undefined
    let companionTextTargetGeneration = 0
    const rendered = new Set<number>()
    const renderAttempts = new Map<number, number>()
    const renderedWidths = new Map<number, number>()
    // Chromium على الهاتف قد يُفرغ backing-store للـ canvas تحت ضغط الذاكرة
    // مع إبقاء العنصر وأبعاده. نتذكر الصفحات التي ثبت أن فيها حبرًا كي نميّز
    // ذلك من صفحة PDF بيضاء أصلًا، ونعيد رسم الأولى عند الرجوع للتبويب.
    const pagesWithInk = new Set<number>()
    const renderTasks = new Map<number, { cancel(): void; promise: Promise<unknown> }>()
    let renderTail: Promise<void> = Promise.resolve()
    const invalidatePdfPage = (index: number): void => {
      renderTasks.get(index)?.cancel(); renderTasks.delete(index); rendered.delete(index); renderedWidths.delete(index)
      const slot = slots[index]
      if (slot) { slot.replaceChildren(); slot.style.minHeight = '900px'; slot.dataset.mounted = 'false' }
    }
    // إبقاء نافذة أوسع حول الصفحة المرئية يمنع إفراغ canvas ثم ظهور صفحة
    // بيضاء أثناء التمرير السريع. ما يزال التخزين محدودًا للكتب الكبيرة.
    // الملفات القصيرة (ومنها PDF المرفق بكتب Word) تبقى صفحاتها مرسومة؛
    // إفراغ الصفحة الثانية بعد رسم الغلاف كان يظهر كأن الملف صفحة واحدة.
    // الكتب الكبيرة تظل محدودة الذاكرة بالنافذة القديمة.
    const eagerPdfLimit = 32
    const pdfCacheRadius = total <= eagerPdfLimit ? total : 6
    const prunePdfCache = (center: number): void => {
      for (const index of [...rendered]) {
        if (Math.abs(index - center) <= pdfCacheRadius) continue
        invalidatePdfPage(index)
      }
    }
    const renderPageNow = async (index: number): Promise<void> => {
      const available = Math.max(280, viewport.clientWidth - 24)
      const existing = slots[index]?.querySelector<HTMLCanvasElement>('canvas')
      if (rendered.has(index) && existing && slots[index]?.dataset.mounted === 'true' && Math.abs((renderedWidths.get(index) ?? available) - available) < 28) return
      if (rendered.has(index)) invalidatePdfPage(index)
      const attempt = (renderAttempts.get(index) ?? 0) + 1
      renderAttempts.set(index, attempt)
      const slot = slots[index]
      if (!slot) return
      // لا نعد الصفحة مرسومة قبل نجاح جلبها؛ وإلا يبقى موضع أبيض دائمًا
      // إذا أخفق PDF.js مرة عابرة أثناء فك الصفحة.
      let pdfPage
      try {
        pdfPage = await pdfDocument.getPage(index + 1)
      } catch (error) {
        rendered.delete(index)
        if (attempt < 3) routeAnimationFrame(() => void renderPage(index))
        else slot.replaceChildren(stateView({ kind: 'error', title: 'تعذّر رسم صفحة PDF', description: 'تعذر فك محتوى هذه الصفحة محليًا؛ ملف PDF الأصلي لم يتغير.', compact: true }))
        return
      }
      rendered.add(index)
      const base = pdfPage.getViewport({ scale: 1 })
      const scale = Math.min(2, available / base.width)
      const view = pdfPage.getViewport({ scale })
      // سقف مساحة البكسلات أهم من سقف DPR وحده: بعض هواتف 3x تنشئ لوحات
      // ضخمة ثم يسقطها المتصفح وتظهر المساحة بلون خلفية القارئ. نحافظ على
      // وضوح جيد مع ميزانية ثابتة لكل صفحة.
      const maxCanvasPixels = 4_000_000
      const pixelRatioBudget = Math.sqrt(maxCanvasPixels / Math.max(1, view.width * view.height))
      const ratio = Math.max(1, Math.min(2, window.devicePixelRatio || 1, pixelRatioBudget))
      const canvas = document.createElement('canvas')
      canvas.width = Math.ceil(view.width * ratio); canvas.height = Math.ceil(view.height * ratio)
      canvas.style.width = `${Math.round(view.width)}px`; canvas.style.height = `${Math.round(view.height)}px`
      const context = canvas.getContext('2d')
      if (!context) { rendered.delete(index); return }
      slot.replaceChildren(canvas); slot.style.minHeight = ''
      const task = pdfPage.render({ canvas, canvasContext: context, viewport: view, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
      renderTasks.set(index, task)
      try {
        await task.promise
        slot.dataset.mounted = 'true'
        renderedWidths.set(index, available)
        // على بعض هواتف Chromium تنجح promise بينما تضيع طبقة canvas تحت
        // ضغط الذاكرة/تبديل التبويب. نعيد الحالية مرة واحدة فقط إذا كانت
        // النتيجة بيضاء تمامًا؛ الصفحة البيضاء الصحيحة لا تدخل حلقة.
        const missingInk = pdfCanvasNeedsRepair(slot)
        if (!missingInk) {
          pagesWithInk.add(index)
          renderAttempts.delete(index)
        } else {
          // لا نستبدل الكتاب كله بعارض المتصفح بعد أول لوحة بيضاء. ملفات JPX
          // القديمة قد تفشل مع OpenJPEG/WASM في متصفح بعينه؛ أعد فك الصفحة
          // نفسها بالبديل البرمجي المحلي، مع بقاء بقية الصفحات مستقلة عنها.
          try {
            const softwarePage = await (await softwarePdfDocument()).getPage(index + 1)
            context.clearRect(0, 0, canvas.width, canvas.height)
            const softwareTask = softwarePage.render({ canvas, canvasContext: context, viewport: view, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0] })
            await softwareTask.promise
            if (!pdfCanvasNeedsRepair(slot)) {
              pagesWithInk.add(index)
              renderAttempts.delete(index)
            } else if (attempt < 3 || pagesWithInk.has(index)) {
              routeAnimationFrame(() => { invalidatePdfPage(index); void renderPage(index) })
            }
          } catch {
            if (attempt < 3) routeAnimationFrame(() => { invalidatePdfPage(index); void renderPage(index) })
          }
        }
      } catch (error) {
        rendered.delete(index)
        if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') {
          if (attempt < 3) routeAnimationFrame(() => void renderPage(index))
          else slot.replaceChildren(stateView({ kind: 'error', title: 'تعذّر رسم صفحة PDF', description: 'تعذر فك محتوى هذه الصفحة محليًا؛ ملف PDF الأصلي لم يتغير.', compact: true }))
        }
      } finally { if (renderTasks.get(index) === task) renderTasks.delete(index) }
      if (!standalone) scheduleCompanionAlignment()
    }
    // مفكك JBIG2 المشترك في PDF.js لا يتحمل دائمًا بدء عدة صفحات مصوّرة
    // في اللحظة نفسها. نرسم الحالية أولًا ثم الجارتين بالتتابع؛ لا يؤخر
    // أول ظهور ويمنع فشل صفحات صحيحة بحسب توقيت السباق.
    const renderPage = (index: number): Promise<void> => {
      const scheduled = renderTail.then(() => renderPageNow(index))
      renderTail = scheduled.catch(() => undefined)
      return scheduled
    }
    // يتغير ارتفاع مواضع PDF عند استبدال الحجز الأولي بالـ canvas الحقيقي.
    // أثناء الانتقال البرمجي قد تتحرك الصفحة المطلوبة مؤقتًا، فيرى المراقب
    // صفحة سابقة ويعتمدها كأنها تمرير من المستخدم. نبقي الهدف مقفولًا حتى
    // يكتمل رسمه وجارتيه، ثم نعيد إرساءه مرتين قبل تحرير المراقب.
    let anchoredPdfIndex: number | undefined
    let anchorGeneration = 0
    const settlePdfAnchor = (index: number, destination?: PdfTocDestination): void => {
      const generation = ++anchorGeneration
      anchoredPdfIndex = index
      const nearby = [index, index - 1, index + 1].filter(candidate => candidate >= 0 && candidate < total)
      void Promise.allSettled(nearby.map(candidate => renderPage(candidate))).then(async () => {
        if (generation !== anchorGeneration || pageIndex !== index || !isCurrentPreview()) return
        const anchor = slots[index]
        if (!anchor) return
        let destinationOffset = 0
        if (destination) {
          try {
            const pdfPage = await pdfDocument.getPage(index + 1)
            const base = pdfPage.getViewport({ scale: 1 })
            const scale = Math.min(2, Math.max(280, viewport.clientWidth - 24) / base.width)
            const view = pdfPage.getViewport({ scale })
            destinationOffset = Math.max(0, view.convertToViewportPoint(0, destination.top)[1])
          } catch { destinationOffset = 0 }
        }
        if (generation !== anchorGeneration || pageIndex !== index || !isCurrentPreview()) return
        const exactTop = anchor.offsetTop + destinationOffset
        viewport.scrollTo({ top: exactTop, behavior: 'auto' })
        routeAnimationFrame(() => {
          if (generation !== anchorGeneration || pageIndex !== index || !isCurrentPreview()) return
          viewport.scrollTo({ top: exactTop, behavior: 'auto' })
          routeTimeout(() => { if (generation === anchorGeneration) anchoredPdfIndex = undefined }, 240)
        })
      })
    }
    const setPage = (nextIndex: number, syncText: boolean, smooth = true): void => {
      if (!identity.isCurrent()) return
      pageIndex = Math.max(0, Math.min(nextIndex, total - 1))
      const persistedReaderIndex = pdfPersistedReaderIndex(standalone, pageIndex, readerIndexForPdf)
      if (!identity.setItem(`alkhizana:reading-position:${id}`, String(persistedReaderIndex))) return
      announceReaderPage(persistedReaderIndex, standalone ? total : activeDisplayedTotal || total, 'pdf')
      label.replaceChildren(readerPositionText(displayedPage(pageIndex), displayedTotal))
      pageInput.value = String(displayedPage(pageIndex))
      previous.disabled = pageIndex <= 0
      next.disabled = pageIndex >= total - 1
      pdfBoundaryButtons.update(pageIndex, total)
      suppressPdfObserverUntil = performance.now() + 700
      prunePdfCache(pageIndex)
      void renderPageNow(pageIndex)
      for (const nearby of [pageIndex - 1, pageIndex + 1]) if (nearby >= 0 && nearby < total) void renderPage(nearby)
      const slot = slots[pageIndex]
      // في PDF المنفرد تكون اللوحة هي مساحة التمرير. أما المقارنة مع Word
      // فصفحات PDF جزء من تدفق الصفحة الخارجي، وWord هو مرجع الموضع؛ تمرير
      // اللوحة هنا كان يبقي PDF مربوطًا بالرأس ثم يترك فراغًا بعد الصفحة 2.
      if (standalone && slot) viewport.scrollTo({ top: slot.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
      if (standalone) settlePdfAnchor(pageIndex)
      const textIndex = pdfTextSyncIndex(standalone, pageIndex, readerIndexForPdf)
      if (syncText && textIndex !== undefined) {
        const generation = ++companionTextTargetGeneration
        companionTextTarget = textIndex
        textPageNavigation?.goTo(textIndex)
        // مراقب Word قد يبلغ الصفحة السابقة أثناء استقرار التمرير. أبقِ
        // الهدف الصريح فترة قصيرة كي لا تعيد تلك القراءة PDF صفحة للخلف.
        routeTimeout(() => {
          if (generation === companionTextTargetGeneration) companionTextTarget = undefined
        }, 500)
      }
    }
    goPdfBoundary = boundary => setPage(readerBoundaryIndex(total, boundary), true)
    if (standalone) activePageNavigation = {
      goTo: index => setPage(index, false),
      goToDisplayedPage: page => setPage(page - 1, false),
      goToPdfDestination: (page, destination) => {
        const index = Math.max(0, Math.min(page - 1, total - 1))
        setPage(index, false, false)
        settlePdfAnchor(index, destination)
      },
      total,
    }
    previous.addEventListener('click', () => setPage(pageIndex - 1, true))
    next.addEventListener('click', () => setPage(pageIndex + 1, true))
    jump.addEventListener('submit', (event) => {
      event.preventDefault()
      const requestedPage = Math.max(1, Number(pageInput.value) || 1)
      const selectedPart = parts.find((part) => part.number === Number(partInput.value))
      const mapped = activePageNumbers.findIndex((number) => number === requestedPage)
      const target = selectedPart ? selectedPart.startPage + requestedPage - (selectedPart.wordStartPage ?? 1) - 1 : mapped >= 0 ? pdfIndexForReader(mapped) : requestedPage - 1
      setPage(target, true)
    })
    const onReaderPage = (event: Event): void => {
      const detail = (event as CustomEvent<{ index: number; source?: 'text' | 'pdf' }>).detail
      if (detail?.source === 'pdf') return
      if (Number.isInteger(detail?.index)) {
        if (companionTextTarget !== undefined) {
          if (detail.index !== companionTextTarget) return
          companionTextTarget = undefined
        }
        const target = pdfReaderEventSyncTarget(standalone, pageIndex, detail.index, pdfIndexForReader, detail.source)
        if (target !== undefined) setPage(target, false)
      }
    }
    // PDF المستقل يعلن موضعه للحفظ فقط، ولا ينبغي أن يستمع إلى الإعلان
    // نفسه؛ وإلا أعادت خرائط كتاب سابق تمريره إلى الصفحة صفر.
    if (!standalone) routeEventListener(window, READER_PAGE_EVENT, onReaderPage)
    const renderObserver = routeObserver(new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const index = Number((entry.target as HTMLElement).dataset.pdfPageIndex)
        if (!Number.isInteger(index)) continue
        // IntersectionObserver هو مصدر الحقيقة للصفحات الظاهرة. تقييده
        // بالعداد السابق كان يترك الصفحة التي وصل إليها تمرير سريع بيضاء.
        const slot = slots[index]
        if (slot?.dataset.mounted === 'true' && pdfCanvasNeedsRepair(slot) && (renderAttempts.get(index) ?? 0) < 2) invalidatePdfPage(index)
        void renderPage(index)
      }
    }, { root: standalone ? viewport : null, rootMargin: '900px 0px' }))
    const ratios = new Map<Element, number>()
    const pageObserver = routeObserver(new IntersectionObserver((entries) => {
      if (!identity.isCurrent()) return
      // في العرض المقارن تحدد صفحات Word الموضع المشترك. مراقبة PDF أيضًا
      // تخلق مصدرين متنافسين، فتقفز الثانية ثم ينحدر العداد تلقائيًا.
      if (!standalone) return
      for (const entry of entries) ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0)
      const visible = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0]
      if (!visible || visible[1] < .35) return
      const nextIndex = Number((visible[0] as HTMLElement).dataset.pdfPageIndex)
      if (!Number.isInteger(nextIndex) || nextIndex === pageIndex) return
      // لا تسمح لحركة التخطيط الناتجة عن رسم canvas أن تلغي انتقالًا صريحًا.
      // بعد تحرير القفل يعود المراقب فورًا لتمثيل تمرير المستخدم المعتاد.
      if (anchoredPdfIndex !== undefined && nextIndex !== anchoredPdfIndex) return
      pageIndex = nextIndex
      if (!identity.setItem(`alkhizana:reading-position:${id}`, String(pageIndex))) return
      announceReaderPage(pageIndex, total, 'pdf')
      // قد يصل إشعار تحديد الصفحة قبل إشعار الرسم من IntersectionObserver.
      // كان ذلك يحدّث العداد إلى الصفحة الجديدة بينما تبقى حاويتها البيضاء
      // بلا canvas. اجعل تغيير الصفحة نفسه مسؤولًا دائمًا عن رسمها وجارتيها.
      void renderPageNow(pageIndex)
      for (const nearby of [pageIndex - 1, pageIndex + 1]) {
        if (nearby >= 0 && nearby < total) void renderPage(nearby)
      }
      prunePdfCache(pageIndex)
      label.replaceChildren(readerPositionText(displayedPage(pageIndex), displayedTotal))
      pageInput.value = String(displayedPage(pageIndex))
      previous.disabled = pageIndex <= 0; next.disabled = pageIndex >= total - 1
      const textIndex = pdfTextSyncIndex(standalone, pageIndex, readerIndexForPdf)
      if (performance.now() >= suppressPdfObserverUntil && textIndex !== undefined) textPageNavigation?.goTo(textIndex)
    }, { root: standalone ? viewport : null, threshold: [.35, .55, .75] }))
    const onPageRequest = (event: Event): void => {
      const index = Number((event as CustomEvent<{ index: number }>).detail?.index)
      if (Number.isInteger(index)) setPage(index, true)
    }
    routeEventListener(window, READER_PAGE_REQUEST_EVENT, onPageRequest)
    // لا نعتمد على IntersectionObserver وحده: بعض المتصفحات لا ترسل
    // تقاطع الصفحات البعيدة داخل اللوحة اللزجة، فتظل مواضعها بيضاء.
    // كل تمرير يرسم نافذة الصفحات المرئية وحافتها مباشرةً.
    let viewportRenderQueued = false
    const renderViewportWindow = (): void => {
      if (viewportRenderQueued) return
      viewportRenderQueued = true
      routeAnimationFrame(() => {
        viewportRenderQueued = false
        const top = standalone ? viewport.scrollTop - 700 : -700
        const bottom = standalone ? viewport.scrollTop + viewport.clientHeight + 700 : window.innerHeight + 700
        for (let index = 0; index < slots.length; index++) {
          const slot = slots[index]!
          const slotTop = standalone ? slot.offsetTop : slot.getBoundingClientRect().top
          if (slotTop + slot.offsetHeight < top) continue
          if (slotTop > bottom) break
          void renderPage(index)
        }
      })
    }
    routeEventListener(standalone ? viewport : window, 'scroll', renderViewportWindow, { passive: true })
    slots.forEach((slot) => { renderObserver.observe(slot); pageObserver.observe(slot) })
    let resizeQueued = false
    const repairVisiblePages = (): void => {
      if (resizeQueued) return
      resizeQueued = true
      routeAnimationFrame(() => {
        resizeQueued = false
        for (const index of [pageIndex - 1, pageIndex, pageIndex + 1]) {
          if (index < 0 || index >= total) continue
          const widthChanged = Math.abs((renderedWidths.get(index) ?? 0) - Math.max(280, viewport.clientWidth - 24)) >= 28
          const blankAndRetryable = pdfCanvasNeedsRepair(slots[index]!) && ((renderAttempts.get(index) ?? 0) < 3 || pagesWithInk.has(index))
          if (widthChanged || blankAndRetryable) invalidatePdfPage(index)
          void renderPage(index)
        }
        prunePdfCache(pageIndex)
      })
    }
    routeEventListener(window, 'resize', repairVisiblePages, { passive: true })
    routeEventListener(document, 'visibilitychange', () => { if (document.visibilityState === 'visible') repairVisiblePages() })
    const resizeObserver = typeof ResizeObserver === 'undefined' ? undefined : routeObserver(new ResizeObserver(repairVisiblePages))
    resizeObserver?.observe(viewport)
    pdfPanel.__pdfCleanup = () => {
      pdfSearchCancelled = true
      window.removeEventListener(READER_PAGE_EVENT, onReaderPage)
      renderObserver.disconnect(); pageObserver.disconnect(); resizeObserver?.disconnect(); companionLayoutObserver?.disconnect(); for (const task of renderTasks.values()) task.cancel(); renderTasks.clear(); void loadingTask.destroy(); void softwareLoadingTask?.destroy()
    }
    const controls = h('div', { class: 'reader__pdf-controls', 'aria-label': 'التنقل المتزامن في PDF' }, previous, label, next, jump)
    if (!isCurrentPreview()) return
    content.replaceChildren(controls, viewport)
    await renderPageNow(pageIndex)
    setPage(pageIndex, false, false)
    if (!standalone) routeAnimationFrame(scheduleCompanionAlignment)
    if (total <= eagerPdfLimit) {
      // PDF.js في بعض الملفات القديمة لا يوقظ IntersectionObserver للمواضع
      // التالية قبل أن يُرسم لها canvas. جهزها تباعًا في الخمول، دون حجب
      // الغلاف أو تشغيل مفككات الصفحات بالتوازي.
      void (async () => {
        for (let index = 0; index < total && isCurrentPreview(); index++) {
          if (index !== pageIndex) await renderPage(index)
          await readerIdleTurn()
        }
      })()
    }
    void extractPdfOutline(pdfDocument).then(pdfOutline => {
      if (!pdfOutline.length || !panel.isConnected) return
      const tocAside = document.querySelector<HTMLElement>('.reader__toc')
      if (tocAside) {
        renderTocAside(tocAside, 'day', pdfOutline)
        // الفهرس وجهة دقيقة لا تمرير تقريبي: الحركة السلسة كانت تبدأ قبل
        // اكتمال قياس canvas، فتقف قرب العنوان في النقرة الأولى ولا تصيبه
        // إلا في الثانية. الانتقال القطعي يتبعه قفل المرساة داخل setPage.
        enableTocNavigation(pdfOutline, {
          goTo: index => setPage(index, true, false),
          goToDisplayedPage: page => setPage(page - 1, true, false),
          goToPdfDestination: (page, destination) => {
            const index = Math.max(0, Math.min(page - 1, total - 1))
            setPage(index, true, false)
            if (standalone) settlePdfAnchor(index, destination)
          },
          total,
        })
      }
    }).catch(() => undefined)
  } catch (error) {
    if (!isCurrentPreview()) return
    // بعض ملفات PDF القديمة الصالحة يقبلها قارئ النظام/المتصفح بينما يرفض
    // PDF.js جدول xref أو مرشح صورة فيها. لا نحجب الكتاب كله بسبب المفكك:
    // نعرض الملف الأصلي داخل الصفحة ونبقي تنزيله متاحًا.
    const stored = await getBook(id).catch(() => undefined)
    if (standalone && stored?.pdfData?.length) {
      try {
        assertBookFormat(stored.pdfData, 'pdf')
        const pdfBytes = new Uint8Array(stored.pdfData)
        const blobUrl = URL.createObjectURL(new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' }))
        const frame = h('iframe', {
          class: 'reader__pdf-native-frame',
          src: `${blobUrl}#page=${Math.max(1, currentPageIndex(id) + 1)}&view=FitH`,
        }) as HTMLIFrameElement
        uiTemplateAttribute(frame,'title','ad923e1cf81f5a55',{p1:stored.title})
        const download = h('button', { class: 'btn btn--secondary', type: 'button', 'aria-label': 'تحميل PDF الأصلي' }, 'تحميل PDF الأصلي')
        download.addEventListener('click', () => downloadBytes(stored.pdfData!, stored.pdfFileName ?? `${stored.title}.pdf`, 'application/pdf'))
        content.replaceChildren(
          h('div', { class: 'reader__pdf-source-note', role: 'status' },
            h('strong', null, 'العرض الأصلي المتوافق'),
            h('p', null, 'فتحنا ملف PDF نفسه بعارض الجهاز لأن المفكك الداخلي لم يقبل بنية هذا الإصدار القديم.'),
            download,
          ),
          frame,
        )
        const goToNativePdfPage = (page: number): void => {
          if (!identity.isCurrent()) return
          const target = Math.max(1, Math.floor(page) || 1)
          frame.src = `${blobUrl}#page=${target}&view=FitH`
          if (!identity.setItem(`alkhizana:reading-position:${id}`, String(target - 1))) return
          announceReaderPage(target - 1, target, 'pdf')
        }
        // عند اضطرارنا إلى عارض PDF الأصلي يبقى فهرس الموقع هو المتحكم
        // الرئيس. سابقًا بقيت أزراره مرتبطة بملاحة PDF.js التي توقفت بعد
        // الانتقال إلى iframe، فظهر الفهرس بلا فعل رغم عمل فهرس الملف الداخلي.
        const nativeNavigation: PageNavigation = {
          goTo: index => goToNativePdfPage(index + 1),
          goToDisplayedPage: goToNativePdfPage,
          total: 1,
        }
        activePageNavigation = nativeNavigation
        enableTocNavigation([], nativeNavigation)
        ;(panel as HTMLElement & { __pdfCleanup?: () => void }).__pdfCleanup = () => URL.revokeObjectURL(blobUrl)
        return
      } catch { /* صيغة غير صحيحة فعلًا؛ اعرض رسالة الخطأ الآمنة أدناه. */ }
    }
    const description = error instanceof Error && /ليس (?:DOCX|PDF|BOK|EPUB|نصي)/u.test(error.message) ? invalidBookFormatMessage('pdf') : error instanceof Error ? error.message : invalidBookFormatMessage('pdf')
    content.replaceChildren(stateView({ kind: 'error', title: 'تعذّر فتح معاينة PDF', description, actionLabel: 'إغلاق المعاينة', onAction: () => closePdfPreview(panel), compact: true }))
  }
}

export function pdfCanvasInkCoverage(canvas: HTMLCanvasElement): number {
  const sample = document.createElement('canvas')
  // 32×32 كان يمحو النص الرقيق في الصفحات قليلة السطور ويصنفها بيضاء
  // مع أنها مرسومة. 256×256 ما يزال فحصًا محدودًا لكنه يحفظ حبر النص.
  sample.width = 256; sample.height = 256
  const context = sample.getContext('2d')
  if (!context) return 0
  context.drawImage(canvas, 0, 0, sample.width, sample.height)
  const pixels = context.getImageData(0, 0, sample.width, sample.height).data
  let ink = 0
  for (let index = 0; index < pixels.length; index += 4) if (pixels[index + 3]! > 8 && (pixels[index]! < 248 || pixels[index + 1]! < 248 || pixels[index + 2]! < 248)) ink++
  return ink / (pixels.length / 4)
}

export function pdfCanvasNeedsRepair(slot: HTMLElement): boolean {
  const canvas = slot.querySelector<HTMLCanvasElement>('canvas')
  if (!canvas || canvas.width < 2 || canvas.height < 2) return true
  try { return pdfCanvasInkCoverage(canvas) === 0 } catch { return true }
}

function closePdfPreview(panel: HTMLElement): void {
  const wasPdfOpen = panel.classList.contains('reader__info--pdf')
  const pdfPanel = panel as HTMLElement & {
    __pdfCleanup?: () => void
    __pdfGeneration?: number
    __wordLayoutSnapshot?: Array<{ node: HTMLElement; style: string }>
  }
  pdfPanel.__pdfGeneration = (pdfPanel.__pdfGeneration ?? 0) + 1
  pdfPanel.__pdfCleanup?.()
  delete pdfPanel.__pdfCleanup
  panel.classList.remove('reader__info--pdf', 'reader__info--open')
  panel.querySelector<HTMLElement>('.reader__info-content')?.replaceChildren()
  const readerBody = panel.closest<HTMLElement>('.reader__body')
  readerBody?.classList.remove('reader__body--pdf', 'reader__body--pdf-only', 'reader__body--pdf-companion')
  if (wasPdfOpen && pdfPanel.__wordLayoutSnapshot?.length) {
    for (const { node, style } of pdfPanel.__wordLayoutSnapshot) {
      if (style) node.setAttribute('style', style)
      else node.removeAttribute('style')
    }
    delete pdfPanel.__wordLayoutSnapshot
    routeAnimationFrame(() => activePageNavigation?.goTo(activeReaderPageIndex))
  }
}

/** يعيد تحجيم صفحات Word المركبة بعد أن يتغير عرض العمود عند فتح/إغلاق PDF.
 * لا يغيّر تخطيط Word أو فواصل الصفحات؛ يغيّر مقياس العرض الخارجي فقط. */
function scheduleWordPageRefit(readerBody: HTMLElement | null, preservePageIndex?: number): void {
  if (!readerBody) return
  const apply = (): void => {
    const stage = readerBody.querySelector<HTMLElement>('.reader__stage')
    if (!stage) return
    const maxWidth = Math.max(1, stage.clientWidth)
    for (const wrap of stage.querySelectorAll<HTMLElement>('.reading__stream-page')) {
      const page = wrap.firstElementChild as HTMLElement | null
      if (!page) continue
      const wordWidth = parseFloat(page.style.width)
      const wordHeight = Math.max(parseFloat(page.style.minHeight) || 0, page.scrollHeight)
      const scale = wordWidth > 0 ? Math.min(1, maxWidth / wordWidth) : 1
      page.style.transform = scale < 1 ? `scale(${scale})` : ''
      page.style.transformOrigin = 'top center'
      wrap.style.width = '100%'
      wrap.style.maxWidth = '100%'
      wrap.style.height = `${Math.round(wordHeight * scale)}px`
    }
  }
  routeAnimationFrame(() => { apply(); routeAnimationFrame(() => {
    apply()
    if (preservePageIndex !== undefined) activePageNavigation?.goTo(preservePageIndex)
  }) })
}


/** فتح/إغلاق لوحة الفهرس الجانبية */
function toggleToc(_header: HTMLElement): void {
  const toc = document.querySelector<HTMLElement>('.reader__toc')
  const stage = document.querySelector<HTMLElement>('.reader__stage')
  const toggle = document.querySelector<HTMLButtonElement>('.reader__toc-toggle')
  if (!toc) return
  // لا نحول الفهرس إلى درج عائم إلا على الهاتف الضيق. في الحاسوب
  // واللوحي يبقى عمودًا حقيقيًا عن يمين المتن، لا مساحة محجوزة فارغة.
  if (isPhoneReaderViewport()) {
    const open = toc.classList.toggle('reader__toc--mobile-open')
    toggle?.setAttribute('aria-expanded', String(open))
    return
  }
  const hidden = toc.classList.toggle('reader__toc--hidden')
  toc.dataset.userHidden = String(hidden)
  toc.style.removeProperty('display')
  stage?.classList.toggle('reader__stage--full', hidden)
  toggle?.setAttribute('aria-expanded', String(!hidden))
  if (!hidden) toc.querySelector<HTMLInputElement>('.reader__toc-search')?.focus()
}

/** بحث داخل جميع صفحات الكتاب من دون استبدال مشهد القراءة. */
function toggleSearch(reader: HTMLElement): void {
  const existing = reader.querySelector<HTMLElement>('.reader__search-bar')
  if (existing) { existing.querySelector<HTMLButtonElement>('.reader__search-close')?.click(); return }
  const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const searchButtons = [...reader.querySelectorAll<HTMLElement>('[data-reader-action="search"], button[aria-label="البحث في الكتاب"]')]
  const trigger = active && searchButtons.includes(active) ? active : searchButtons.find(button => button.getClientRects().length > 0) ?? null
  const bar = h('div', { class: 'reader__search-bar', role: 'dialog', 'aria-modal': 'false', 'aria-label': 'البحث داخل الكتاب' })
  const input = h('input', { type: 'search', placeholder: 'ابحث في جميع صفحات الكتاب…', 'aria-label': 'عبارة البحث في الكتاب' }) as HTMLInputElement
  const count = h('span', { class: 'reader__search-count', role: 'status' }, '')
  const previousResult = h('button', { type: 'button', class: 'reader__search-move', 'aria-label': 'نتيجة البحث السابقة' }, icon('chevron-right', 16)) as HTMLButtonElement
  const nextResult = h('button', { type: 'button', class: 'reader__search-move', 'aria-label': 'نتيجة البحث التالية' }, icon('chevron-left', 16)) as HTMLButtonElement
  const results = h('ol', { class: 'reader__search-results', 'aria-label': 'نتائج البحث داخل الكتاب' })
  const moreResults = h('button', { type: 'button', class: 'reader__search-more', hidden: true }, 'عرض نتائج أخرى') as HTMLButtonElement
  type ReaderMatch = { slot: HTMLElement; occurrence: number; offset: number; page: number; text: string }
  let matches: ReaderMatch[] = []
  let current = -1
  let renderedMatches = 0
  let searchTimer = 0
  let searchRevision = 0
  const scheduleSearch=():void=>{window.clearTimeout(searchTimer);searchRevision++;searchTimer=window.setTimeout(runSearch,120)}

  const activate = (): void => {
    const match = matches[current]
    if (!match) return
    while(current>=renderedMatches)appendResults()
    results.querySelectorAll<HTMLElement>('[aria-current="true"]').forEach(node => node.removeAttribute('aria-current'))
    results.children[current]?.querySelector<HTMLElement>('button')?.setAttribute('aria-current', 'true')
    activePageNavigation?.goTo(Number(match.slot.dataset.pageIndex) || 0)
    routeAnimationFrame(() => routeAnimationFrame(() => {
      if (!bar.isConnected || matches[current] !== match) return
      const target = markReaderSearchOccurrence(match.slot, input.value.trim(), match.occurrence)
      target?.scrollIntoView({ behavior: 'auto', block: 'center' })
    }))
    count.textContent = `${arabicNum(current + 1)} من ${arabicNum(matches.length)}`
  }

  const appendResults=():void=>{
    const end=Math.min(matches.length,renderedMatches+200)
    matches.slice(renderedMatches,end).forEach((match,relativeIndex) => {
      const index=renderedMatches+relativeIndex
      const q=input.value.trim()
      const from = Math.max(0, match.offset - 44)
      const to = Math.min(match.text.length, match.offset + q.length + 70)
      const snippet = `${from ? '…' : ''}${match.text.slice(from, to).replace(/\s+/g, ' ').trim()}${to < match.text.length ? '…' : ''}`
      const button = h('button', { type: 'button', class: 'reader__search-result' },
        h('span', { class: 'reader__search-result-meta' }, uiTemplateText('1393f9791e896eb9',{p1:index+1,p2:match.page})),
        h('span', { class: 'reader__search-result-snippet', dataset:{noTranslate:''} }, snippet),
      ) as HTMLButtonElement
      uiTemplateAttribute(button,'aria-label','c5714523a62a1c37',{p1:index+1,p2:match.page,p3:snippet})
      button.addEventListener('click', () => { current = index; activate() })
      results.appendChild(h('li', null, button))
    })
    renderedMatches=end
    moreResults.hidden=renderedMatches>=matches.length
    if(!moreResults.hidden)moreResults.textContent=`عرض ${arabicNum(Math.min(200,matches.length-renderedMatches))} نتيجة أخرى`
  }

  const runSearch = (): void => {
    const revision = ++searchRevision
    reader.querySelectorAll('mark.reader-search-mark').forEach(mark => mark.replaceWith(document.createTextNode(mark.textContent ?? '')))
    const q = input.value.trim()
    results.replaceChildren();renderedMatches=0;moreResults.hidden=true
    if (!q) { matches = []; current = -1; count.textContent = ''; return }
    const slots = [...reader.querySelectorAll<HTMLElement>('.reading__page-slot,.reader__pdf-page')]
    const failedPdfPages=slots.filter(slot=>slot.dataset.searchIndexError==='true').length
    matches = searchReaderPageTexts(slots.map((slot, index) => ({
      text: slot.dataset.searchText ?? '',
      pageNumber: Number(slot.dataset.wordPageNumber) || index + 1,
    })), q).map(match => ({
      slot: slots[match.pageIndex]!, occurrence: match.occurrence, offset: match.offset,
      page: match.pageNumber, text: match.text,
    }))
    if (revision !== searchRevision) return
    current = matches.length ? 0 : -1
    count.textContent = matches.length
      ? `${arabicNum(matches.length)} نتيجة${failedPdfPages?` · تعذر فحص ${arabicNum(failedPdfPages)} صفحة PDF`:''}`
      : failedPdfPages
        ? `تعذر فحص نص PDF في ${arabicNum(failedPdfPages)} صفحة`
        : 'لا توجد نتائج'
    previousResult.disabled = nextResult.disabled = matches.length === 0
    appendResults()
    requestAnimationFrame(position)
  }

  const move = (delta: number): void => {
    if (!matches.length) return
    current = nextReaderSearchIndex(current, matches.length, delta < 0 ? -1 : 1)
    activate()
  }
  previousResult.addEventListener('click', () => move(-1))
  nextResult.addEventListener('click', () => move(1))
  moreResults.addEventListener('click',()=>{appendResults();requestAnimationFrame(position)})
  previousResult.disabled = nextResult.disabled = true
  input.addEventListener('input',scheduleSearch)
  const onPagesAppended=():void=>{if(input.value.trim())scheduleSearch()}
  reader.addEventListener('reader-pages-appended',onPagesAppended)
  input.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') { event.preventDefault(); move(1) }
    else if (event.key === 'ArrowUp') { event.preventDefault(); move(-1) }
    else if (event.key === 'Enter' && matches.length) { event.preventDefault(); if (current < 0) current = 0; activate() }
  })

  const closeBtn = h('button', { class: 'reader__search-close', type: 'button', 'aria-label': 'إغلاق البحث داخل الكتاب' }, '✕') as HTMLButtonElement
  const outside = (event: Event): void => { if (!bar.contains(event.target as Node) && event.target !== trigger) close() }
  const close = (): void => {
    window.clearTimeout(searchTimer); searchRevision++
    document.removeEventListener('pointerdown', outside, true)
    window.removeEventListener('resize', position)
    window.removeEventListener('scroll', position, true)
    window.visualViewport?.removeEventListener('resize', position)
    window.visualViewport?.removeEventListener('scroll', position)
    reader.removeEventListener('reader-pages-appended',onPagesAppended)
    bar.remove(); trigger?.focus()
  }
  closeBtn.onclick = close
  bar.addEventListener('keydown', event => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key !== 'Tab') return
    const focusable = [...bar.querySelectorAll<HTMLElement>('input,button,[tabindex]:not([tabindex="-1"])')].filter(node => !node.hasAttribute('disabled'))
    if (!focusable.length) return
    const first = focusable[0]!, last = focusable[focusable.length - 1]!
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
  })
  bar.append(h('div', { class: 'reader__search-head' }, input, previousResult, nextResult, count, closeBtn), results, moreResults)
  reader.appendChild(bar)
  const position = (): void => {
    if (!trigger?.isConnected) return
    const anchor = trigger.getBoundingClientRect()
    const surface = bar.getBoundingClientRect()
    const viewport = window.visualViewport
    const viewportLeft = viewport?.offsetLeft ?? 0
    const viewportTop = viewport?.offsetTop ?? 0
    const viewportWidth = viewport?.width ?? window.innerWidth
    const viewportHeight = viewport?.height ?? window.innerHeight
    const width = Math.min(460, viewportWidth - 16)
    const left = Math.max(viewportLeft + 8, Math.min(viewportLeft + viewportWidth - width - 8, anchor.left + anchor.width / 2 - width / 2))
    const roomAbove = anchor.top - viewportTop - 8
    const above = roomAbove >= Math.min(surface.height, viewportHeight - 16)
    const top = above
      ? anchor.top - surface.height - 8
      : Math.min(viewportTop + viewportHeight - surface.height - 8, anchor.bottom + 8)
    bar.style.insetInline = 'auto'
    bar.style.width = `${width}px`
    bar.style.left = `${left}px`
    bar.style.right = 'auto'
    bar.style.top = `${Math.max(8, top)}px`
  }
  window.addEventListener('resize', position)
  window.addEventListener('scroll', position, true)
  window.visualViewport?.addEventListener('resize', position)
  window.visualViewport?.addEventListener('scroll', position)
  requestAnimationFrame(() => { position(); document.addEventListener('pointerdown', outside, true) })
  setTimeout(() => input.focus(), 0)
}

/** شريط التنقل بين الصفحات مع أرقام الصفحات */
function scenePager(
  current: number, total: number, goTo: (d: number) => void,
  displayCurrent = current + 1, displayTotal = total,
): HTMLElement {
  const nav = h('div', { class: 'reading__pager' })
  nav.style.cssText = 'display:flex;align-items:center;justify-content:center;gap:8px;margin-block:12px'
  const prev = h('button', {
    class: 'pager-btn',
    disabled: current <= 0,
    'aria-label': 'الصفحة السابقة',
    onclick: () => goTo(-1),
  }, icon('chevron-right', 18))
  const next = h('button', {
    class: 'pager-btn',
    disabled: current >= total - 1,
    'aria-label': 'الصفحة التالية',
    onclick: () => goTo(+1),
  }, icon('chevron-left', 18))
  const label = document.createElement('span')
  label.style.cssText = 'font-size:13px;color:var(--read-muted);min-width:100px;text-align:center'
  // صياغة عربية صريحة تمنع BiDi من قلب «الحالي / الإجمالي» بصريًا.
  label.replaceChildren(readerPositionText(displayCurrent, displayTotal))
  nav.appendChild(prev)
  nav.appendChild(label)
  nav.appendChild(next)
  return nav
}

async function copyCurrentSelection(sel: { hasSelection: () => boolean; copySelection: () => Promise<boolean> }): Promise<void> {
  try {
    const copied = await sel.copySelection()
    toast(copied ? 'تم نسخ التحديد' : 'حدّد نصًا أولًا')
  } catch (err: unknown) {
    toast(`تعذّر النسخ: ${err instanceof Error ? err.message : String(err)}`)
  }
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }
  const ta = document.createElement('textarea')
  ta.value = text
  ta.setAttribute('readonly', '')
  ta.style.position = 'fixed'
  ta.style.left = '-9999px'
  document.body.appendChild(ta)
  ta.select()
  const ok = document.execCommand('copy')
  ta.remove()
  if (!ok) throw new Error('Clipboard API غير متاحة')
}

async function downloadOriginalBook(id: string, builtIn: ReturnType<typeof bookById>): Promise<void> {
  if (builtIn?.docx) {
    const response = await fetch(builtIn.docx)
    if (!response.ok) { toast('تعذّر جلب ملف Word الأصلي'); return }
    downloadBytes(new Uint8Array(await response.arrayBuffer()), `${builtIn.title}.docx`,
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
    return
  }
  const stored = await getBook(id)
  if (!stored) { toast('ملف الكتاب الأصلي غير موجود'); return }
  if (stored.volumes && stored.volumes.length > 1) {
    const volumes = [...stored.volumes].sort((a, b) => a.number - b.number)
    const originals = volumes.map(volume => localOriginalAsset(volume)).filter((asset): asset is NonNullable<typeof asset> => Boolean(asset))
    if (originals.length !== volumes.length) { toast('بعض ملفات الأجزاء الأصلية غير متاحة؛ لم يبدأ تنزيل ناقص'); return }
    for (const original of originals) {
      downloadBytes(original.bytes, original.fileName, original.mimeType)
      await new Promise(resolve => setTimeout(resolve, 120))
    }
    toast(`بدأ تنزيل ${arabicNum(originals.length)} أجزاء بصيغها الأصلية`)
    return
  }
  const original = localOriginalAsset(stored)
  if (!original) { toast('ملف الكتاب الأصلي غير متاح لهذا الكتاب'); return }
  downloadBytes(original.bytes, original.fileName, original.mimeType)
}

async function downloadConvertedPdf(id: string, preferOffice = false): Promise<void> {
  let stored = await getBook(id)
  if (!stored) { toast('نسخة PDF متاحة للكتب المرفوعة بعد حفظها في المكتبة'); return }
  const action = pdfButtonAction(stored, 'standard')
  if (action === 'original') {
    const bytes = inferBookFormat(stored) === 'pdf' && hasOriginalBookPdf(stored) ? stored.data : stored.pdfData
    if (bytes?.length) downloadBytes(bytes, stored.pdfFileName ?? `${stored.title}.pdf`, 'application/pdf')
    return
  }
  if (action === 'formatted') {
    try {
      toast('جارٍ تجهيز PDF المنسق…')
      const { openFormattedBookPdf } = await import('../formatted_book_pdf')
      await openFormattedBookPdf(stored)
    }
    catch (error) { toast(error instanceof Error && error.message === 'formatted_pdf_text_unavailable' ? 'لا يتوفر نص صالح لإنشاء PDF لهذا الكتاب' : 'تعذّر إنشاء PDF المنسق الآن') }
    return
  }
  if (needsPdfRefresh(stored)) {
    const capabilities = await getRuntimeCapabilities()
    if (preferOffice && !capabilities.wordPdfConversionAvailable) {
      toast('مساعد Word المحلي غير متاح؛ استخدم إنشاء PDF من عرض المتصفح.')
      return
    }
    toast(preferOffice
      ? (stored.volumes && stored.volumes.length > 1 ? 'جارٍ تحويل أجزاء Word ودمجها عبر Microsoft Word…' : 'جارٍ إنشاء PDF عالي الدقة عبر Microsoft Word المحلي…')
      : 'جارٍ إنشاء PDF داخل المتصفح من صفحات العرض؛ قد يختلف قليلًا عن Word…')
    try {
      await convertStoredBookToPdf(id, preferOffice ? 'office' : 'browser')
      stored = await getBook(id)
    } catch (error) {
      toast(`تعذّر إنشاء PDF: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
  }
  if (!stored?.pdfData?.length) { toast('لم تتوفر نسخة PDF'); return }
  downloadBytes(stored.pdfData, stored.pdfFileName ?? `${stored.title}.pdf`, 'application/pdf')
}

function tocAside(theme: ReadingTheme, entries: TocEntry[]): HTMLElement {
  const aside = h('aside', { class: 'reader__toc reader__toc--empty', 'aria-label': 'فهرس الكتاب' })

  void theme
  renderTocAside(aside, theme, entries)
  return aside
}

function renderTocAside(aside: HTMLElement, _theme: ReadingTheme, entries: TocEntry[]): void {
  aside.replaceChildren()
  const empty = entries.length === 0
  const firstPopulatedRender = !empty && aside.dataset.tocPopulated !== 'true'
  if (firstPopulatedRender) {
    // قد تُرسم الحاوية أولًا بلا بيانات ثم تصل عناوين BOK لاحقًا. لا نسمح
    // لفئة إخفاء عابرة من الرسم الأول أن تمنع الفهرس عند اكتماله.
    aside.dataset.tocPopulated = 'true'
    // المصدر الحاكم عند أول اكتمال هو «ظاهر». إغلاق الهاتف الافتراضي تحكمه
    // قاعدة العرض الضيقة، فلا يستطيع اختلاف UA في Chrome إخفاء سطح المكتب.
    aside.dataset.userHidden = 'false'
    routeAnimationFrame(() => {
      if (isPhoneReaderViewport() || aside.dataset.userHidden === 'true' || aside.classList.contains('reader__toc--empty')) return
      aside.classList.remove('reader__toc--hidden', 'reader__toc--mobile-open')
      aside.classList.add('reader__toc--persistent')
      document.querySelector<HTMLElement>('.reader__stage')?.classList.remove('reader__stage--full')
      document.querySelector<HTMLButtonElement>('.reader__toc-toggle')?.setAttribute('aria-expanded', 'true')
    })
  }
  aside.classList.toggle('reader__toc--empty', empty)
  const toggle = document.querySelector<HTMLButtonElement>('.reader__toc-toggle')
  if (toggle) {
    toggle.hidden = empty
    toggle.disabled = empty
    toggle.setAttribute('aria-expanded', String(!empty && !aside.classList.contains('reader__toc--hidden')))
  }
  if (empty) {
    aside.classList.remove('reader__toc--mobile-open')
    aside.style.removeProperty('display')
  } else if (!isPhoneReaderViewport()) {
    // كل قارئ جديد يبدأ بفهرس ظاهر. الإغلاق تفضيل لهذه الجلسة/العقدة فقط؛
    // لا نخزنه بين الكتب أو الزيارات كي لا يعود الفهرس مختفيًا من تلقاء نفسه.
    const open = aside.dataset.userHidden !== 'true'
    aside.classList.toggle('reader__toc--hidden', !open)
    aside.style.removeProperty('display')
    document.querySelector<HTMLElement>('.reader__stage')?.classList.toggle('reader__stage--full', !open)
    toggle?.setAttribute('aria-expanded', String(open))
  } else {
    if (isPhoneReaderViewport()) {
      // الهاتف الحقيقي مغلق افتراضيًا؛ لا يرث حالة سطح المكتب.
      aside.classList.remove('reader__toc--hidden', 'reader__toc--mobile-open', 'reader__toc--persistent')
      aside.style.removeProperty('display')
      toggle?.setAttribute('aria-expanded', 'false')
    } else {
      // مسار احتياطي فقط للمتصفحات التي لا تطابق استعلامات الوسائط المتوقعة.
      const open = aside.dataset.userHidden !== 'true'
      aside.classList.add('reader__toc--persistent')
      aside.classList.toggle('reader__toc--hidden', !open)
      aside.style.removeProperty('display')
      toggle?.setAttribute('aria-expanded', String(open))
    }
  }
  if (empty) return
  const search = h('input', { type: 'search', class: 'reader__toc-search', placeholder: 'ابحث في عناوين الفهرس…', 'aria-label': 'البحث في عناوين الفهرس' }) as HTMLInputElement
  const clear = h('button', { type: 'button', class: 'reader__toc-clear', 'aria-label': 'مسح بحث الفهرس' }, 'مسح') as HTMLButtonElement
  const status = h('p', { class: 'reader__toc-status', role: 'status', 'aria-live': 'polite' })
  const hide = h('button', { type: 'button', class: 'reader__toc-hide', 'aria-label': 'إخفاء الفهرس', title: 'إخفاء الفهرس', onclick: () => toggleToc(aside) }, 'إخفاء') as HTMLButtonElement
  const statusRow = h('div', { class: 'reader__toc-status-row' }, status, hide)
  const list = h('div', { class: 'reader__toc-list', role: 'tree', 'aria-label': 'عناوين الكتاب' })
  aside.append(h('div', { class: 'reader__toc-filter' }, search, clear), statusRow, list)
  const items: { el: HTMLElement; num: number; bookmark?: string; label: string; pdfDestination?: PdfTocDestination }[] = []
  for (const it of entries) {
    const level = Math.max(1, Math.min(6, it.level ?? 1))
    const el = h('button', { type: 'button', role: 'treeitem', class: 'reader__toc-item', dataset: { level: String(level) }, onclick: () => {} },
      h('span', { class: 'num' }, arabicNum(it.num)),
      h('span', {dataset:{noTranslate:''}}, it.label),
    )
    uiTemplateAttribute(el,'aria-label','55329a6ca24d2cd5',{p1:it.label})
    el.setAttribute('aria-level', String(level))
    list.appendChild(el)
    items.push({ el, num: it.num, label: it.label, ...(it.bookmark ? { bookmark: it.bookmark } : {}),
      ...(it.pdfDestination ? { pdfDestination: it.pdfDestination } : {}) })
  }
  const filter = (): void => {
    const query = normalizeTocQuery(search.value)
    let visible = 0
    for (const item of items) { const matched = !query || normalizeTocQuery(item.label).includes(query); item.el.hidden = !matched; if (matched) visible++ }
    status.textContent = query ? visible ? `${arabicNum(visible)} نتيجة في الفهرس` : 'لا توجد عناوين مطابقة في الفهرس' : `${arabicNum(items.length)} عنوانًا في الفهرس`
    clear.hidden = !query
  }
  search.addEventListener('input', filter)
  // زر × المدمج في input[type=search] يطلق `search` في بعض المتصفحات
  // دون `input`؛ كلا المسارين يجب أن يعيدا القائمة فورًا.
  search.addEventListener('search', filter)
  clear.addEventListener('click', () => { search.value = ''; filter(); search.focus() })
  filter()
  aside.dataset.tocItems = String(items.length)
  ;(aside as any).__tocItems = items
}

/** تحميل الخطوط المضمّنة من docx في المتصفح عبر FontFace API */
async function loadEmbeddedFonts(model: DocumentModelV0): Promise<void> {
  const promises: Promise<void>[] = []
  for (const [fileName, face] of model.embeddedFonts) {
    try {
      const data = new Uint8Array(face.data)
      // الاسم المعلن في fontTable أدق لخطوط subset؛ يبقى name table fallback للسجلات القديمة.
      const family = face.family?.trim() || extractFontFamily(data) || fileName.replace(/\.\w+$/, '')
      const font = new FontFace(family, data.slice().buffer as ArrayBuffer, { style: face.style, weight: face.weight })
      promises.push(font.load().then(() => {
        document.fonts.add(font)
      }))
    } catch (e) {
      console.warn('embedded_font_load_failed', e instanceof Error ? e.name : 'unknown')
    }
  }
  await Promise.allSettled(promises)
  // انتظار حتى تتاح الخطوط للرسم
  await document.fonts.ready
}

/** استخراج اسم عائلة الخط من بايتات TTF/OTF */
function extractFontFamily(data: Uint8Array): string | null {
  try {
    // البحث عن جدول name في TTF (علامة 'name' عند offset محدد)
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    // TTF/OTF header: sfVersion (4 bytes) + numTables (2 bytes) + ... 
    // searchRange, entrySelector, rangeShift (6 bytes) = 12 bytes total header
    const numTables = view.getUint16(4, false)
    let offset = 12
    for (let i = 0; i < numTables; i++) {
      if (offset + 16 > data.byteLength) break
      const tag = String.fromCharCode(view.getUint8(offset), view.getUint8(offset + 1),
        view.getUint8(offset + 2), view.getUint8(offset + 3))
      if (tag === 'name') {
        const nameOffset = view.getUint32(offset + 8, false)
        return parseNameTable(data, nameOffset)
      }
      offset += 16
    }
  } catch { /* ignore parse errors */ }
  return null
}

/** استخراج اسم العائلة (Name ID 1) من جدول name */
function parseNameTable(data: Uint8Array, offset: number): string | null {
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
    const fmt = view.getUint16(offset, false) // format
    const count = view.getUint16(offset + 2, false) // numRecords
    const stringOffset = view.getUint16(offset + 4, false)
    for (let i = 0; i < count; i++) {
      const rec = offset + 6 + i * 12
      const platformID = view.getUint16(rec, false)
      const nameID = view.getUint16(rec + 6, false)
      // Name ID 1 = Font Family, platform 3 = Windows, platform 1 = Mac
      if (nameID === 1 && (platformID === 3 || platformID === 1)) {
        const len = view.getUint16(rec + 8, false)
        const strOff = view.getUint16(rec + 10, false)
        const bytes = new Uint8Array(data.buffer, data.byteOffset + offset + stringOffset + strOff, len)
        if (platformID === 3) {
          // UTF-16BE
          const chars: string[] = []
          for (let j = 0; j < len; j += 2) {
            const code = (bytes[j]! << 8) | bytes[j + 1]!
            if (code === 0) break
            chars.push(String.fromCharCode(code))
          }
          return chars.join('')
        }
        return new TextDecoder('macintosh').decode(bytes)
      }
    }
  } catch { /* ignore */ }
  return null
}

/** استخراج مدخلات الفهرس من فقرات المستند (w:TOC). */
function extractToc(paras: BodyParagraph[]): TocEntry[] {
  const out: TocEntry[] = []
  for (const p of paras) {
    if (p.toc && p.toc.entry && p.toc.pageNum) {
      const num = parseInt(p.toc.pageNum, 10)
      const bookmark = p.runs.find(run => run.href && !/^[a-z]+:/i.test(run.href))?.href
      if (!isNaN(num)) out.push({ num, label: p.toc.entry, ...(bookmark ? { bookmark } : {}) })
    }
  }
  return out
}

function readingColumn(): HTMLElement {
  const col = h('article', { class: 'reading' })
  col.appendChild(readerLoadingPaper())
  return col
}

const READER_ZOOM_KEY = 'alkhizana:reader-content-zoom:v1'
const READER_ZOOM_MIN = 75
const READER_ZOOM_MAX = 180

function savedReaderZoom(): number {
  const value = Number(localStorage.getItem(READER_ZOOM_KEY) ?? 100)
  return Number.isFinite(value) ? Math.min(READER_ZOOM_MAX, Math.max(READER_ZOOM_MIN, Math.round(value))) : 100
}

function applyReaderZoom(reader: HTMLElement, percent: number): number {
  const safe = Math.min(READER_ZOOM_MAX, Math.max(READER_ZOOM_MIN, Math.round(percent)))
  reader.style.setProperty('--reader-content-zoom', String(safe / 100))
  reader.style.setProperty('--reader-bok-font-size', `${18 * safe / 100}px`)
  localStorage.setItem(READER_ZOOM_KEY, String(safe))
  // صفحات Word تقيس الورقة والحاوية المحجوزة معًا. تغيير zoom بصريًا فقط
  // يترك موضع الصفحة التالية على القياس القديم، لذلك نطلب إعادة القياس فورًا.
  window.dispatchEvent(new Event('reader-content-zoom'))
  // PDF يعيد ملاءمة canvas عند resize بدل إبقاء تكبير بصري ضبابي فقط.
  if (reader.classList.contains('reader--pdf-source')) window.dispatchEvent(new Event('resize'))
  return safe
}

function readerZoomControl(reader: HTMLElement): HTMLElement {
  let value = applyReaderZoom(reader, savedReaderZoom())
  const output = h('button', { type: 'button', class: 'reader-zoom__value', 'aria-label': 'إعادة حجم النص إلى مئة بالمئة' }, `${value}%`) as HTMLButtonElement
  const update = (next: number): void => { value = applyReaderZoom(reader, next); output.textContent = `${value}%`; minus.disabled = value <= READER_ZOOM_MIN; plus.disabled = value >= READER_ZOOM_MAX }
  const minus = h('button', { type: 'button', class: 'reader-zoom__button', 'aria-label': 'تصغير محتوى الكتاب', onclick: () => update(value - 10) }, '−') as HTMLButtonElement
  const plus = h('button', { type: 'button', class: 'reader-zoom__button', 'aria-label': 'تكبير محتوى الكتاب', onclick: () => update(value + 10) }, '+') as HTMLButtonElement
  output.onclick = () => update(100)
  update(value)
  return h('div', { class: 'reader-zoom', role: 'group', 'aria-label': 'حجم محتوى الكتاب' }, minus, output, plus)
}

function readerToolbar(reader: HTMLElement, onDownloadWord: () => void, onDownloadPdf: () => void, onInfo: () => void, onPdfBeside: () => void, onToc: () => void, onBookmark: () => void, onAnnotations: () => void, onSearch: () => void, onSerenity: () => void, onReadingMode: () => ReadingMode): HTMLElement {
  const bar = h('footer', { class: 'reader__toolbar', id: 'reader-mobile-tools', 'aria-label': 'قائمة أدوات القارئ' })
  const inner = h('div', { class: 'reader__toolbar-inner' })

  const tocButton = h('button', { class: 'tool-btn reader__toc-toggle', type: 'button', 'aria-label': 'فتح فهرس الكتاب', title: 'فتح فهرس الكتاب', onclick: onToc }, icon('list', 19), h('span', null, 'الفهرس')) as HTMLButtonElement
  tocButton.hidden = true
  inner.appendChild(tocButton)
  inner.appendChild(h('button', { class: 'tool-btn', dataset: { readerAction: 'search' }, 'aria-label': 'بحث في الكتاب', title: 'بحث في الكتاب', onclick: onSearch }, icon('search', 19), h('span', null, 'بحث')))
  const mode = h('button', { class: 'tool-btn reader__mode-toggle', dataset: { readerAction: 'flow' }, type: 'button', 'aria-label': 'تغيير نمط القراءة', title: 'تغيير نمط القراءة' }, icon('book', 19), h('span', null, 'نمط')) as HTMLButtonElement
  mode.setAttribute('aria-pressed', String(getReadingMode() === 'flow'))
  mode.addEventListener('click', () => { const next = onReadingMode(); mode.setAttribute('aria-pressed', String(next === 'flow')); mode.title = readingModeLabel(next); mode.setAttribute('aria-label', readingModeLabel(next)) })
  inner.appendChild(mode)
  const serenity = h('button', { class: 'tool-btn reader__serenity-toggle', 'aria-label': 'وضع السكينة', title: 'وضع السكينة', onclick: onSerenity }, icon('moon', 19), h('span', null, 'سكينة'))
  serenity.setAttribute('aria-pressed', 'false')
  inner.appendChild(serenity)
  inner.appendChild(h('button', { class: 'tool-btn', 'aria-label': 'إضافة علامة قراءة', title: 'إضافة علامة قراءة', onclick: onBookmark }, icon('bookmark', 19), h('span', null, 'علامة')))
  inner.prepend(h('button', { class: 'tool-btn', 'aria-label': 'إرسال ملاحظة للإدارة', title: 'إرسال ملاحظة للإدارة', onclick: onAnnotations }, icon('more', 19), h('span', null, 'ملاحظات')))
  inner.appendChild(h('button', { class: 'tool-btn', 'aria-label': 'معلومات الكتاب', title: 'معلومات الكتاب', onclick: onInfo }, icon('book', 19), h('span', null, 'معلومات')))
  const besidePdf = h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'عرض PDF بجوار النص', title: 'عرض PDF بجوار النص', onclick: onPdfBeside }, icon('box', 19), h('span', null, 'PDF+نص')) as HTMLButtonElement
  besidePdf.dataset.readerPdfAction = 'beside'
  inner.appendChild(besidePdf)
  const sourceDownload = h('button', { class: 'tool-btn tool-btn--accent', 'aria-label': 'تنزيل Word الأصلي', title: 'تنزيل Word الأصلي', onclick: onDownloadWord }, icon('download', 19), h('span', null, 'Word'))
  sourceDownload.dataset.readerSourceAction = 'download'
  inner.appendChild(sourceDownload)
  const downloadPdf = h('button', { class: 'tool-btn', type: 'button', 'aria-label': 'تنزيل PDF', title: 'تنزيل PDF', onclick: onDownloadPdf }, icon('download', 19), h('span', null, 'PDF')) as HTMLButtonElement
  downloadPdf.dataset.readerPdfAction = 'download'
  inner.appendChild(downloadPdf)
  inner.appendChild(readerZoomControl(reader))

  // طبقة التمرير LTR لتفادي scroll overflow السالب في Chromium؛ نعكس العقد
  // مرة واحدة كي يبقى ترتيب الأدوات المرئي عربيًا من اليمين إلى اليسار.
  inner.replaceChildren(...Array.from(inner.children).reverse())
  bar.appendChild(inner)
  return bar
}

function layoutSwitch(onSwitch: () => void): HTMLElement {
  return h('button', { class: 'layout-switch-float', 'aria-label': 'مبدّل التخطيط', onclick: onSwitch }, icon('book', 20))
}

function toggleSerenity(reader: HTMLElement): void {
  const enabled = reader.classList.toggle('reader--serenity')
  const button = reader.querySelector<HTMLElement>('.reader__serenity-toggle')
  button?.setAttribute('aria-pressed', String(enabled))
  button?.querySelector('span')?.replaceChildren(enabled ? 'إنهاء السكينة' : 'سكينة')
  // السكينة تخفي المشتتات فقط. بعد تغير المساحة المتاحة نعيد القياس بنفس
  // خوارزمية الوضع العادي، فلا تنشأ أبعاد أو قص مختلفان للورقة.
  window.dispatchEvent(new Event('reader-content-zoom'))
  toast(enabled ? 'فُعّل وضع السكينة' : 'عادت أدوات القارئ', {uiText:true})
}
import {routeLocation,legacyHashToPath} from "../path_location"
