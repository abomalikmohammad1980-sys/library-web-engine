import {afterEach, beforeEach, expect, it, vi} from 'vitest'
import {readerLoadingPaper} from './reader_loading'
import {beginRouteResourceScope} from './resource_lifecycle'

class Element {
  className = ''; textContent = ''; hidden = false; isConnected = false
  children: Element[] = []; attrs: Record<string, string> = {}
  append(...children: Element[]) { this.children.push(...children) }
  setAttribute(key: string, value: string) { this.attrs[key] = value }
}
let notify: () => void, disconnect: ReturnType<typeof vi.fn>
beforeEach(() => {
  vi.useFakeTimers()
  disconnect = vi.fn()
  vi.stubGlobal('document', {createElement: () => new Element(), documentElement: new Element()})
  vi.stubGlobal('MutationObserver', class {
    constructor(callback: () => void) { notify = callback }
    observe() {}
    disconnect() { disconnect() }
  })
})
afterEach(() => { beginRouteResourceScope(); vi.useRealTimers(); vi.unstubAllGlobals() })

it('shows accessible real loading text immediately, with no fabricated percentage', () => {
  const paper = readerLoadingPaper(beginRouteResourceScope()) as unknown as Element
  const status = paper.children[0]
  expect(status.attrs.role).toBe('status')
  expect(status.children[0].className).toBe('reading__progress-label')
  expect(status.children[0].textContent).toBe('جارٍ فتح الكتاب…')
  expect(status.children[1].hidden).toBe(true)
  expect(JSON.stringify(paper)).not.toContain('%')
})
it('explains a prolonged load only after six seconds and releases its observer', () => {
  const paper = readerLoadingPaper(beginRouteResourceScope()) as unknown as Element
  paper.isConnected = true; notify()
  vi.advanceTimersByTime(5999)
  expect(paper.children[0].children[1].hidden).toBe(true)
  vi.advanceTimersByTime(1)
  expect(paper.children[0].children[1].hidden).toBe(false)
  expect(disconnect).toHaveBeenCalledTimes(1)
  expect(vi.getTimerCount()).toBe(0)
})
it('cancels delayed status when text or an error replaces the surface', () => {
  const paper = readerLoadingPaper(beginRouteResourceScope()) as unknown as Element
  paper.isConnected = true; notify()
  paper.isConnected = false; notify()
  expect(vi.getTimerCount()).toBe(0)
  expect(disconnect).toHaveBeenCalledTimes(1)
  vi.advanceTimersByTime(6000)
  expect(paper.children[0].children[1].hidden).toBe(true)
})
it('route disposal cleans up even when the loading surface was never attached', () => {
  const scope = beginRouteResourceScope()
  readerLoadingPaper(scope)
  scope.dispose()
  expect(vi.getTimerCount()).toBe(0)
  expect(disconnect).toHaveBeenCalledTimes(1)
})
