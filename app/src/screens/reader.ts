/* قشرة القارئ: تعرض DOCX، وتتيح تنزيل الأصل ونسخة PDF المحوّلة من Word نفسه. */

import { bookById } from '../data'
import { h, toast, arabicNum } from '../ui'
import { icon } from '../icons'
import { appHeader, runtimeEnvironmentNotice, skipToContent } from '../shell'
import { loadBook, loadBookFromBuffer, type LoadedBook } from '../engine/bridge'
import type { BodyParagraph, DocumentModelV0 } from '@engine/ooxml-model'
import { releaseRenderedPageAssets, renderBookPreviewPage, renderBookToPages, fitPageToWidth } from '../engine/dom_render'
import { downloadBytes, getBook, saveReaderModel, saveReaderPageCount, updateBokDerivedText, type WordPageMap, type StoredBook } from '../engine/library_store'
import { convertStoredBookToPdf, needsPdfRefresh } from '../engine/word_pdf'
import { addHighlight, addNote, deleteHighlight, deleteNote, getAnnotations, toggleBookmark, type HighlightColor, type ReaderHighlight } from '../annotation_store'
import { bookCover } from '../book_cover'
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { authorLink, bookAuthorLinks, categoryLink } from '../taxonomy_links'
import { stateView } from '../state_view'
import { buildRichClipboard, writeRichClipboard } from '../rich_clipboard'
import { parseReaderDeepLink, readyReaderTotal, readerIndexForDisplayedPage, readerProgressState, requestedReaderPage } from '../reader_navigation'
import { persistCompletedReaderPageCount } from '../reader_page_count_persistence'
import { cacheReaderPageCount } from '../book_page_count'
import { getReadingMode, nextReadingMode, readingModeLabel, saveReadingMode, type ReadingMode } from '../reading_mode'
import { pageIndexForBookmark } from '../reader_bookmark_mapping'
import { readerScrollBehavior } from '../motion_preference'
import { annotationDeletePrompt } from '../annotation_accessibility'
import { captureRouteResourceScope, routeAnimationFrame, routeEventListener, routeObserver, routeTimeout, type ResourceScope } from '../resource_lifecycle'
import { readerDocumentTitle, readerIdentityLabel } from '../reader_identity'
import { getRuntimeCapabilities } from '../runtime_capabilities'
import { classifyReaderFailure, plainReaderGroups, type ReaderFailure, type ReaderFailureStage } from '../reader_failure'
import { bestEffortClone } from '../reader_cache'
import { ReaderPreviewCache } from '../reader_preview_cache'
import { hasAuthoritativeWordPageMaps } from '../reader_page_authority'
import { inferBookFormat } from '../book_format'
import { assertBookFormat, invalidBookFormatMessage } from '../book_format_validation'
import { decodeUtf8Text, textParagraphs } from '../text_import'
import { extractPdfOutline, normalizeTocQuery } from '../reader_toc'
import { pdfJsLocalAssets } from '../pdfjs_assets'
import { openTranslationDialog, setSourceDocumentTitle } from '../translation'
import { ensurePublishedWorkSeeded } from '../published_library_seed'

export type ReadingTheme = 'day' | 'sepiya' | 'night'

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

const READER_PAGE_EVENT = 'alkhizana:reader-page'
const READER_PAGE_REQUEST_EVENT = 'alkhizana:reader-page-request'

function announceReaderPage(index: number, total: number): void {
  window.dispatchEvent(new CustomEvent(READER_PAGE_EVENT, { detail: { index, total } }))
}

function nextPaint(): Promise<void> {
  return new Promise(resolve => routeAnimationFrame(() => resolve()))
}

