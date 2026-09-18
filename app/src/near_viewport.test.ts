import { afterEach, expect, it, vi } from 'vitest'
import { whenNearViewport } from './near_viewport'
import { beginRouteResourceScope } from './resource_lifecycle'
afterEach(() => { beginRouteResourceScope(); vi.unstubAllGlobals() })

it('loads an optional section once only when approaching it', () => {
  let notify: (entries: { isIntersecting: boolean }[]) => void = () => {}
  const disconnect = vi.fn(), observe = vi.fn(), run = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: typeof notify) { notify = callback }
    disconnect = disconnect; observe = observe
  })
  whenNearViewport({} as HTMLElement, run)
  notify([{ isIntersecting: false }]); expect(run).not.toHaveBeenCalled()
  notify([{ isIntersecting: true }]); notify([{ isIntersecting: true }])
  expect(run).toHaveBeenCalledOnce(); expect(disconnect).toHaveBeenCalledOnce()
})

it('does not start old-page work after navigation', () => {
  let notify: () => void = () => {}
  const run = vi.fn()
  vi.stubGlobal('IntersectionObserver', class {
    constructor(callback: (entries: { isIntersecting: boolean }[]) => void) { notify = () => callback([{ isIntersecting: true }]) }
    disconnect() {}; observe() {}
  })
  whenNearViewport({} as HTMLElement, run)
  beginRouteResourceScope(); notify(); expect(run).not.toHaveBeenCalled()
})

it('retains the section on browsers without visibility observation', async () => {
  vi.stubGlobal('IntersectionObserver', undefined)
  const run = vi.fn(); whenNearViewport({} as HTMLElement, run)
  await Promise.resolve(); expect(run).toHaveBeenCalledOnce()
})
