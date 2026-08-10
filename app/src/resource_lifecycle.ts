export interface ResourceScope {
  readonly disposed: boolean
  add(cleanup: () => void): void
  dispose(): void
}

export type LiveResourceKind = 'observers' | 'animationFrames' | 'listeners' | 'objectUrls' | 'fontRegistrations' | 'backgroundJobs'
export type ResourceLifecycleSnapshot = Readonly<Record<LiveResourceKind, number>>

const liveResources: Record<LiveResourceKind, number> = {
  observers: 0,
  animationFrames: 0,
  listeners: 0,
  objectUrls: 0,
  fontRegistrations: 0,
  backgroundJobs: 0,
}

/** لقطة حتمية خفيفة تصلح للـQA ولا تحتفظ بمراجع إلى الموارد نفسها. */
export function resourceLifecycleSnapshot(): ResourceLifecycleSnapshot {
  return Object.freeze({ ...liveResources })
}

/** يسجل موردًا حيًا ويعيد محررًا idempotent؛ مفيد للموارد غير التابعة لمسار. */
export function trackLiveResource(kind: LiveResourceKind): () => void {
  liveResources[kind]++
  let released = false
  return () => {
    if (released) return
    released = true
    liveResources[kind] = Math.max(0, liveResources[kind] - 1)
  }
}

/** يملك المراقب للمسار الحالي ويضمن disconnect واحدًا مع إنقاص العداد. */
export function routeObserver<T extends { disconnect(): void }>(observer: T, scope = activeScope): T {
  const release = trackLiveResource('observers')
  const disconnect = observer.disconnect.bind(observer)
  observer.disconnect = (() => { disconnect(); release() }) as T['disconnect']
  scope.add(() => observer.disconnect())
  return observer
}

const liveObjectUrls = new Set<string>()

export function createTrackedObjectURL(value: Blob | MediaSource): string {
  const url = URL.createObjectURL(value)
  liveObjectUrls.add(url)
  liveResources.objectUrls++
  return url
}

export function revokeTrackedObjectURL(url: string): void {
  URL.revokeObjectURL(url)
  if (!liveObjectUrls.delete(url)) return
  liveResources.objectUrls = Math.max(0, liveResources.objectUrls - 1)
}

class RouteResourceScope implements ResourceScope {
  private cleanups = new Set<() => void>()
  disposed = false

  add(cleanup: () => void): void {
    if (this.disposed) { cleanup(); return }
    this.cleanups.add(cleanup)
  }

  dispose(): void {
    if (this.disposed) return
    this.disposed = true
    for (const cleanup of [...this.cleanups].reverse()) {
      try { cleanup() } catch { /* teardown must not prevent the next route */ }
    }
    this.cleanups.clear()
  }
}

let activeScope: ResourceScope = new RouteResourceScope()

export function beginRouteResourceScope(): ResourceScope {
  activeScope.dispose()
  activeScope = new RouteResourceScope()
  return activeScope
}

export function captureRouteResourceScope(): ResourceScope {
  return activeScope
}

export function routeTimeout(callback: () => void, delay: number, scope = activeScope): number {
  const id = globalThis.setTimeout(() => { if (!scope.disposed) callback() }, delay) as unknown as number
  scope.add(() => globalThis.clearTimeout(id))
  return id
}

/** A requestAnimationFrame whose callback cannot outlive the current route. */
export function routeAnimationFrame(callback: FrameRequestCallback, scope = activeScope): number {
  if (typeof globalThis.requestAnimationFrame !== 'function') return routeTimeout(() => callback(Date.now()), 0, scope)
  const release = trackLiveResource('animationFrames')
  const id = globalThis.requestAnimationFrame((time) => { release(); if (!scope.disposed) callback(time) })
  scope.add(() => { globalThis.cancelAnimationFrame(id); release() })
  return id
}

/** Register a global listener and make its removal part of the route transaction. */
export function routeEventListener(
  target: EventTarget,
  type: string,
  listener: EventListener,
  options?: boolean | AddEventListenerOptions,
  scope = activeScope,
): void {
  const release = trackLiveResource('listeners')
  target.addEventListener(type, listener, options)
  scope.add(() => { target.removeEventListener(type, listener, options); release() })
}