export function readerScreen(id: string): HTMLElement {
  // هوية التنقل تخص الكتاب الحالي فقط. إبقاؤها من قارئ سابق كان يجعل PDF
  // المستقل يرث أحيانًا عدد صفحات/موضع كتاب Word فتح قبله في جلسة SPA.
  activePageNavigation = undefined
  activePageNumbers = []
  activePartNumbers = []
  activeDisplayedTotal = 0
  const resourceScope = captureRouteResourceScope()
  const book = bookById(id)
  const initialTitle = book?.title ?? (id === 'upload' ? '' : 'جارٍ فتح الكتاب…')
  let citationBook = { title: initialTitle, author: book?.author ?? '' }
  setSourceDocumentTitle(readerDocumentTitle(initialTitle))
  const theme = (document.documentElement.dataset.readingTheme ?? 'day') as ReadingTheme
  let tocEntries: TocEntry[] = []
  let readingMode: ReadingMode = getReadingMode()
  const reader = h('div', { class: `reader${readingMode === 'flow' ? ' reader--flow' : ''}` })
  reader.appendChild(skipToContent())
  reader.appendChild(appHeader(location.hash))
  reader.appendChild(runtimeEnvironmentNotice())
  const asideEl = tocAside(theme, tocEntries)
  const infoEl = bookInfoAside(id, initialTitle)
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

  reader.appendChild(readerToolbar(
    () => void downloadOriginalBook(id, book),
    () => void downloadConvertedPdf(id),
    () => {
      toggleBookInfoDialog(bookCardEl)
    },
    () => void showPdfBesideBook(id, infoEl),
    () => toggleToc(reader),
    () => toggleCurrentBookmark(id),
    () => showAnnotations(infoEl, id),
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
      renderDomPages(instant, [cachedClone], initialTitle, citationBook.author, resourceScope, { preview: true })
      instant.dataset.status = 'preview'
    }
  }
  // يبقى التخطيط الهندسي أداة تشخيص داخلية إلى أن يجتاز اختبار قراءة العربية.
  // لا نعرض مبدّله للقارئ لأن مسارات الحروف الحالية غير صالحة للقراءة بعد.

  // قفص تحميل: HTML فوري أولًا (بلا WASM)، ثم المشهد في الخلفية
  const loadFrom = (title: string, loadPromise: Promise<LoadedBook | LoadedBook[]>, wordPageMap?: WordPageMap | Array<WordPageMap | undefined>, physicalPageCount?: number): void => {
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
            renderDomPages(live, [preview], title, citationBook.author, resourceScope, {
              preview: true,
              ...(physicalPageCount === undefined ? {} : { physicalPageCount }),
            })
            live.dataset.status = 'preview'
            cacheReaderPage(id, preview)
            await nextPaint()
          }

          // العرض الكامل يبنى بعد أن أتيحت أول ورقة للمتصفح.
          pipelineStage = 'layout'
          const pages: HTMLElement[] = []
          tocEntries = []
          for (let partIndex = 0; partIndex < loadedBooks.length; partIndex++) {
            if (resourceScope.disposed) return
            const partPages = await renderBookToPages(loadedBooks[partIndex]!.model, pageMaps[partIndex])
            resourceScope.add(() => releaseRenderedPageAssets(partPages))
            const offset = pages.length
            for (const page of partPages) {
              page.dataset.partNumber = String(partIndex + 1)
              pages.push(page)
            }
            tocEntries.push(...extractToc(loadedBooks[partIndex]!.model.paragraphs).map(entry => ({ ...entry, num: offset + entry.num })))
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
          const nav = renderDomPages(live, pages, title, citationBook.author, resourceScope)
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
          console.warn('reader_render_failed', failure.code)
          live.dataset.status = 'error'
          live.replaceChildren(readerFailurePanel(failure, {
            retry: () => loadFrom(title, Promise.resolve(loadedResult), wordPageMap, physicalPageCount),
            fallback: () => renderPlainReaderFallback(live, loadedBooks, title, citationBook.author, resourceScope),
            download: () => void downloadOriginalBook(id, book),
          }))
        }
      })
      .catch((err: unknown) => {
        const failure = classifyReaderFailure(err, 'parse')
        console.warn('reader_open_failed', failure.code)
        live.dataset.status = 'error'
        live.replaceChildren(readerFailurePanel(failure, {
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
      let stored = await getBook(id)
      // قد يسبق فتح رابط كتاب منشور اكتمال غرس manifest في IndexedDB، ولا
      // ينبغي أن تظهر عندها هوية وهمية أو صفحة مفقودة.
      if (!stored || stored.managedSource === 'published') {
        stored = await ensurePublishedWorkSeeded(id) ?? stored
      }
      if (stored) {
        const resolvedTitle = storedReaderTitle(stored)
        citationBook = { title: resolvedTitle, author: stored.author }
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
        if (!loaded && stored.readerModel) {
          loaded = { model: stored.readerModel, pages: [] }
          loadedBookCache.set(id, loaded)
        }
        if (!loaded) {
          loaded = loadBookFromBuffer(stored.data)
          loadedBookCache.set(id, loaded)
          // الحفظ غير حاجب للعرض؛ الزيارة التالية تتجاوز فك ZIP وXML كليًا.
          void saveReaderModel(id, loaded.model).catch(() => undefined)
        }
        loadFrom(stored.title, Promise.resolve(loaded), stored.wordPageMap, stored.physicalPageCount)
      } else {
        const stage = reader.querySelector('.reader__stage')
        if (stage) {
          stage.replaceChildren(stateView({ kind: 'empty', icon: 'book', title: 'لم يُعثر على الكتاب في المكتبة', description: 'قد يكون حُذف من هذا الجهاز؛ يمكنك إضافته من جديد.', actionLabel: 'فتح المكتبة', href: '#/library' }))
        }
      }
    })().catch((error: unknown) => {
      console.warn('text_reader_open_failed', error)
      const stage = reader.querySelector('.reader__stage')
      stage?.replaceChildren(stateView({ kind: 'error', icon: 'book', title: 'تعذّر فتح الكتاب الآن', description: 'بيانات الكتاب محفوظة؛ أعد المحاولة بعد لحظات.', actionLabel: 'إعادة المحاولة', onAction: () => location.reload() }))
    })
  }

  return reader
}

async function renderTextSource(reader: HTMLElement, stored: StoredBook, resourceScope: ResourceScope): Promise<void> {
  const stage = reader.querySelector<HTMLElement>('.reader__stage')
  if (!stage) return
  try {
    reader.classList.add('reader--textual')
    stage.classList.add('reader__stage--textual')
    const format = inferBookFormat(stored)
    if (format === 'shamela-bok' && stored.bokTextVersion !== 3) {
      const runtime = globalThis as typeof globalThis & {
        process?: { browser: true; env: Record<string, string | undefined>; version: string; nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void }
      }
      runtime.process ??= { browser: true, env: {}, version: '', nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)) }
      const { parseBok, CURRENT_BOK_TEXT_VERSION } = await import('../bok_import')
      const parsed = parseBok(stored.data, stored.fileName)
      stored = { ...stored, extractedText: parsed.extractedText, bokPages: parsed.pages, bokToc: parsed.toc, bokTextVersion: CURRENT_BOK_TEXT_VERSION }
      await updateBokDerivedText(stored.id, { extractedText: parsed.extractedText, pages: parsed.pages, toc: parsed.toc, version: CURRENT_BOK_TEXT_VERSION })
    }
    const sourceText = format === 'epub' || format === 'shamela-bok' ? stored.extractedText ?? '' : decodeUtf8Text(stored.data)
    if (format === 'markdown') {
      const { renderMarkdownPages } = await import('../markdown_render')
      const rendered = renderMarkdownPages(sourceText, stored.markdownAssets)
      resourceScope.add(() => rendered.assetUrls.forEach(url => URL.revokeObjectURL(url)))
      if (!rendered.pages.length) throw new Error('لا يوجد محتوى Markdown قابل للقراءة')
      reader.classList.add('reader--markdown')
      const live = readingColumn(); stage.replaceChildren(live)
      const nav = renderDomPages(live, rendered.pages, stored.title, stored.author, resourceScope)
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
      const nav = renderDomPages(live, rendered.pages, stored.title, stored.author, resourceScope)
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
      const tocByPage = new Map<number, Array<{ title: string; bookmark: string; level: number }>>()
      for (const [tocIndex, entry] of (stored.bokToc ?? []).entries()) {
        const titles = tocByPage.get(entry.id) ?? []
        titles.push({ title: entry.title, bookmark: `bok-toc-${tocIndex + 1}`, level: entry.level })
        tocByPage.set(entry.id, titles)
      }
      const pages = stored.bokPages.map((source, index) => {
        const page = h('section', { class: 'page reader__text-page reader__text-page--bok', 'aria-label': `الجزء ${arabicNum(source.part)} الصفحة ${arabicNum(source.page)}` })
        page.dataset.pageIndex = String(index)
        page.dataset.wordPageNumber = String(source.page)
        page.dataset.partNumber = String(source.part)
        page.appendChild(h('div', { class: 'reader__text-folio', 'aria-hidden': 'true' }, `الجزء ${arabicNum(source.part)} · الصفحة ${arabicNum(source.page)}`))
        const pendingHeadings = [...(tocByPage.get(source.id) ?? [])]
        const compact = (value: string): string => value.replace(/\s+/g, ' ').trim()
        let footnoteContainer: HTMLElement | undefined
        for (const block of shamelaTextBlocks(source.text)) {
          if (block.footnote && !footnoteContainer) {
            footnoteContainer = h('section', { class: 'reader__text-notes', 'aria-label': 'حواشي الصفحة' },
              h('hr', { class: 'reader__text-footnote-rule', 'aria-hidden': 'true' }),
            )
            page.appendChild(footnoteContainer)
          }
          const blockText = compact(block.text)
          const matches = pendingHeadings.filter(entry => blockText.includes(compact(entry.title)))
          for (const entry of matches) {
            pendingHeadings.splice(pendingHeadings.indexOf(entry), 1)
            if (blockText === compact(entry.title)) page.appendChild(h('h2', { class: 'reader__text-heading', id: entry.bookmark, dataset: { level: String(entry.level) } }, entry.title))
            else page.appendChild(h('span', { class: 'reader__text-toc-anchor', id: entry.bookmark, 'aria-hidden': 'true' }))
          }
          if (!matches.some(entry => blockText === compact(entry.title))) (block.footnote ? footnoteContainer! : page).appendChild(decorateTextParagraph(block.text, { footnote: block.footnote, indent: block.indent }))
        }
        // العناوين غير الموجودة حرفيًا في المتن تبقى مرساها عند رأس الصفحة
        // الموثقة بدل إسقاطها أو تخمين فقرة أخرى.
        for (const entry of pendingHeadings.reverse()) page.insertBefore(h('h2', { class: 'reader__text-heading', id: entry.bookmark, dataset: { level: String(entry.level) } }, entry.title), page.children[1] ?? null)
        return page
      })
      const live = readingColumn(); stage.replaceChildren(live)
      const nav = renderDomPages(live, pages, stored.title, stored.author, resourceScope)
      live.querySelector('.reading__stream')?.prepend(textBookTitlePage(stored))
      const bokToc = (stored.bokToc ?? []).map((entry, index) => ({
        num: stored.bokPages?.find(page => page.id === entry.id)?.page ?? entry.id,
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
        page.appendChild(heading ? h('h2', { class: 'reader__text-heading', id: heading.bookmark ?? `text-heading-${offset + relative}`, dataset: { level: String(heading.level) } }, text.replace(/^#{1,6}\s+/u, '')) : decorateTextParagraph(text))
      }
      pages.push(page)
    }
    const live = readingColumn()
    stage.replaceChildren(live)
    const nav = renderDomPages(live, pages, stored.title, stored.author, resourceScope)
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
    const failure = classifyReaderFailure(error, 'parse')
    const format = inferBookFormat(stored)
    stage.replaceChildren(readerFailurePanel(failure, {
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
  return h('section', { class: 'reader__text-title-page', 'aria-label': `صفحة عنوان ${book.title}` },
    h('div', { class: 'reader__text-title-ornament', 'aria-hidden': 'true' }, '◆'),
    h('p', { class: 'reader__text-title-kicker' }, 'الخِزانة'),
    h('h1', null, book.title),
    h('p', { class: 'reader__text-title-authors' }, authors.filter(Boolean).join('، ')),
    ...(metadata.length ? [h('dl', null, ...metadata.flatMap(([label, value]) => [h('dt', null, label), h('dd', null, value)]))] : []),
    h('p', { class: 'reader__text-title-format' }, inferBookFormat(book) === 'shamela-bok' ? 'نسخة نصية من ملف BOK الأصلي' : 'نسخة نصية من ملف EPUB الأصلي'),
  )
}

function printTextBookWhenRequested(book: StoredBook): void {
  const query = location.hash.split('?')[1] ?? ''
  if (new URLSearchParams(query).get('print') !== '1') return
  const cleanHash = location.hash.replace(/([?&])print=1(?:&|$)/, (_match, separator: string) => separator === '?' ? '?' : '').replace(/[?&]$/, '')
  history.replaceState(null, '', cleanHash)
  setSourceDocumentTitle(`${book.title} — نسخة PDF منسقة — الخزانة`)
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()))
}

interface TextBlockOptions { footnote?: boolean; indent?: number }

function shamelaTextBlocks(text: string): Array<{ text: string; footnote: boolean; indent: number }> {
  const normalized = text.replace(/\r\n?/g, '\n')
  const lines = normalized.includes('\n') ? normalized.split('\n') : textParagraphs(normalized)
  const blocks: Array<{ text: string; footnote: boolean; indent: number }> = []
  let footnoteSection = false
  for (const raw of lines) {
    const value = raw.trim()
    if (!value) continue
    if (/^(?:[_ـ=-]{3,}|الحواشي\s*:?)$/u.test(value)) { footnoteSection = true; continue }
    const explicitFootnote = /^(?:\(\s*\d+\s*\)|\[\s*\d+\s*\]|=)\s*/u.test(value)
    // الفراغات الأولية في قواعد الشاملة ليست تفقيرًا موثوقًا؛ إبقاؤها كان
    // يضيّق بعض الفقرات عشوائيًا من الجانبين في القارئ.
    blocks.push({ text: value, footnote: footnoteSection || explicitFootnote, indent: 0 })
  }
  return blocks
}

function decorateTextParagraph(text: string, options: TextBlockOptions = {}): HTMLElement {
  const paragraph = h('p', { class: 'reader__text-paragraph' })
  if (options.indent) paragraph.dataset.indent = String(options.indent)
  const isNote = options.footnote || /^(?:\[?\d+[\]\).:\-]|الهامش|حاشية)/u.test(text.trim())
  if (isNote) paragraph.classList.add('reader__text-paragraph--note')
  if (/(?:قال رسول الله|عن النبي|صلى الله عليه وسلم|ﷺ)/u.test(text)) paragraph.classList.add('reader__text-paragraph--hadith')
  // الأقواس وحدها ليست دليلًا قرآنيًا. لا نلوّن متنًا مرشحًا قبل مطابقته
  // exact مع أثر quran-annotations ذي corpusVersion/checksum موثّقين.
  const noteMatch = isNote ? text.match(/^\s*(\(\s*[\d٠-٩۰-۹]+\s*\)|\[\s*[\d٠-٩۰-۹]+\s*\]|[\d٠-٩۰-۹]+[.):-])\s*/u) : null
  const visibleText = noteMatch ? text.slice(noteMatch[0].length) : text
  if (noteMatch) paragraph.appendChild(h('sup', { class: 'reader__text-note-number', 'aria-label': `الحاشية ${noteMatch[1]}` }, noteMatch[1]))
  const content = isNote ? h('span', { class: 'reader__text-note-body' }) : paragraph
  const versePattern = /(\[[^\]\n]{2,40}:\s*[\d٠-٩۰-۹][^\]\n]{0,18}\]|\(\s*[\d٠-٩۰-۹]{1,3}\s*\))/gu
  let cursor = 0
  for (const match of visibleText.matchAll(versePattern)) {
    const start = match.index ?? 0
    if (start > cursor) content.append(document.createTextNode(visibleText.slice(cursor, start)))
    const token = match[0]
    const className = token.startsWith('[') ? 'reader__text-verse-ref' : 'reader__text-marker'
    content.appendChild(h('span', { class: className }, token))
    cursor = start + match[0].length
  }
  if (cursor < visibleText.length) content.append(document.createTextNode(visibleText.slice(cursor)))
  if (content !== paragraph) paragraph.appendChild(content)
  return paragraph
}

function configureReaderSourceLabel(reader: HTMLElement, stored: StoredBook): void {
  const button = reader.querySelector<HTMLElement>('[data-reader-source-action="download"]')
  const label = button?.querySelector('span')
  if (!label) return
  const format = inferBookFormat(stored)
  label.textContent = format === 'pdf' ? 'تحميل PDF' : format === 'markdown' ? 'Markdown الأصلي' : format === 'text' ? 'النص الأصلي' : format === 'epub' ? 'EPUB الأصلي' : format === 'shamela-bok' ? 'BOK الأصلي' : 'Word الأصلي'
  button?.setAttribute('aria-label', format === 'pdf' ? 'تحميل PDF' : `تنزيل ${label.textContent}`)
  // PDF المستقل هو نفسه الأصل القابل للتنزيل؛ لا نعرض زر «PDF» مشتقًا
  // ولا «PDF بجوار النص» لكتاب لا يملك متن Word موازيًا.
  if (format === 'pdf') {
    reader.classList.add('reader--pdf-source')
    reader.querySelector<HTMLElement>('[data-reader-pdf-action="download"]')?.remove()
    reader.querySelector<HTMLElement>('[data-reader-pdf-action="beside"]')?.remove()
    // Canvas PDF لا يملك DOM نصيًا يعاد تدفقه أو بحثه؛ إبقاء الزرين كان
    // يوحي بوظائف غير موجودة. بقية الأدوات (السكينة/العلامات/الملاحظات) حقيقية.
    reader.querySelector<HTMLElement>('[data-reader-action="flow"]')?.remove()
    reader.querySelector<HTMLElement>('[data-reader-action="search"]')?.remove()
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
  retry: () => void
  fallback?: () => void
  reprocess?: () => void
  download: () => void
  downloadLabel?: string
}): HTMLElement {
  const panel = stateView({ kind: 'error', title: failure.title, description: failure.description })
  panel.appendChild(h('small', { class: 'reader-failure__code' }, `رمز التشخيص: ${failure.code}`))
  const controls = h('div', { class: 'reader-failure__actions' })
  controls.appendChild(h('button', { class: 'btn btn--primary', type: 'button', onclick: actions.retry }, 'إعادة المحاولة'))
  if (actions.reprocess) controls.appendChild(h('button', { class: 'btn btn--secondary', type: 'button', onclick: actions.reprocess }, 'إعادة معالجة الأصل'))
  if (actions.fallback) controls.appendChild(h('button', { class: 'btn btn--secondary', type: 'button', onclick: actions.fallback }, 'عرض نصي احتياطي'))
  controls.appendChild(h('button', { class: 'btn btn--secondary', type: 'button', onclick: actions.download }, actions.downloadLabel ?? 'تنزيل Word الأصلي'))
  controls.appendChild(h('a', { class: 'btn btn--secondary', href: '#/library' }, 'العودة إلى المكتبة'))
  panel.appendChild(controls)
  return panel
}

function renderPlainReaderFallback(
  live: HTMLElement,
  loadedBooks: LoadedBook[],
  title: string,
  author: string,
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
  const nav = renderDomPages(live, pages, title, author, resourceScope)
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
    const action = h('button', { class: 'btn btn--secondary', type: 'button' }, 'إعادة المعالجة عبر Word المحلي')
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
  if (!needsPdfRefresh(stored ?? {})) return
  if (capabilities.wordPdfConversionAvailable) return
  for (const button of buttons) {
    button.disabled = true
    button.title = 'لا توجد نسخة PDF جاهزة؛ إنشاؤها من Word يحتاج تشغيل الخِزانة المحلي.'
    button.setAttribute('aria-label', `${button.textContent?.trim() || 'PDF'} — يتطلب التطبيق المحلي`)
  }
}

/** تفعيل القفز في الفهرس على صفحات DOM (goTo تُقلّب الصفحة المعروضة). */
type TocEntry = { num: number; label: string; bookmark?: string; level?: number }
type PageNavigation = { goTo: (i: number) => void; goToDisplayedPage: (page: number) => void; goToBookmark?: (bookmark: string) => boolean; total: number }

function enableTocNavigation(_entries: TocEntry[], nav: PageNavigation): void {
  const aside = document.querySelector('.reader__toc')
  const items: { el: HTMLElement; num: number; bookmark?: string }[] = (aside as any)?.__tocItems ?? []
  if (items.length === 0) return

  for (const item of items) {
    item.el.onclick = () => {
      if (item.bookmark && nav.goToBookmark?.(item.bookmark)) return
      nav.goToDisplayedPage(item.num)
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

/** عرض عمودي مستمر مثل PDF؛ content-visibility يمنع رسم الصفحات البعيدة. */
function renderDomPages(container: HTMLElement, pages: HTMLElement[], title: string, author: string, resourceScope: ResourceScope, preview?: { preview: true; physicalPageCount?: number }): PageNavigation {
  const columnWidth = (): number => container.clientWidth || 680
  const stream = h('div', { class: 'reading__stream', 'aria-label': `${title} — صفحات متتابعة` })
  const positionText = h('span', { class: 'reading__position-text', role: 'status', 'aria-live': 'polite' }, `صفحة ١ من ${arabicNum(pages.length)}`)
  const identity = h(
    'span',
    { class: 'reading__identity', title: readerIdentityLabel(title, author) },
    h('span', { class: 'reading__book-title' }, title || 'كتاب بدون عنوان'),
    h('span', { class: 'reading__identity-separator', 'aria-hidden': 'true' }, '—'),
    authorLink(author, 'reading__author-link'),
  )
  const progressFill = h('span', { class: 'reading__position-fill' })
  const jumpInput = h('input', { type: 'number', 'aria-label': 'رقم الصفحة للانتقال المباشر' }) as HTMLInputElement
  jumpInput.min = '1'; jumpInput.placeholder = 'صفحة'
  const partNumbers = Array.from(new Set(pages.map(page => Number(page.dataset.partNumber) || 1)))
  const partSelect = h('select', { 'aria-label': 'رقم الجزء' }) as HTMLSelectElement
  for (const part of partNumbers) partSelect.appendChild(h('option', { value: String(part) }, `الجزء ${arabicNum(part)}`))
  const jumpForm = h('form', { class: 'reading__page-jump' }, ...(partNumbers.length > 1 ? [partSelect] : []), jumpInput, h('button', { type: 'submit' }, 'انتقل'))
  let jumpToPage = (_page: number): void => undefined
  jumpForm.addEventListener('submit', (event) => { event.preventDefault(); const page = Number(jumpInput.value); if (Number.isFinite(page) && page > 0) jumpToPage(page) })
  const position = h('div', { class: 'reading__position', 'aria-label': readerIdentityLabel(title, author) }, identity, positionText, jumpForm, h('span', { class: 'reading__position-track', 'aria-hidden': 'true' }, progressFill))
  const bookId = location.hash.match(/^#\/reader\/([^?]+)/)?.[1] ?? 'book'
  const deepLink = parseReaderDeepLink(location.hash.split('?')[1] ?? '')
  const requestedParagraph = deepLink.paragraphIndex
  const requestedTafsirPage = deepLink.surah && deepLink.ayah ? pages.findIndex(page => [...page.querySelectorAll<HTMLElement>('[data-tafsir-surah]')].some(node => Number(node.dataset.tafsirSurah) === deepLink.surah && Number(node.dataset.tafsirFrom) <= deepLink.ayah! && Number(node.dataset.tafsirTo) >= deepLink.ayah!)) : -1
  const positionKey = `alkhizana:reading-position:${bookId}`
  activePageNumbers = pages.map((page, index) => Number(page.dataset.wordPageNumber) || index + 1)
  activePartNumbers = pages.map(page => Number(page.dataset.partNumber) || 1)
  activeDisplayedTotal = preview?.physicalPageCount ?? readyReaderTotal(pages.length)
  const savedHighlights = getAnnotations().highlights.filter((highlight) => highlight.bookId === bookId)
  const slots = pages.map((page, index) => {
    const width = parseFloat(page.style.width) || 680
    const height = parseFloat(page.style.minHeight) || 960
    const scale = Math.min(1, columnWidth() / width)
    const slot = h('div', { class: 'reading__page-slot', 'aria-label': `صفحة ${arabicNum(page.dataset.wordPageNumber ?? index + 1)} من ${arabicNum(page.dataset.wordTotalPages ?? pages.length)}` })
    slot.style.minHeight = `${Math.round(height * scale)}px`
    slot.dataset.pageIndex = String(index)
    slot.dataset.partNumber = page.dataset.partNumber ?? '1'
    slot.dataset.partCount = String(partNumbers.length)
    slot.dataset.wordPageNumber = page.dataset.wordPageNumber ?? String(index + 1)
    slot.dataset.searchText = page.dataset.searchText ?? page.textContent ?? ''
    stream.appendChild(slot)
    return slot
  })
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
    slot.style.minHeight = `${Math.round(height * Math.min(1, columnWidth() / width))}px`
  }
  const pruneMountedPages = (center: number): void => {
    for (let index = 0; index < slots.length; index++) if (Math.abs(index - center) > 4) unmount(index)
  }
  const updatePosition = (index: number): void => {
    const page = pages[index]
    const current = page?.dataset.wordPageNumber ?? index + 1
    const currentNumber = index + 1
    const progress = readerProgressState(index, pages.length, Boolean(preview?.preview), preview?.physicalPageCount)
    const wordMaximum = Math.max(...pages.map(item => Number(item.dataset.wordTotalPages) || 0), ...pages.map(item => Number(item.dataset.wordPageNumber) || 0))
    const part = Number(page?.dataset.partNumber) || 1
    const prefix = `${partNumbers.length > 1 ? `الجزء ${arabicNum(part)} · ` : ''}صفحة Word ${arabicNum(current)}${wordMaximum ? ` من ${arabicNum(wordMaximum)}` : ''}`
    if (progress.loading) {
      positionText.textContent = `${prefix} · الورقة ${arabicNum(currentNumber)} · جارٍ تجهيز بقية الصفحات…`
      progressFill.style.width = '0%'
    } else {
      const remaining = progress.complete ? ' · اكتملت القراءة' : ` · نحو ${arabicNum(progress.remainingMinutes ?? 0)} د متبقية`
      positionText.textContent = `${prefix} · الورقة ${arabicNum(currentNumber)} من ${arabicNum(progress.total ?? pages.length)} · ${arabicNum(progress.percent ?? 1)}٪${remaining}`
      progressFill.style.width = `${progress.percent}%`
    }
    if (partNumbers.length > 1) partSelect.value = String(part)
  }
  container.replaceChildren(
    h('div', { class: 'reading__chapter-title' }, h('h1', null, title), h('span', { class: 'ornament' })),
    position,
    stream,
  )
  const mount = (index: number): void => {
    const slot = slots[index]
    const page = pages[index]
    if (!slot || !page || slot.dataset.mounted === 'true') return
    slot.dataset.mounted = 'true'
    const cleanups: Array<() => void> = []
    mountedCleanup[index] = cleanups
    const wrap = fitPageToWidth(page, columnWidth(), cleanup => cleanups.push(cleanup))
    resourceScope.add(() => { for (const cleanup of cleanups) cleanup() })
    wrap.classList.add('reading__stream-page')
    wrap.tabIndex = 0
    wrap.dataset.pageIndex = String(index)
    wrap.appendChild(h('span', { class: 'reading__page-badge', 'aria-hidden': 'true' }, arabicNum(page.dataset.wordPageNumber ?? index + 1)))
    applyHighlights(wrap, savedHighlights.filter((highlight) => highlight.pageIndex === index))
    const translatePage = h('button', { class: 'reading__translate-page', type: 'button', 'aria-label': `ترجمة الصفحة ${arabicNum(page.dataset.wordPageNumber ?? index + 1)}` }, icon('globe', 17), h('span', null, 'ترجمة الصفحة'))
    translatePage.addEventListener('click', () => openTranslationDialog(page.dataset.searchText ?? page.textContent ?? ''))
    slot.replaceChildren(wrap, translatePage)
    slot.style.minHeight = ''
    pruneMountedPages(index)
  }
  if (typeof IntersectionObserver === 'undefined') pages.forEach((_, index) => mount(index))
  else {
    const observer = routeObserver(new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const index = Number((entry.target as HTMLElement).dataset.pageIndex)
        mount(index)
        observer.unobserve(entry.target)
      }
    }, { rootMargin: '1400px 0px' }), resourceScope)
    slots.forEach((slot) => observer.observe(slot))
    const currentObserver = routeObserver(new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
      if (!visible) return
      const index = Number((visible.target as HTMLElement).dataset.pageIndex)
      const page = pages[index]
      pruneMountedPages(index)
      updatePosition(index)
      localStorage.setItem(positionKey, String(index))
      announceReaderPage(index, pages.length)
    }, { threshold: [0.35, 0.6] }), resourceScope)
    slots.forEach((slot) => currentObserver.observe(slot))
  }
  mount(0)
  updatePosition(0)
  const scrollTo = (index: number): void => {
    const safe = Math.max(0, Math.min(index, slots.length - 1))
    mount(safe)
    pruneMountedPages(safe)
    updatePosition(safe)
    localStorage.setItem(positionKey, String(safe))
    slots[safe]?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'start' })
    announceReaderPage(safe, pages.length)
  }
  jumpToPage = (requested) => {
    const selectedPart = partNumbers.length > 1 ? Number(partSelect.value) : undefined
    const mapped = pages.findIndex((page) => Number(page.dataset.wordPageNumber) === requested && (selectedPart === undefined || Number(page.dataset.partNumber) === selectedPart))
    scrollTo(mapped >= 0 ? mapped : readerIndexForDisplayedPage(activePageNumbers, requested))
  }
  const requestedPage = requestedTafsirPage >= 0 ? requestedTafsirPage : requestedReaderPage(deepLink, pages)
  if (requestedPage >= 0) {
    routeAnimationFrame(() => {
      scrollTo(requestedPage)
      if (requestedParagraph !== undefined) routeAnimationFrame(() => container.querySelector<HTMLElement>(`[data-idx="${requestedParagraph}"]`)?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' }), resourceScope)
      else if (requestedTafsirPage >= 0) routeAnimationFrame(() => {
        const target = [...container.querySelectorAll<HTMLElement>(`[data-tafsir-surah="${deepLink.surah}"]`)].find(node => Number(node.dataset.tafsirFrom) <= deepLink.ayah! && Number(node.dataset.tafsirTo) >= deepLink.ayah!)
        target?.classList.add('reader-deep-link-target'); target?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' })
        if (target) routeTimeout(() => target.classList.remove('reader-deep-link-target'), 2600, resourceScope)
      }, resourceScope)
    }, resourceScope)
  } else {
    const savedIndex = Number(localStorage.getItem(positionKey))
    if (Number.isFinite(savedIndex) && savedIndex > 0 && savedIndex < slots.length) routeAnimationFrame(() => scrollTo(savedIndex), resourceScope)
  }
  return {
    goTo: scrollTo,
    goToDisplayedPage: (page) => scrollTo(readerIndexForDisplayedPage(activePageNumbers, page)),
    goToBookmark: (bookmark) => {
      const pageIndex = pageIndexForBookmark(pages, bookmark)
      if (pageIndex < 0) return false
      scrollTo(pageIndex)
      routeAnimationFrame(() => document.getElementById(bookmark)?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' }), resourceScope)
      return true
    },
    total: pages.length,
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
  for (const highlight of highlights) markText(page, highlight.text, 'reader-highlight', highlight.color, highlight.occurrence ?? 0)
}

function installSelectionMenu(reader: HTMLElement, bookId: string, citation: () => { title: string; author: string }): void {
  const hide = (): void => reader.querySelector('.reader__selection-menu')?.remove()
  const show = (): void => {
    const selection = window.getSelection()
    const text = selection?.toString().trim() ?? ''
    const anchor = selection?.anchorNode instanceof Element ? selection.anchorNode : selection?.anchorNode?.parentElement
    const slot = anchor?.closest<HTMLElement>('.reading__page-slot')
    if (!text || !slot || !selection?.rangeCount) { hide(); return }
    const range = selection.getRangeAt(0).cloneRange()
    const rect = range.getBoundingClientRect()
    const pageIndex = Number(slot.dataset.pageIndex) || 0
    hide()
    const menu = h('div', { class: 'reader__selection-menu', role: 'toolbar', 'aria-label': 'أدوات النص المحدد' })
    const restoreSelection = (): void => { const live = window.getSelection(); live?.removeAllRanges(); live?.addRange(range) }
    const plainCopy = h('button', { type: 'button' }, icon('copy', 16), h('span', null, 'نسخ'))
    plainCopy.addEventListener('click', () => {
      void writeClipboardText(text).then(() => { hide(); selection.removeAllRanges(); toast('نُسخ النص') }).catch(() => toast('تعذّر النسخ'))
    })
    const copy = h('button', { type: 'button' }, icon('box', 16), h('span', null, 'نسخ موثّق'))
    copy.addEventListener('click', () => {
      const meta = citation()
      const part = Number(slot.dataset.partNumber) || 1
      const displayedPage = Number(slot.dataset.wordPageNumber) || pageIndex + 1
      const location = Number(slot.dataset.partCount) > 1 ? `${meta.title} (${arabicNum(part)} / ${arabicNum(displayedPage)})` : `${meta.title} (ص ${arabicNum(displayedPage)})`
      const source = [location, meta.author].filter(Boolean).join(' — ')
      const holder = document.createElement('div')
      holder.appendChild(range.cloneContents())
      holder.querySelectorAll('script,style,button,input,textarea,select').forEach(node => node.remove())
      holder.querySelectorAll<HTMLElement>('[id],[data-page-index],[data-part-number],[data-word-page-number]').forEach(node => {
        node.removeAttribute('id'); for (const key of Object.keys(node.dataset)) delete node.dataset[key]
      })
      const payload = buildRichClipboard(text, source, holder.innerHTML)
      void writeRichClipboard(payload).then((mode) => { hide(); selection.removeAllRanges(); toast(mode === 'rich' ? 'نُسخ النص منسقًا مع توثيقه' : 'نُسخ النص مع توثيقه') }).catch(() => toast('تعذّر النسخ'))
    })
    const highlight = h('button', { type: 'button' }, h('span', { class: 'highlight-dot' }), h('span', null, 'تظليل'))
    highlight.addEventListener('click', () => { restoreSelection(); hide(); showHighlightPalette(reader, bookId) })
    const note = h('button', { type: 'button' }, icon('more', 16), h('span', null, 'ملاحظة'))
    note.addEventListener('click', () => { addNote(bookId, pageIndex, text); hide(); selection.removeAllRanges(); toast('حُفظ المقتطف في ملاحظات الكتاب') })
    const librarySearch = h('button', { type: 'button' }, icon('search', 16), h('span', null, 'في الخِزانة'))
    librarySearch.addEventListener('click', () => {
      const target = new URL(`#/search?q=${encodeURIComponent(text)}&mode=exact`, location.href).href
      window.open(target, '_blank', 'noopener,noreferrer')
      hide(); selection.removeAllRanges()
    })
    const googleSearch = h('button', { type: 'button' }, icon('globe', 16), h('span', null, 'في Google'))
    googleSearch.addEventListener('click', () => { window.open(`https://www.google.com/search?q=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer'); hide(); selection.removeAllRanges() })
    const translation = h('button', { type: 'button' }, icon('globe', 16), h('span', null, 'ترجمة'))
    translation.addEventListener('click', () => { hide(); selection.removeAllRanges(); openTranslationDialog(text) })
    menu.append(plainCopy, copy, translation, highlight, note, librarySearch, googleSearch)
    menu.style.insetInlineStart = `${Math.max(8, Math.min(window.innerWidth - Math.min(620, window.innerWidth - 16), rect.left + rect.width / 2 - 260))}px`
    menu.style.insetBlockStart = `${Math.max(70, rect.top - 52)}px`
    reader.appendChild(menu)
  }
  reader.addEventListener('pointerup', (event) => {
    if ((event.target as Element | null)?.closest('.reader__toolbar, .reader__selection-menu, .reader__highlight-menu')) return
    routeAnimationFrame(show)
  })
  reader.addEventListener('keyup', (event) => { if (event.key.startsWith('Arrow') || event.key === 'Shift') routeAnimationFrame(show) })
}

function showHighlightPalette(reader: HTMLElement, bookId: string): void {
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
  const menu = h('div', { class: 'reader__highlight-menu', role: 'dialog', 'aria-label': 'اختر لون التظليل' }, h('strong', null, 'لون التظليل'))
  const colors: { id: HighlightColor; label: string }[] = [{ id: 'important', label: 'مهم' }, { id: 'evidence', label: 'دليل' }, { id: 'review', label: 'مراجعة' }, { id: 'correction', label: 'تصحيح' }]
  for (const color of colors) {
    const button = h('button', { type: 'button', class: 'reader__highlight-choice' }, h('span', null), color.label)
    button.dataset.highlightColor = color.id
    button.addEventListener('click', () => {
      addHighlight(bookId, Number(slot.dataset.pageIndex) || 0, text, color.id, occurrence)
      markText(page, text, 'reader-highlight', color.id, occurrence)
      selection?.removeAllRanges(); menu.remove(); toast(`حُفظ تظليل «${color.label}»`)
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
        h('span', { class: 'reader__info-author-placeholder' }, 'جارٍ إحضار المؤلف…'),
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
    h('div', { class: 'reader__info-content' }, h('h2', null, title), h('p', null, 'جارٍ إحضار بيانات الكتاب…')),
  ))
  const hide = (): void => { dialog.hidden = true; document.body.classList.remove('reader-book-card-open') }
  close.addEventListener('click', hide)
  dialog.addEventListener('click', event => { if (event.target === dialog) hide() })
  routeEventListener(window, 'keydown', event => { if ((event as KeyboardEvent).key === 'Escape' && !dialog.hidden) hide() })
  return dialog
}

function toggleBookInfoDialog(dialog: HTMLElement): void {
  const opening = dialog.hidden
  dialog.hidden = !opening
  document.body.classList.toggle('reader-book-card-open', opening)
  if (opening) dialog.querySelector<HTMLElement>('.reader__book-card-close')?.focus()
}

function currentPageIndex(bookId: string): number {
  return Math.max(0, Number(localStorage.getItem(`alkhizana:reading-position:${bookId}`)) || 0)
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
  const render = (): void => {
    const state = getAnnotations()
    const bookmarks = state.bookmarks[bookId] ?? []
    const notes = state.notes.filter((note) => note.bookId === bookId)
    const highlights = state.highlights.filter((highlight) => highlight.bookId === bookId)
    const form = h('form', { class: 'annotation-form' })
    const textarea = h('textarea', { class: 'annotation-form__input', placeholder: `اكتب ملاحظة على الصفحة ${arabicNum(currentPageIndex(bookId) + 1)}…`, 'aria-label': 'نص الملاحظة' }) as HTMLTextAreaElement
    textarea.rows = 4
    form.append(textarea, h('button', { class: 'btn btn--primary', type: 'submit' }, 'حفظ الملاحظة'))
    form.addEventListener('submit', (event) => {
      event.preventDefault()
      if (!textarea.value.trim()) { toast('اكتب الملاحظة أولًا'); return }
      addNote(bookId, currentPageIndex(bookId), textarea.value)
      toast('حُفظت الملاحظة')
      render()
    })
    const bookmarkList = h('div', { class: 'annotation-list' })
    for (const page of bookmarks) bookmarkList.appendChild(annotationJump(`علامة الصفحة ${arabicNum(page + 1)}`, page))
    const noteList = h('div', { class: 'annotation-list' })
    for (const note of notes) {
      const item = annotationJump(note.text, note.pageIndex)
      const remove = h('button', { class: 'annotation-delete', type: 'button', 'aria-label': 'حذف الملاحظة' }, icon('close', 15))
      remove.addEventListener('click', (event) => { event.stopPropagation(); if (!confirm(annotationDeletePrompt('ملاحظة', note.pageIndex + 1))) return; deleteNote(note.id); render() })
      item.appendChild(remove)
      noteList.appendChild(item)
    }
    const highlightList = h('div', { class: 'annotation-list' })
    for (const highlight of highlights) {
      const item = annotationJump(highlight.text, highlight.pageIndex)
      item.dataset.highlightColor = highlight.color
      const remove = h('button', { class: 'annotation-delete', type: 'button', 'aria-label': 'حذف التظليل' }, icon('close', 15))
      remove.addEventListener('click', (event) => { event.stopPropagation(); if (!confirm(annotationDeletePrompt('تظليل', highlight.pageIndex + 1))) return; deleteHighlight(highlight.id); render() })
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

function annotationJump(label: string, pageIndex: number): HTMLElement {
  const item = h('div', { class: 'annotation-item' })
  const jump = h('button', { class: 'annotation-item__jump', type: 'button' }, h('span', null, label), h('small', null, `صفحة ${arabicNum(pageIndex + 1)}`))
  jump.addEventListener('click', () => {
    const page = document.querySelector<HTMLElement>(`.reading__page-slot[data-page-index="${pageIndex}"]`)
    if (page) page.scrollIntoView({ behavior: readerScrollBehavior(), block: 'start' })
    else window.dispatchEvent(new CustomEvent(READER_PAGE_REQUEST_EVENT, { detail: { index: pageIndex } }))
  })
  item.appendChild(jump)
  return item
}

function renderBookInfo(panel: HTMLElement, book: StoredBook): void {
  const resolvedTitle = storedReaderTitle(book)
  const content = panel.querySelector('.reader__info-content')
  const identity = panel.querySelector<HTMLElement>('.reader__info-identity')
  identity?.replaceChildren(
    h('strong', { class: 'reader__info-book-link' }, resolvedTitle),
    bookAuthorLinks(book, 'reader__info-author-link'),
  )
  const author = bookAuthorLinks(book)
  const format = inferBookFormat(book)
  const formatNames: Record<string, string> = { word: 'Word', pdf: 'PDF', 'shamela-bok': 'BOK الشاملة', epub: 'EPUB', text: 'نص', markdown: 'Markdown' }
  const source = h('button', { class: 'reader__metadata-link', type: 'button' }, format === 'pdf' ? 'تحميل PDF' : `تحميل ${formatNames[format] ?? 'الملف'} الأصلي`)
  source.addEventListener('click', () => downloadBytes(book.sourceData ?? book.data, book.fileName, book.sourceMimeType || book.mimeType || 'application/octet-stream'))
  const pdf = h('button', { class: 'reader__metadata-link', type: 'button' }, needsPdfRefresh(book) ? 'إنشاء PDF مطابق' : 'تحميل PDF') as HTMLButtonElement
  pdf.addEventListener('click', () => void downloadConvertedPdf(book.id))
  if (format === 'word' && needsPdfRefresh(book)) {
    pdf.disabled = true
    pdf.textContent = 'جارٍ التحقق من PDF…'
    void getRuntimeCapabilities().then(capabilities => {
      if (!pdf.isConnected) return
      pdf.disabled = !capabilities.wordPdfConversionAvailable
      pdf.textContent = capabilities.wordPdfConversionAvailable ? 'إنشاء PDF مطابق' : 'إنشاء PDF — يتطلب التطبيق المحلي'
      if (!capabilities.wordPdfConversionAvailable) pdf.title = 'نسخة الويب تقرأ Word وتستورد الكتب، لكنها لا تشغّل Microsoft Word.'
    })
  }
  const edit = h('a', { class: 'reader__metadata-link', href: `#/library?edit=${encodeURIComponent(book.id)}` }, 'تعديل الكتاب')
  const facts: HTMLElement[] = [
    h('div', null, h('dt', null, 'المؤلف'), h('dd', null, author)),
    h('div', null, h('dt', null, 'الصيغة'), h('dd', null, formatNames[format] ?? format)),
    h('div', null, h('dt', null, 'التصنيف'), h('dd', null, book.category ? categoryLink(book.category) : 'غير مصنّف')),
  ]
  if (book.tags?.length) facts.push(h('div', null, h('dt', null, 'الوسوم'), h('dd', { class: 'reader__book-tags' }, ...book.tags.map(tag => h('a', { class: 'book-tag', href: `#/library?tag=${encodeURIComponent(tag.name)}`, title: tag.source === 'toc' ? 'مستخرج من فهرس الكتاب' : 'أضيف يدويًا' }, `#${tag.name}`)))))
  if (book.publisher) facts.push(h('div', null, h('dt', null, 'الناشر'), h('dd', null, book.publisher)))
  if (book.edition) facts.push(h('div', null, h('dt', null, 'الطبعة'), h('dd', null, book.edition)))
  if (book.investigator) facts.push(h('div', null, h('dt', null, 'التحقيق'), h('dd', null, book.investigator)))
  if (book.publicationYearHijri) facts.push(h('div', null, h('dt', null, 'سنة النشر'), h('dd', null, `${arabicNum(book.publicationYearHijri)}هـ`)))
  if (book.sourceCitation) facts.push(h('div', null, h('dt', null, 'المصدر'), h('dd', null, book.sourceCitation)))
  if (book.volumeCount && book.volumeCount > 1) facts.push(h('div', null, h('dt', null, 'الأجزاء'), h('dd', null, arabicNum(book.volumeCount))))
  const actions = h('div', { class: 'reader__book-card-actions' }, source)
  if (format === 'word' && (book.pdfData?.length || needsPdfRefresh(book))) actions.appendChild(pdf)
  if (book.managedSource !== 'published') actions.appendChild(edit)
  else actions.appendChild(h('span', { class: 'reader__metadata-fixed' }, 'كتاب أصلي مثبّت'))
  content?.replaceChildren(
    h('p', { class: 'home-kicker' }, 'معلومات الكتاب'),
    bookCover(book, 'reader__book-cover'),
    h('dl', { class: 'reader__metadata' }, ...facts),
    ...(book.description ? [h('section', { class: 'reader__book-card-description' }, h('h3', null, 'عن الكتاب'), h('p', null, book.description))] : []),
    actions,
  )
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

async function showPdfBesideBook(id: string, panel: HTMLElement, standalone = false): Promise<void> {
  closePdfPreview(panel)
  panel.classList.add('reader__info--open', 'reader__info--pdf')
  const readerBody = panel.closest<HTMLElement>('.reader__body')
  readerBody?.classList.add('reader__body--pdf')
  readerBody?.classList.toggle('reader__body--pdf-only', standalone)
  scheduleWordPageRefit(readerBody)
  const content = panel.querySelector<HTMLElement>('.reader__info-content')
  if (!content) return
  content.replaceChildren(stateView({ kind: 'loading', icon: 'book', title: standalone ? 'جارٍ فتح كتاب PDF' : 'جارٍ تجهيز معاينة PDF', description: standalone ? 'نحمّل الصفحة الحالية أولًا من ملف PDF الأصلي.' : 'نحمّل الصفحات ونزامنها مع نص Word.', compact: true }))
  try {
    let stored = await getBook(id)
    if (stored && needsPdfRefresh(stored)) {
      const capabilities = await getRuntimeCapabilities()
      if (!capabilities.wordPdfConversionAvailable) throw new Error('إنشاء PDF يتطلب تشغيل الخِزانة المحلي؛ يمكنك متابعة قراءة Word في نسخة الويب.')
      await convertStoredBookToPdf(id); stored = await getBook(id)
    }
    if (!stored?.pdfData?.length) throw new Error('لا توجد نسخة PDF لهذا الكتاب')
    assertBookFormat(stored.pdfData, 'pdf')
    const pdfjs = await import('pdfjs-dist')
    pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerUrl
    // بعض الخطوط العربية القديمة تتفكك حين يحولها PDF.js إلى WebFont. رسم
    // glyphs من أوامر PDF نفسها يحافظ على تشكيل Word البصري.
    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(stored.pdfData),
      disableFontFace: true,
      useSystemFonts: false,
      // المفكك JS المحلي أبطأ قليلًا في أول صفحة لكنه أوسع توافقًا مع
      // مقاطع JBIG2 القديمة من wasm (ومنها صفحات 8 في corpus الحالي).
      useWasm: false,
      ...pdfJsLocalAssets(),
    })
    const pdfDocument = await loadingTask.promise
    let pageIndex = currentPageIndex(id)
    const total = Math.max(1, pdfDocument.numPages)
    const displayedTotal = standalone ? total : activeDisplayedTotal || total
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
    const displayedPage = (pdfIndex: number): number => standalone ? pdfIndex + 1 : activePageNumbers[readerIndexForPdf(pdfIndex)] ?? pdfIndex + 1
    const label = h('strong', { class: 'reader__pdf-page-label', role: 'status' })
    const previous = h('button', { class: 'pager-btn', type: 'button', 'aria-label': 'صفحة PDF السابقة' }, icon('chevron-right', 18)) as HTMLButtonElement
    const next = h('button', { class: 'pager-btn', type: 'button', 'aria-label': 'صفحة PDF التالية' }, icon('chevron-left', 18)) as HTMLButtonElement
    const viewport = h('div', { class: 'reader__pdf-viewport', 'aria-label': `صفحات PDF من ${stored.title}` })
    const stream = h('div', { class: 'reader__pdf-stream' })
    const slots = Array.from({ length: total }, (_, index) => {
      const slot = h('section', { class: 'reader__pdf-page', 'aria-label': `صفحة PDF ${arabicNum(index + 1)} من ${arabicNum(total)}` })
      slot.dataset.pdfPageIndex = String(index)
      slot.dataset.mounted = 'false'
      slot.style.minHeight = '900px'
      stream.appendChild(slot)
      return slot
    })
    viewport.appendChild(stream)
    const pageInput = h('input', { type: 'number', 'aria-label': 'رقم صفحة PDF للانتقال' }) as HTMLInputElement
    pageInput.min = '1'; pageInput.max = String(displayedTotal); pageInput.value = String(displayedPage(pageIndex))
    const partInput = h('select', { 'aria-label': 'رقم الجزء للانتقال' }) as HTMLSelectElement
    for (const part of parts) partInput.appendChild(h('option', { value: String(part.number) }, part.title || `الجزء ${arabicNum(part.number)}`))
    const jump = h('form', { class: 'reader__pdf-jump' }, ...(parts.length > 1 ? [partInput] : []), pageInput, h('button', { type: 'submit' }, 'انتقل'))
    let suppressPdfObserverUntil = 0
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
    const prunePdfCache = (center: number): void => {
      for (const index of [...rendered]) {
        if (Math.abs(index - center) <= 2) continue
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
      rendered.add(index)
      const slot = slots[index]
      if (!slot) return
      const pdfPage = await pdfDocument.getPage(index + 1)
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
        } else if (attempt < 2 || pagesWithInk.has(index)) {
          routeAnimationFrame(() => { invalidatePdfPage(index); void renderPage(index) })
        }
      } catch (error) {
        rendered.delete(index)
        if (!(error instanceof Error) || error.name !== 'RenderingCancelledException') {
          if (attempt < 3) routeAnimationFrame(() => void renderPage(index))
          else slot.replaceChildren(stateView({ kind: 'error', title: 'تعذّر رسم صفحة PDF', description: 'تعذر فك محتوى هذه الصفحة محليًا؛ ملف PDF الأصلي لم يتغير.', compact: true }))
        }
      } finally { if (renderTasks.get(index) === task) renderTasks.delete(index) }
    }
    // مفكك JBIG2 المشترك في PDF.js لا يتحمل دائمًا بدء عدة صفحات مصوّرة
    // في اللحظة نفسها. نرسم الحالية أولًا ثم الجارتين بالتتابع؛ لا يؤخر
    // أول ظهور ويمنع فشل صفحات صحيحة بحسب توقيت السباق.
    const renderPage = (index: number): Promise<void> => {
      const scheduled = renderTail.then(() => renderPageNow(index))
      renderTail = scheduled.catch(() => undefined)
      return scheduled
    }
    const setPage = (nextIndex: number, syncText: boolean, smooth = true): void => {
      pageIndex = Math.max(0, Math.min(nextIndex, total - 1))
      localStorage.setItem(`alkhizana:reading-position:${id}`, String(pageIndex))
      announceReaderPage(pageIndex, total)
      label.textContent = `صفحة ${arabicNum(displayedPage(pageIndex))} من ${arabicNum(displayedTotal)}`
      pageInput.value = String(displayedPage(pageIndex))
      previous.disabled = pageIndex <= 0
      next.disabled = pageIndex >= total - 1
      suppressPdfObserverUntil = performance.now() + 700
      prunePdfCache(pageIndex)
      void renderPage(pageIndex)
      for (const nearby of [pageIndex - 1, pageIndex + 1]) if (nearby >= 0 && nearby < total) void renderPage(nearby)
      const slot = slots[pageIndex]
      if (slot) viewport.scrollTo({ top: slot.offsetTop, behavior: smooth ? 'smooth' : 'auto' })
      if (syncText) activePageNavigation?.goTo(readerIndexForPdf(pageIndex))
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
      const detail = (event as CustomEvent<{ index: number }>).detail
      if (Number.isInteger(detail?.index)) {
        const target = pdfIndexForReader(detail.index)
        if (target !== pageIndex) setPage(target, false)
      }
    }
    routeEventListener(window, READER_PAGE_EVENT, onReaderPage)
    const renderObserver = routeObserver(new IntersectionObserver((entries) => {
      for (const entry of entries) if (entry.isIntersecting) {
        const index = Number((entry.target as HTMLElement).dataset.pdfPageIndex)
        if (Math.abs(index - pageIndex) <= 2) {
          const slot = slots[index]
          if (slot?.dataset.mounted === 'true' && pdfCanvasNeedsRepair(slot) && (renderAttempts.get(index) ?? 0) < 2) invalidatePdfPage(index)
          void renderPage(index)
        }
      }
    }, { root: viewport, rootMargin: '900px 0px' }))
    const ratios = new Map<Element, number>()
    const pageObserver = routeObserver(new IntersectionObserver((entries) => {
      for (const entry of entries) ratios.set(entry.target, entry.isIntersecting ? entry.intersectionRatio : 0)
      const visible = [...ratios.entries()].sort((a, b) => b[1] - a[1])[0]
      if (!visible || visible[1] < .35) return
      const nextIndex = Number((visible[0] as HTMLElement).dataset.pdfPageIndex)
      if (!Number.isInteger(nextIndex) || nextIndex === pageIndex) return
      pageIndex = nextIndex
      localStorage.setItem(`alkhizana:reading-position:${id}`, String(pageIndex))
      announceReaderPage(pageIndex, total)
      prunePdfCache(pageIndex)
      label.textContent = `صفحة ${arabicNum(displayedPage(pageIndex))} من ${arabicNum(displayedTotal)}`
      pageInput.value = String(displayedPage(pageIndex))
      previous.disabled = pageIndex <= 0; next.disabled = pageIndex >= total - 1
      if (performance.now() >= suppressPdfObserverUntil) activePageNavigation?.goTo(readerIndexForPdf(pageIndex))
    }, { root: viewport, threshold: [.35, .55, .75] }))
    const onPageRequest = (event: Event): void => {
      const index = Number((event as CustomEvent<{ index: number }>).detail?.index)
      if (Number.isInteger(index)) setPage(index, true)
    }
    routeEventListener(window, READER_PAGE_REQUEST_EVENT, onPageRequest)
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
    ;(panel as HTMLElement & { __pdfCleanup?: () => void }).__pdfCleanup = () => {
      window.removeEventListener(READER_PAGE_EVENT, onReaderPage)
      renderObserver.disconnect(); pageObserver.disconnect(); resizeObserver?.disconnect(); for (const task of renderTasks.values()) task.cancel(); renderTasks.clear(); void loadingTask.destroy()
    }
    const controls = h('div', { class: 'reader__pdf-controls', 'aria-label': 'التنقل المتزامن في PDF' }, previous, label, next, jump)
    content.replaceChildren(controls, viewport, h('div', { class: 'reader__pdf-source-note', role: 'note' }, h('strong', null, 'نسخة PDF أصلية'), h('p', null, 'تُعرض الصفحات من ملف PDF نفسه. البحث النصي لا يتاح إلا إذا احتوى الملف طبقة نصية.')))
    await renderPage(pageIndex)
    setPage(pageIndex, false, false)
    void extractPdfOutline(pdfDocument).then(pdfOutline => {
      if (!pdfOutline.length || !panel.isConnected) return
      const tocAside = document.querySelector<HTMLElement>('.reader__toc')
      if (tocAside) { renderTocAside(tocAside, 'day', pdfOutline); enableTocNavigation(pdfOutline, { goTo: index => setPage(index, true), goToDisplayedPage: page => setPage(page - 1, true), total }) }
    }).catch(() => undefined)
  } catch (error) {
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
          title: `النسخة الأصلية من ${stored.title}`,
        }) as HTMLIFrameElement
        const download = h('button', { class: 'btn btn--secondary', type: 'button' }, 'تحميل PDF الأصلي')
        download.addEventListener('click', () => downloadBytes(stored.pdfData!, stored.pdfFileName ?? `${stored.title}.pdf`, 'application/pdf'))
        content.replaceChildren(
          h('div', { class: 'reader__pdf-source-note', role: 'status' },
            h('strong', null, 'العرض الأصلي المتوافق'),
            h('p', null, 'فتحنا ملف PDF نفسه بعارض الجهاز لأن المفكك الداخلي لم يقبل بنية هذا الإصدار القديم.'),
            download,
          ),
          frame,
        )
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
  const pdfPanel = panel as HTMLElement & { __pdfCleanup?: () => void }
  pdfPanel.__pdfCleanup?.()
  delete pdfPanel.__pdfCleanup
  panel.classList.remove('reader__info--pdf')
  const readerBody = panel.closest<HTMLElement>('.reader__body')
  readerBody?.classList.remove('reader__body--pdf', 'reader__body--pdf-only')
  scheduleWordPageRefit(readerBody)
}

/** يعيد تحجيم صفحات Word المركبة بعد أن يتغير عرض العمود عند فتح/إغلاق PDF.
 * لا يغيّر تخطيط Word أو فواصل الصفحات؛ يغيّر مقياس العرض الخارجي فقط. */
function scheduleWordPageRefit(readerBody: HTMLElement | null): void {
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
  routeAnimationFrame(() => { apply(); routeAnimationFrame(apply) })
}


/** فتح/إغلاق لوحة الفهرس الجانبية */
function toggleToc(_header: HTMLElement): void {
  const toc = document.querySelector('.reader__toc')
  const stage = document.querySelector('.reader__stage')
  if (!toc) return
  if (window.matchMedia('(max-width: 1024px)').matches) {
    toc.classList.toggle('reader__toc--mobile-open')
    return
  }
  const isHidden = toc.classList.toggle('reader__toc--hidden')
  if (stage) stage.classList.toggle('reader__stage--full', isHidden)
}

/** فتح/إغلاق شريط البحث */
function toggleSearch(reader: HTMLElement): void {
  const existing = reader.querySelector('.reader__search-bar')
  if (existing) { existing.remove(); return }
  const bar = h('div', { class: 'reader__search-bar' })
  const input = h('input', { type: 'search', placeholder: 'ابحث في جميع صفحات الكتاب…', 'aria-label': 'عبارة البحث في الكتاب' }) as HTMLInputElement
  const count = h('span', { class: 'reader__search-count', role: 'status' }, '')
  const previous = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'النتيجة السابقة' }, icon('chevron-right', 17)) as HTMLButtonElement
  const next = h('button', { class: 'btn btn--icon', type: 'button', 'aria-label': 'النتيجة التالية' }, icon('chevron-left', 17)) as HTMLButtonElement
  let matches: { slot: HTMLElement; occurrence: number }[] = []
  let current = -1

  const activate = (): void => {
    const match = matches[current]
    if (!match) return
    match.slot.scrollIntoView({ behavior: readerScrollBehavior(), block: 'start' })
    routeAnimationFrame(() => {
      markText(match.slot, input.value.trim(), 'reader-search-mark')
      match.slot.querySelectorAll('mark.reader-search-mark')[match.occurrence]?.scrollIntoView({ behavior: readerScrollBehavior(), block: 'center' })
    })
    count.textContent = `${arabicNum(current + 1)} من ${arabicNum(matches.length)}`
  }

  const runSearch = (): void => {
    reader.querySelectorAll('mark.reader-search-mark').forEach((mark) => mark.replaceWith(document.createTextNode(mark.textContent ?? '')))
    const q = input.value.trim()
    if (!q) { matches = []; count.textContent = ''; return }
    matches = []
    for (const slot of reader.querySelectorAll<HTMLElement>('.reading__page-slot')) {
      const text = slot.dataset.searchText ?? ''
      let offset = 0
      let occurrence = 0
      while ((offset = text.indexOf(q, offset)) >= 0) { matches.push({ slot, occurrence }); occurrence++; offset += Math.max(1, q.length) }
    }
    current = matches.length ? 0 : -1
    previous.disabled = next.disabled = matches.length === 0
    count.textContent = matches.length ? `١ من ${arabicNum(matches.length)}` : 'لا نتائج'
    if (matches.length) activate()
  }

  const move = (delta: number): void => {
    if (!matches.length) return
    current = (current + delta + matches.length) % matches.length
    activate()
  }

  input.addEventListener('input', runSearch)
  input.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') move(ev.shiftKey ? -1 : 1)
  })
  previous.addEventListener('click', () => move(-1))
  next.addEventListener('click', () => move(1))

  const closeBtn = h('button', { class: 'reader__search-close', type: 'button', 'aria-label': 'إغلاق البحث داخل الكتاب' }, '✕')
  closeBtn.onclick = () => bar.remove()
  bar.append(input, count, previous, next, closeBtn)
  const stage = reader.querySelector('.reader__stage')
  if (stage) stage.prepend(bar)
  setTimeout(() => input.focus(), 100)
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
  label.textContent = `صفحة ${arabicNum(displayCurrent)} من ${arabicNum(displayTotal)}`
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
    for (const volume of volumes) {
      downloadBytes(volume.sourceData ?? volume.data, volume.fileName, volume.sourceMimeType ?? volume.mimeType)
      await new Promise(resolve => setTimeout(resolve, 120))
    }
    toast(`بدأ تنزيل ${arabicNum(volumes.length)} أجزاء بصيغ Word الأصلية`)
    return
  }
  downloadBytes(stored.data, stored.fileName,
    stored.mimeType || 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
}

