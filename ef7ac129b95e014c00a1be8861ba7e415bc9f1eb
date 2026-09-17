import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const reader = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const intake = readFileSync(new URL('./book_import.ts', import.meta.url), 'utf8')
const pdfDraft = readFileSync(new URL('./pdf_import_draft.ts', import.meta.url), 'utf8')
const styles = readFileSync(new URL('./styles/components.css', import.meta.url), 'utf8')

describe('PDF reader and cover lifecycle', () => {
  it('renders the current page before asynchronous outline and bounds canvas cache', () => {
    expect(reader.indexOf('await renderPage(pageIndex)')).toBeLessThan(reader.indexOf('void extractPdfOutline(pdfDocument).then'))
    expect(reader).toContain('Math.abs(index - center) <= 2')
    expect(reader).toContain('renderTasks.get(index)?.cancel()')
    expect(reader).toContain('for (const task of renderTasks.values()) task.cancel()')
  })

  it('centers PDF pages and keeps the explanatory note after the viewport', () => {
    expect(styles).toContain('place-items: center')
    expect(reader).toContain('content.replaceChildren(controls, viewport, h(\'div\', { class: \'reader__pdf-source-note\'')
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
    expect(reader).toContain("standalone ? 'جارٍ فتح كتاب PDF'")
  })

  it('repairs missing or white mobile canvases with bounded retries and resize recovery', () => {
    expect(reader).toContain('const missingInk = pdfCanvasNeedsRepair(slot)')
    expect(reader).toContain("routeEventListener(document, 'visibilitychange'")
    expect(reader).toContain("routeEventListener(window, 'resize', repairVisiblePages")
    expect(reader).toContain('pagesWithInk.has(index)')
    expect(reader).toContain('const maxCanvasPixels = 4_000_000')
    expect(reader).toContain('prunePdfCache(pageIndex)')
  })

  it('resolves a published identity before showing a missing-book state', () => {
    expect(reader).toContain('await ensurePublishedWorkSeeded(id)')
    expect(reader).toContain('storedReaderTitle(stored)')
    expect(reader).toContain('renderReaderInfoIdentity(infoEl, stored)')
    expect(reader).toContain("return file || 'كتاب محفوظ'")
  })
})
