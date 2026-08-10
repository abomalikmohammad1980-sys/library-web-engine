import { beforeEach, describe, expect, it, vi } from 'vitest'
import { beginRouteResourceScope, captureRouteResourceScope, createTrackedObjectURL, resourceLifecycleSnapshot, revokeTrackedObjectURL, routeAnimationFrame, routeEventListener, routeObserver, routeTimeout, trackLiveResource } from './resource_lifecycle'
import { startBookArtifactRefresh, CURRENT_CONVERSION_ARTIFACT_VERSION } from './conversion_artifact_version'
import { ReaderPreviewCache } from './reader_preview_cache'

describe('phase 7 resource lifecycle gate', () => {
  beforeEach(() => { beginRouteResourceScope(); vi.useRealTimers() })

  it('disposes every route resource once in reverse mount order across repeated navigation', () => {
    const calls: string[] = []
    const scope = captureRouteResourceScope()
    scope.add(() => calls.push('observer'))
    scope.add(() => calls.push('listener'))
    beginRouteResourceScope(); beginRouteResourceScope()
    expect(calls).toEqual(['listener', 'observer'])
    expect(scope.disposed).toBe(true)
  })

  it('cancels timers and immediately cleans resources registered after unmount', () => {
    vi.useFakeTimers()
    const callback = vi.fn(), lateCleanup = vi.fn()
    const scope = captureRouteResourceScope()
    routeTimeout(callback, 50, scope)
    beginRouteResourceScope()
    scope.add(lateCleanup)
    vi.runAllTimers()
    expect(callback).not.toHaveBeenCalled()
    expect(lateCleanup).toHaveBeenCalledOnce()
  })

  it('cancels scheduled animation frames when a route is replaced', () => {
    const callback = vi.fn()
    const request = vi.fn(() => 73), cancel = vi.fn()
    vi.stubGlobal('requestAnimationFrame', request)
    vi.stubGlobal('cancelAnimationFrame', cancel)
    routeAnimationFrame(callback)
    beginRouteResourceScope()
    expect(request).toHaveBeenCalledOnce()
    expect(cancel).toHaveBeenCalledWith(73)
    expect(callback).not.toHaveBeenCalled()
    vi.unstubAllGlobals()
  })

  it('removes global listeners exactly when the owning route ends', () => {
    const target = new EventTarget(), callback = vi.fn()
    routeEventListener(target, 'library-changed', callback)
    target.dispatchEvent(new Event('library-changed'))
    expect(callback).toHaveBeenCalledOnce()
    beginRouteResourceScope()
    target.dispatchEvent(new Event('library-changed'))
    expect(callback).toHaveBeenCalledOnce()
  })

  it('deduplicates a reader background rebuild and permits one new job only after completion', async () => {
    let resolve!: () => void
    const slow = new Promise<void>(done => { resolve = done })
    const adapter = {
      markAttempt: vi.fn(async () => undefined),
      rebuild: vi.fn(async () => { await slow; return { id: 'book' } }),
      markCurrent: vi.fn(async (id: string, version: string) => ({ id, conversionArtifactVersion: version })),
      markFailure: vi.fn(async () => undefined),
    }
    const legacy = { id: 'book' }
    const first = startBookArtifactRefresh(legacy, adapter)
    const reopened = startBookArtifactRefresh(legacy, adapter)
    expect(first.started).toBe(true); expect(reopened.started).toBe(false)
    expect(reopened.completion).toBe(first.completion)
    resolve(); await first.completion
    expect(adapter.rebuild).toHaveBeenCalledOnce()
    const current = { id: 'book', conversionArtifactVersion: CURRENT_CONVERSION_ARTIFACT_VERSION }
    expect(startBookArtifactRefresh(current, adapter).started).toBe(false)
  })

  it('returns every live-resource counter to its warmed baseline after 20 reader-library cycles', () => {
    const frames = new Map<number, FrameRequestCallback>()
    let frameId = 0, objectId = 0
    vi.stubGlobal('requestAnimationFrame', vi.fn((callback: FrameRequestCallback) => {
      const id = ++frameId; frames.set(id, callback); return id
    }))
    vi.stubGlobal('cancelAnimationFrame', vi.fn((id: number) => { frames.delete(id) }))
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => `blob:lifecycle-${++objectId}`),
      revokeObjectURL: vi.fn(),
    })
    const observers: TestObserver[] = []
    class TestObserver {
      readonly baseDisconnect = vi.fn()
      disconnect = this.baseDisconnect
      constructor() { observers.push(this) }
    }

    // تسجيل الخط ذاكرة مخدومة دائمة مقصودة؛ نسخ baseline بعد warm-up يثبت
    // أن reopen لا يضاعفها، ثم نحرر fixture في نهاية الاختبار.
    const releaseWarmFont = trackLiveResource('fontRegistrations')
    const baseline = resourceLifecycleSnapshot()
    const target = new EventTarget()
    const previews = new ReaderPreviewCache<{ book: string }>(8)

    for (let cycle = 0; cycle < 20; cycle++) {
      const reader = beginRouteResourceScope()
      routeObserver(new TestObserver(), reader)
      routeObserver(new TestObserver(), reader)
      routeEventListener(target, 'reader-page', vi.fn(), undefined, reader)
      const frame = routeAnimationFrame(vi.fn(), reader)
      frames.get(frame)?.(cycle)
      frames.delete(frame)
      const url = createTrackedObjectURL(new Blob([String(cycle)]))
      previews.set(`large-book-${cycle}`, { book: `large-book-${cycle}` })
      const releaseJob = trackLiveResource('backgroundJobs')
      revokeTrackedObjectURL(url); releaseJob()

      const library = beginRouteResourceScope()
      routeObserver(new TestObserver(), library)
      routeEventListener(target, 'library-changed', vi.fn(), undefined, library)
      routeAnimationFrame(vi.fn(), library)
    }
    beginRouteResourceScope()
    expect(resourceLifecycleSnapshot()).toEqual(baseline)
    expect(frames.size).toBe(0)
    expect(previews.size).toBe(8)
    expect(previews.get('large-book-0')).toBeUndefined()
    expect(previews.get('large-book-19')).toEqual({ book: 'large-book-19' })
    expect(URL.createObjectURL).toHaveBeenCalledTimes(20)
    expect(URL.revokeObjectURL).toHaveBeenCalledTimes(20)
    expect(observers.every(observer => observer.baseDisconnect.mock.calls.length === 1)).toBe(true)
    // The one intentionally persistent registered font remains exactly at the
    // warmed baseline; reopen cycles must not add registrations.
    expect(resourceLifecycleSnapshot().fontRegistrations).toBe(1)
    releaseWarmFont()
    vi.unstubAllGlobals()
  })
})
