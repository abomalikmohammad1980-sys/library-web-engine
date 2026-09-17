import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {renderBoundUiTemplate} from './ui_template_binding'

const source = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8')

describe('reader return bar shell contract', () => {
  it('keeps the global header before the return journey on ordinary pages', () => {
    const shell = source('./shell.ts')
    const header = shell.indexOf('frame.appendChild(appHeader(currentHash))')
    const returnPoint = shell.indexOf('const returnBar = readerReturnBar()')
    const main = shell.indexOf("class: 'app-main'")
    expect(header).toBeGreaterThan(-1)
    expect(returnPoint).toBeGreaterThan(header)
    expect(main).toBeGreaterThan(returnPoint)
  })

  it('decodes the encoded return identifier before resolving the reader route', () => {
    const router = source('./router.ts')
    expect(router).toContain('const decoded=decodeRouteParam(second),shamelaCanonical=canonicalShamelaBookId(decoded)')
  })

  it('keeps a keyboard-focusable deep link with an exact accessible destination beside the dismiss button', () => {
    const bar = source('./reader_return_bar.ts')
    expect(bar).toContain("const link=h('a', {")
    expect(bar).toContain("href: readerReturnHref(point)")
    expect(bar).toContain("uiTemplateAttribute(link,'aria-label','5ba22c8c112e844a',{p1:point.title,p2:point.pageIndex+1})")
    expect(renderBoundUiTemplate('5ba22c8c112e844a',{p1:'كتاب الاختبار',p2:12},'ar')).toContain('كتاب الاختبار')
    expect(bar).toContain("'aria-label':'إخفاء شريط العودة للقراءة'")
    expect(bar).not.toContain("tabindex: '-1'")
  })

  it('retains a 44px target, visible keyboard focus, truncation, and a mobile rule', () => {
    const css = source('./styles/components.css')
    const start = css.indexOf('.return-bar {')
    const end = css.indexOf('/* ================= Responsive', start)
    const contract = css.slice(start, end)
    expect(contract).toMatch(/min-height:\s*44px/)
    expect(contract).toContain('.return-bar:focus-visible')
    expect(contract).toContain('text-overflow: ellipsis')
    expect(contract).toMatch(/@media \(max-width:\s*640px\)/)
  })
})
