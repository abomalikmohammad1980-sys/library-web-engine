import { captureRouteResourceScope, routeObserver, type ResourceScope } from './resource_lifecycle'

/** Defer optional below-the-fold data, without removing the section or its links. */
export function whenNearViewport(element: HTMLElement, run: () => void, scope: ResourceScope = captureRouteResourceScope()): void {
  if (scope.disposed) return
  if (typeof IntersectionObserver === 'undefined') {
    queueMicrotask(() => { if (!scope.disposed) run() })
    return
  }
  let started = false
  const observer = routeObserver(new IntersectionObserver(entries => {
    if (started || scope.disposed || !entries.some(entry => entry.isIntersecting)) return
    started = true
    observer.disconnect()
    run()
  }, { rootMargin: '400px' }), scope)
  observer.observe(element)
}
