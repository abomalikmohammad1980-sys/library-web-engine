import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { pdfReaderEventSyncTarget, pdfTextSyncIndex } from './pdf_scroll_sync'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const intake = readFileSync(new URL('./book_import.ts', import.meta.url), 'utf8')
const pdfDraft = readFileSync(new URL('./pdf_import_draft.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('PDF reader and cover lifecycle', () => {
  it('renders the current page before asynchronous outline and bounds canvas cache', () => {
    expect(reader.indexOf('await renderPageNow(pageIndex)')).toBeLessThan(reader.indexOf('void extractPdfOutline(pdfDocument).then'))
    expect(reader).toContain('const eagerPdfLimit = 32')
    expect(reader).toContain('const pdfCacheRadius = total <= eagerPdfLimit ? total : 6')
    expect(reader).toContain('Math.abs(index - center) <= pdfCacheRadius')
    expect(reader).toContain('renderTasks.get(index)?.cancel()')
    expect(reader).toContain('for (const task of renderTasks.values()) task.cancel()')
  })

  it('centers PDF pages without appending an explanatory card below the viewport', () => {
    expect(styles).toContain('place-items: center')
    expect(reader).toContain('content.replaceChildren(controls, viewport)')
    expect(reader).not.toContain("h('strong', null, 'نسخة PDF أصلية')")
  })

  it('offers page-one cover keep, replacement and generated-cover removal', () => {
    expect(pdfDraft).toContain('firstPageCover(data).catch(() => undefined)')
    expect(intake).toContain('اعتماد الصفحة الأولى غلافًا')
    expect(intake).toContain('أزل العلامة لاستخدام الغلاف المولّد')
    expect(intake.indexOf('saveReviewedDraft')).toBeGreaterThan(intake.indexOf("form.addEventListener('submit'"))
  })

  it('does not let a stale optional PDF preview module reject the original PDF intake', () => {
    const config = readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    expect(config).toContain("exclude: ['harfbuzzjs', 'pdfjs-dist']")
    expect(pdfDraft).toContain('firstPageCover(data).catch(() => undefined)')
    expect(intake).toContain('return preparePdfImportDraft(file, fallbackAuthor)')
  })

  it('does not inherit Word page identity when a standalone PDF follows another book', () => {
    expect(reader).toContain('activeDisplayedTotal = 0')
    expect(reader).toContain('const displayedTotal = standalone ? total : activeDisplayedTotal || total')
    expect(reader).toContain('standalone ? pdfIndex + 1')
    expect(reader).toContain("class: 'reader__pdf-pending'")
    expect(reader).not.toContain("'جارٍ فتح كتاب PDF'")
    expect(reader).not.toContain("'جارٍ تجهيز معاينة PDF'")
    expect(reader).not.toContain("'نحمّل الصفحة الحالية أولًا من ملف PDF الأصلي.'")
  })

  it('never routes repeated standalone PDF scrolling back through page zero', () => {
    const mapped: number[] = []
    const map = (index: number): number => { mapped.push(index); return 0 }
    // محاكاة انتقال المراقب تباعًا إلى صفحات لاحقة: PDF المستقل لا يملك
    // سطح Word آخرًا كي يزامنه، ولذلك لا ينبغي استدعاء المحوّل أصلًا.
    expect([1, 2, 7, 12].map(index => pdfTextSyncIndex(true, index, map))).toEqual([
      undefined, undefined, undefined, undefined,
    ])
    expect(mapped).toEqual([])
    expect(pdfTextSyncIndex(false, 7, index => index + 3)).toBe(10)
  })

  it('keeps standalone forward and backward scrolling away from stale page-zero mappings', () => {
    const mapped: number[] = []
    const staleMapping = (index: number): number => { mapped.push(index); return 0 }
    let current = 1
    for (const observed of [2, 5, 9, 8, 4, 3]) {
      current = observed
      const target = pdfReaderEventSyncTarget(true, current, observed, staleMapping)
      expect(target).toBeUndefined()
      expect(current).toBe(observed)
    }
    expect(current).toBe(3)
    expect(mapped).toEqual([])

    expect(pdfReaderEventSyncTarget(false, 5, 8, index => index - 2)).toBe(6)
    expect(pdfReaderEventSyncTarget(false, 5, 7, index => index - 2)).toBeUndefined()
    expect(reader).toContain('if (!standalone) routeEventListener(window, READER_PAGE_EVENT, onReaderPage)')
  })

  it('repairs missing or white mobile canvases with bounded retries and resize recovery', () => {
    expect(reader).toContain('const missingInk = pdfCanvasNeedsRepair(slot)')
    expect(reader).toContain("routeEventListener(document, 'visibilitychange'")
    expect(reader).toContain("routeEventListener(window, 'resize', repairVisiblePages")
    expect(reader).toContain('pagesWithInk.has(index)')
    expect(reader).toContain('const maxCanvasPixels = 4_000_000')
    expect(reader).toContain('prunePdfCache(pageIndex)')
    expect(reader).toContain('if (!Number.isInteger(index)) continue')
    expect(reader).not.toContain('if (Math.abs(index - pageIndex) <= 2)')
    expect(reader).not.toContain('showNativePdfFallback(index + 1)')
    expect(reader).toContain("class: 'reader__pdf-native-frame'")
    expect(reader).toContain('const pdfRenderBytes = originalPdfBytes.slice()')
    expect(reader).toContain('useWasm: true')
    expect(reader).toContain('const softwarePdfDocument')
    expect(reader).toContain('useWasm: false')
  })

  it('keeps the site TOC authoritative when an old PDF needs the native viewer', () => {
    expect(reader).toContain('const goToNativePdfPage = (page: number): void =>')
    expect(reader).toContain("frame.src = `${blobUrl}#page=${target}&view=FitH`")
    expect(reader).toContain('enableTocNavigation([], nativeNavigation)')
    expect(reader).toContain('activePageNavigation = nativeNavigation')
  })

  it('uses an exact non-smooth anchor for PDF outline clicks on the first attempt', () => {
    expect(reader).toContain('goTo: index => setPage(index, true, false)')
    expect(reader).toContain('goToDisplayedPage: page => setPage(page - 1, true, false)')
    expect(reader).toContain('goToPdfDestination: (page, destination) =>')
    expect(reader).toContain('view.convertToViewportPoint(0, destination.top)[1]')
  })

  it('toggles the companion PDF closed on a second toolbar press', () => {
    expect(reader).toContain('() => togglePdfBesideBook(id, infoEl)')
    expect(reader).toContain("if (panel.classList.contains('reader__info--pdf'))")
    expect(reader).toContain('closePdfPreview(panel)')
    expect(reader).toContain('renderBookInfo(panel, stored)')
    expect(reader).toContain("routeEventListener(standalone ? viewport : window, 'scroll', renderViewportWindow")
    expect(reader).toContain('void renderPage(index)')
  })

  it('resolves a published identity before showing a missing-book state', () => {
    expect(reader).toContain('await ensurePublishedWorkSeeded(id)')
    expect(reader).toContain('storedReaderTitle(stored)')
    expect(reader).toContain('renderReaderInfoIdentity(infoEl, stored)')
    expect(reader).toContain("return file || 'كتاب محفوظ'")
  })
})
