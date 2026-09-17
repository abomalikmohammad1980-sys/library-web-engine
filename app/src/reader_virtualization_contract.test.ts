import { describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

vi.hoisted(() => {
  vi.stubGlobal('document', { addEventListener: (): void => undefined })
})

import { mountReaderPageWindow } from './screens/reader'

const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const domSource = readFileSync(new URL('./engine/dom_render.ts', import.meta.url), 'utf8')
const diwanPageMap = JSON.parse(readFileSync(new URL('../public/library/published/assets/f21266f0bba8d2d9.word-page-map.json', import.meta.url), 'utf8'))

describe('large reader DOM lifecycle', () => {
  it('keeps a bounded window of fitted pages mounted', () => {
    expect(source).toContain('const unmount = (index: number)')
    expect(source).toContain('Math.abs(index - center) > 4')
    expect(source).toContain('wrap.removeChild(page)')
    expect(source).toContain("slot.dataset.mounted = 'false'")
  })

  it('releases page observers before a detached page can be remounted', () => {
    expect(source).toContain('mountedCleanup[index]')
    expect(source).toContain('for (const cleanup of mountedCleanup[index] ?? []) cleanup()')
    expect(source).toContain('resourceScope.add')
  })

  it('retains lazy intersection mounting instead of cloning every page', () => {
    expect(source).toContain("rootMargin: '1400px 0px'")
    expect(source).not.toContain('page.cloneNode(true)')
  })

  it('keeps observing slots after unmount so backward scrolling remounts every page', () => {
    expect(source).toContain("slot.dataset.mounted = 'false'")
    expect(source).toContain('mount(index)')
    expect(source).not.toContain('lazyObserver?.unobserve(entry.target)')
  })

  it('mounts the visible page and its neighbours even when its lazy notification is delayed', () => {
    expect(source).toContain('const mountVisibleWindow = (index: number): void =>')
    expect(source).toContain('mountVisibleWindow(index)')
    expect(source).toContain('mountVisibleWindow(safe)')
  })

  it('remounts a detached backward window and clips neighbours at book edges', () => {
    const mounted = new Set<number>()
    const mount = (index: number): void => { mounted.add(index) }
    mountReaderPageWindow(60, 42, mount)
    expect([...mounted]).toEqual([38, 39, 40, 41, 42, 43, 44, 45, 46])
    mounted.clear()
    // محاكاة الرجوع بعيدًا بعد فك الصفحات القديمة: لا تعتمد النافذة على
    // اتجاه الحركة ولا على بقاء الصفحة مركبة من المرور الأول.
    mountReaderPageWindow(60, 8, mount)
    expect([...mounted]).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12])
    mounted.clear()
    mountReaderPageWindow(60, 0, mount)
    expect([...mounted]).toEqual([0, 1, 2, 3, 4])
    mounted.clear()
    mountReaderPageWindow(60, 59, mount)
    expect([...mounted]).toEqual([55, 56, 57, 58, 59])
  })

  it('retains the sparse text authored on displayed page 27 of Sayyid Qutb diwan', () => {
    const page = diwanPageMap.pages.find((candidate: { adjustedPage: number }) => candidate.adjustedPage === 27)
    const text = diwanPageMap.paragraphs
      .filter((paragraph: { adjustedPage: number }) => paragraph.adjustedPage === 27)
      .map((paragraph: { text: string }) => paragraph.text.replace(/^\u000e/u, ''))
      .filter(Boolean)
    expect(page).toMatchObject({ physicalPage: 29, firstParagraphIndex: 1096, lastParagraphIndex: 1098 })
    expect(text).toEqual([
      'عبد الباقي محمد حسین تهامي',
      '«باريس في يوم الجمعة/18/من المحرم/1408 هـ، 11/من سبتمبر/۱۹۸۷ م»',
      'مقدمة الديوان',
    ])
  })

  it('bounds the instant-reopen page cache with LRU eviction', () => {
    expect(source).toContain('const FIRST_PAGE_CACHE_LIMIT = 8')
    expect(source).toContain('new ReaderPreviewCache<HTMLElement>(FIRST_PAGE_CACHE_LIMIT)')
  })

  it('makes the first usable Word page paint before streaming pagination', () => {
    const preview = source.indexOf('const preview = renderBookPreviewPage')
    const firstPaint = source.indexOf('await nextPaint()', preview)
    const stream = source.indexOf('for await (const page of streamBookPages', preview)
    expect(preview).toBeGreaterThan(-1)
    expect(firstPaint).toBeGreaterThan(preview)
    expect(stream).toBeGreaterThan(firstPaint)
  })

  it('makes the first eight pages navigable before full-book measured pagination', () => {
    const leading = source.indexOf('await renderBookLeadingPages')
    const progressiveNavigation = source.indexOf('renderDomPages(live, leading', leading)
    const idle = source.indexOf('await readerIdleTurn', progressiveNavigation)
    const stream = source.indexOf('for await (const page of streamBookPages', idle)
    expect(leading).toBeGreaterThan(-1)
    expect(progressiveNavigation).toBeGreaterThan(leading)
    expect(idle).toBeGreaterThan(progressiveNavigation)
    expect(stream).toBeGreaterThan(idle)
    expect(source).toContain('renderBookLeadingPages(loadedBooks[0]!.model, 8,')
  })

  it('appends page four before the async producer completes the book', () => {
    const producer = source.indexOf('for await (const page of streamBookPages')
    const append = source.indexOf('nav.appendPages?.([page])', producer)
    const finish = source.indexOf('nav.finish?.(pages.length)', append)
    expect(producer).toBeGreaterThan(-1)
    expect(append).toBeGreaterThan(producer)
    expect(finish).toBeGreaterThan(append)
    expect(domSource).toContain('export async function* streamBookPages')
    expect(domSource).toContain('leadingPaginationCache.get(model)')
    expect(domSource).toContain('skip === cached.ready.length')
  })

  it('never presents the three leading pages as the total book size', () => {
    expect(source).toContain('readerPositionText(1, progressiveUnknownTotal ? undefined')
    expect(source).toContain('readerPositionText(sheet?.current??current, sheet?.total??total, percent)')
    expect(source).toContain('progressiveUnknownTotal ? 0 : pages.length')
    expect(source).not.toContain('`صفحة ١ من ${arabicNum(pages.length)}`')
  })

  it('cancels Word measurement with the reader route', () => {
    expect(source).toContain('const pagination = new AbortController()')
    expect(source).toContain('resourceScope.add(() => pagination.abort())')
    expect(source).toContain('pagination.signal')
    expect(domSource).toContain('throwIfCancelled(signal)')
  })

  it('measures one candidate page at a time instead of rendering every page for 24 passes', () => {
    expect(domSource).toContain('const splitAt = await measuredGroupSplit(model, group, signal)')
    expect(domSource).not.toContain('for (let pass = 0; pass < 24; pass++)')
    expect(domSource).toContain('if (groups.length % 4 === 0) await paginationIdleTurn(signal)')
  })

  it('releases Word image blob URLs with the route and never caches a revoked preview', () => {
    expect(source).toContain('resourceScope.add(() => releaseRenderedPageAssets([preview]))')
    expect(source).toContain('resourceScope.add(() => releaseRenderedPageAssets([page]))')
    expect(source).toContain('page.querySelector(\'img[src^="blob:"]\')')
    expect(domSource).toContain('release?.()')
  })
})
