import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./screens/reader.ts', import.meta.url), 'utf8')
const domSource = readFileSync(new URL('./engine/dom_render.ts', import.meta.url), 'utf8')

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

  it('bounds the instant-reopen page cache with LRU eviction', () => {
    expect(source).toContain('const FIRST_PAGE_CACHE_LIMIT = 8')
    expect(source).toContain('new ReaderPreviewCache<HTMLElement>(FIRST_PAGE_CACHE_LIMIT)')
  })

  it('makes the first usable Word page paint before full pagination', () => {
    const preview = source.indexOf('const preview = renderBookPreviewPage')
    const firstPaint = source.indexOf('await nextPaint()', preview)
    const fullLayout = source.indexOf('await renderBookToPages', preview)
    expect(preview).toBeGreaterThan(-1)
    expect(firstPaint).toBeGreaterThan(preview)
    expect(fullLayout).toBeGreaterThan(firstPaint)
  })

  it('releases Word image blob URLs with the route and never caches a revoked preview', () => {
    expect(source).toContain('resourceScope.add(() => releaseRenderedPageAssets([preview]))')
    expect(source).toContain('resourceScope.add(() => releaseRenderedPageAssets(partPages))')
    expect(source).toContain('page.querySelector(\'img[src^="blob:"]\')')
    expect(domSource).toContain('releaseProbeAssets?.()')
  })
})
