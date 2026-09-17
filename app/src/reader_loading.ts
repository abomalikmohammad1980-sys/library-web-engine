import {captureRouteResourceScope, type ResourceScope} from './resource_lifecycle'

/** Lightweight enough for the initial route, before importing the reader engine. */
export function readerLoadingPaper(scope: ResourceScope = captureRouteResourceScope()): HTMLElement {
  const paper = document.createElement('div')
  paper.className = 'reader-route-loading__paper reader-loading'
  const status = document.createElement('div')
  status.className = 'reader-loading__status'
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const label = document.createElement('p')
  label.className = 'reading__progress-label'
  label.textContent = 'جارٍ فتح الكتاب…'
  const slow = document.createElement('p')
  slow.className = 'reader-loading__slow'
  slow.textContent = 'قد يستغرق جلب الكتاب وتجهيزه وقتًا أطول مع الاتصال البطيء. سيظهر النص فور جاهزيته.'
  slow.hidden = true
  status.append(label, slow)
  const lines = document.createElement('div')
  lines.className = 'reader-loading__lines'
  lines.setAttribute('aria-hidden', 'true')
  for (let i = 0; i < 7; i++) lines.append(document.createElement('span'))
  paper.append(status, lines)
  let connected = false
  let stopped = false
  const stop = () => {
    if (stopped) return
    stopped = true
    globalThis.clearTimeout(timer)
    observer.disconnect()
  }
  // Stop immediately when preview/text/error replaces the loading surface, not
  // merely on route exit. The observer never retains a completed reader view.
  const observer = new MutationObserver(() => {
    if (paper.isConnected) connected = true
    else if (connected) stop()
  })
  const timer = globalThis.setTimeout(() => {
    if (!scope.disposed && paper.isConnected) slow.hidden = false
    stop()
  }, 6000)
  observer.observe(document.documentElement, {childList: true, subtree: true})
  scope.add(stop)
  return paper
}