async function downloadConvertedPdf(id: string): Promise<void> {
  let stored = await getBook(id)
  if (!stored) { toast('نسخة PDF متاحة للكتب المرفوعة بعد حفظها في المكتبة'); return }
  if (needsPdfRefresh(stored)) {
    const capabilities = await getRuntimeCapabilities()
    if (!capabilities.wordPdfConversionAvailable) {
      toast('إنشاء PDF يتطلب تشغيل الخِزانة المحلي؛ القراءة والاستيراد يعملان في نسخة الويب.')
      return
    }
    toast(stored.volumes && stored.volumes.length > 1 ? 'جارٍ تحويل أجزاء Word ودمجها في PDF واحد…' : 'جارٍ تحويل ملف Word الأصلي إلى PDF عبر Microsoft Word…')
    try {
      await convertStoredBookToPdf(id)
      stored = await getBook(id)
    } catch (error) {
      toast(`تعذّر إنشاء PDF: ${error instanceof Error ? error.message : String(error)}`)
      return
    }
  }
  if (!stored?.pdfData?.length) { toast('لم تتوفر نسخة PDF'); return }
  downloadBytes(stored.pdfData, stored.pdfFileName ?? `${stored.title}.pdf`, 'application/pdf')
}

function returnBar(book?: { title: string }): HTMLElement {
  const bar = h('a', { class: 'return-bar', href: '#/', 'aria-label': 'العودة إلى موضعك' })
  bar.appendChild(icon('arrow-back', 16))
  bar.appendChild(h('span', null, 'عودة إلى موضعك — '))
  bar.appendChild(h('strong', null, book?.title ?? 'الخِزانة'))
  bar.appendChild(h('span', null, ' · صفحة ١٤٧'))
  return bar
}

function readerHeader(title: string, book?: { title: string; author?: string }): HTMLElement {
  const header = h('header', { class: 'reader__header' })
  const inner = h('div', { class: 'reader__header-inner' })

  inner.appendChild(
    h('button', { class: 'btn btn--icon', 'aria-label': 'رجوع', onclick: () => (location.hash = '#/') }, icon('arrow-back', 20)),
  )
  inner.appendChild(h('button', { class: 'btn btn--icon', 'aria-label': 'الفهرس', onclick: () => toggleToc(header) }, icon('list', 20)))

  const titleWrap = h('div', { class: 'reader__title-wrap' })
  titleWrap.appendChild(h('div', { class: 'reader__title' }, title))
  if (book) {
    titleWrap.appendChild(
      h('span', { class: 'reader__chapter' }, `${book.author} — محرك المشهد الهندسي`),
    )
  }
  inner.appendChild(titleWrap)

  inner.appendChild(h('div', { style: 'flex:1' }))
  inner.appendChild(h('button', { class: 'btn btn--icon', 'aria-label': 'بحث في الكتاب', onclick: () => { const r = header.closest('.reader') as HTMLElement | null; if (r) toggleSearch(r); } }, icon('search', 20)))
  inner.appendChild(h('button', { class: 'btn btn--icon', 'aria-label': 'أدوات' }))

  header.appendChild(inner)
  return header
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
  aside.classList.toggle('reader__toc--empty', empty)
  const toggle = document.querySelector<HTMLButtonElement>('.reader__toc-toggle')
  if (toggle) { toggle.hidden = empty; toggle.disabled = empty }
  if (empty) return
  const search = h('input', { type: 'search', class: 'reader__toc-search', placeholder: 'ابحث في عناوين الفهرس…', 'aria-label': 'البحث في عناوين الفهرس' }) as HTMLInputElement
  const clear = h('button', { type: 'button', class: 'reader__toc-clear', 'aria-label': 'مسح بحث الفهرس' }, 'مسح') as HTMLButtonElement
  const status = h('p', { class: 'reader__toc-status', role: 'status', 'aria-live': 'polite' })
  const list = h('div', { class: 'reader__toc-list' })
  aside.append(h('div', { class: 'reader__toc-filter' }, search, clear), status, list)
  const items: { el: HTMLElement; num: number; bookmark?: string; label: string }[] = []
  for (const it of entries) {
    const el = h('button', { type: 'button', class: 'reader__toc-item', dataset: { level: String(it.level ?? 1) }, onclick: () => {}, 'aria-label': `انتقل إلى ${it.label}` },
      h('span', { class: 'num' }, arabicNum(it.num)),
      h('span', null, it.label),
    )
    list.appendChild(el)
    items.push({ el, num: it.num, label: it.label, ...(it.bookmark ? { bookmark: it.bookmark } : {}) })
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

  const chapter = h('div', { class: 'reading__chapter-title' })
  chapter.appendChild(h('h1', null, 'جارٍ فتح الكتاب…'))
  chapter.appendChild(h('span', { class: 'ornament' }))
  col.appendChild(chapter)

  // شريط التقدم
  const progressWrap = h('div', { class: 'reading__progress' })
  progressWrap.appendChild(h('div', { class: 'reading__progress-bar' },
    h('div', { class: 'reading__progress-fill' }),
  ))
  progressWrap.appendChild(h('div', { class: 'reading__progress-label' }, '…'))
  col.appendChild(progressWrap)

  return col
}

function readerToolbar(onDownloadWord: () => void, onDownloadPdf: () => void, onInfo: () => void, onPdfBeside: () => void, onToc: () => void, onBookmark: () => void, onAnnotations: () => void, onSearch: () => void, onSerenity: () => void, onReadingMode: () => ReadingMode): HTMLElement {
  const bar = h('footer', { class: 'reader__toolbar' })
  const inner = h('div', { class: 'reader__toolbar-inner' })

  const tocButton = h('button', { class: 'tool-btn reader__toc-toggle', onclick: onToc }, icon('list', 19), h('span', null, 'الفهرس')) as HTMLButtonElement
  tocButton.hidden = true
  inner.appendChild(tocButton)
  inner.appendChild(h('button', { class: 'tool-btn', dataset: { readerAction: 'search' }, onclick: onSearch }, icon('search', 19), h('span', null, 'بحث في الكتاب')))
  const mode = h('button', { class: 'tool-btn reader__mode-toggle', dataset: { readerAction: 'flow' }, type: 'button' }, icon('book', 19), h('span', null, readingModeLabel(getReadingMode()))) as HTMLButtonElement
  mode.setAttribute('aria-pressed', String(getReadingMode() === 'flow'))
  mode.addEventListener('click', () => { const next = onReadingMode(); mode.setAttribute('aria-pressed', String(next === 'flow')); mode.querySelector('span')!.textContent = readingModeLabel(next) })
  inner.appendChild(mode)
  const serenity = h('button', { class: 'tool-btn reader__serenity-toggle', onclick: onSerenity }, icon('moon', 19), h('span', null, 'سكينة'))
  serenity.setAttribute('aria-pressed', 'false')
  inner.appendChild(serenity)
  inner.appendChild(h('button', { class: 'tool-btn', onclick: onBookmark }, icon('bookmark', 19), h('span', null, 'علامة')))
  inner.appendChild(h('button', { class: 'tool-btn', onclick: onAnnotations }, icon('more', 19), h('span', null, 'ملاحظاتي')))
  inner.appendChild(h('button', { class: 'tool-btn', onclick: onInfo }, icon('book', 19), h('span', null, 'معلومات الكتاب')))
  const besidePdf = h('button', { class: 'tool-btn', type: 'button', onclick: onPdfBeside }, icon('box', 19), h('span', null, 'PDF بجوار النص')) as HTMLButtonElement
  besidePdf.dataset.readerPdfAction = 'beside'
  inner.appendChild(besidePdf)
  const sourceDownload = h('button', { class: 'tool-btn tool-btn--accent', onclick: onDownloadWord }, icon('download', 19), h('span', null, 'Word الأصلي'))
  sourceDownload.dataset.readerSourceAction = 'download'
  inner.appendChild(sourceDownload)
  const downloadPdf = h('button', { class: 'tool-btn', type: 'button', onclick: onDownloadPdf }, icon('download', 19), h('span', null, 'PDF')) as HTMLButtonElement
  downloadPdf.dataset.readerPdfAction = 'download'
  inner.appendChild(downloadPdf)

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
  toast(enabled ? 'فُعّل وضع السكينة' : 'عادت أدوات القارئ')
}
