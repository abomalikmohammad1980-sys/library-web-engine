const CACHE = 'alkhizana-shell-v19'
const FONT_ALIASES = {} // Populated from verified font bytes by the build.
const LARGE_CATALOG_PATH = '/data/shamela-authors.json'
const LIGHTWEIGHT_AUTHOR_INDEX_PATH = '/data/shamela-author-index.json'
const TARAJM_DATA_PREFIX = '/data/tarajm-'
const SHELL = ['./', './index.html', './manifest.webmanifest', './favicon-64.png', './brand-logo-color.png', './brand-logo-mono.png', './icons/apple-touch-icon.png', './icons/icon-192.png', './icons/icon-512.png', './icons/icon-maskable-192.png', './icons/icon-maskable-512.png', './data/author-supplement.json']

function localAssetUrls(text, baseUrl) {
  const found = new Set()
  const patterns = [/(?:src|href)=["']([^"'#]+)["']/g, /url\(\s*["']?([^"')]+)["']?\s*\)/g]
  for (const pattern of patterns) {
    for (const match of text.matchAll(pattern)) {
      try {
        const url = new URL(match[1], baseUrl)
        if (url.origin === self.location.origin && !url.pathname.startsWith('/api/')) found.add(url.href)
      } catch { /* ignore malformed optional assets */ }
    }
  }
  return [...found]
}

async function installShell() {
  const cache = await caches.open(CACHE)
  await cache.addAll(SHELL)
  const indexResponse = await cache.match('./index.html')
  if (!indexResponse) throw new Error('offline shell index is missing')
  const indexAssets = localAssetUrls(await indexResponse.clone().text(), indexResponse.url || new URL('./index.html', self.location.href).href)
  await cache.addAll(indexAssets)
  const cssAssets = []
  for (const asset of indexAssets.filter(url => new URL(url).pathname.endsWith('.css'))) {
    const response = await cache.match(asset)
    if (response) cssAssets.push(...localAssetUrls(await response.clone().text(), asset))
  }
  await cache.addAll([...new Set(cssAssets)])
}

function retain(event, key, response) {
  const copy = response.clone()
  event.waitUntil(caches.open(CACHE).then(cache => cache.put(key, copy)))
}

function isHtmlResponse(response) {
  return response.headers.get('content-type')?.toLowerCase().includes('text/html') === true
}

async function offlineShellResponse() {
  const cached = await caches.match('./index.html')
  if (!cached) return Response.error()
  // Pages redirects /index.html to /. Reload navigations use manual redirects
  // and reject a cached response whose redirected flag is true. Reconstruct
  // only the offline shell; live server redirects must keep their semantics.
  return cached.redirected
    ? new Response(cached.body, {status: cached.status, statusText: cached.statusText, headers: cached.headers})
    : cached
}

function isBuiltAssetRequest(request, url) {
  return url.pathname.startsWith('/assets/') || ['script', 'style', 'worker'].includes(request.destination)
}

let activationCheck
function clientAllowsUpdate(client) {
  return new Promise(resolve => {
    const channel = new MessageChannel()
    let finished = false
    const finish = allowed => { if(finished)return;finished=true;clearTimeout(timer);channel.port1.close();channel.port2.close();resolve(allowed) }
    const timer = setTimeout(() => finish(false), 750)
    channel.port1.onmessage = event => finish(event.data?.safe === true)
    try { client.postMessage({type:'khizana:check-safe-update'}, [channel.port2]) } catch { finish(false) }
  })
}
function activateWhenClientsSafe() {
  if(activationCheck)return activationCheck
  activationCheck = (async () => {
    if(!self.registration.active){await self.skipWaiting();return}
    const windows = await self.clients.matchAll({type:'window',includeUncontrolled:true})
    const relevant = windows.filter(client => client.url.startsWith(self.registration.scope))
    // Older clients cannot answer this protocol: keep the new worker waiting.
    // Their unsaved state is safer than forcing controllerchange/reload.
    const approvals = await Promise.all(relevant.map(clientAllowsUpdate))
    if(approvals.every(Boolean))await self.skipWaiting()
  })().finally(() => {activationCheck=undefined})
  return activationCheck
}
self.addEventListener('install', event => {
  event.waitUntil(installShell().then(activateWhenClientsSafe))
})
self.addEventListener('message', event => {
  if(event.data?.type === 'khizana:request-safe-activation')event.waitUntil(activateWhenClientsSafe())
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('alkhizana-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  const fontAlias = FONT_ALIASES[url.pathname]
  if (fontAlias) {
    const target = new URL(fontAlias, self.location.origin).href
    event.respondWith(caches.match(target).then(async cached => {
      if (cached && !isHtmlResponse(cached)) return cached
      const response = await fetch(target)
      if (response.ok && !isHtmlResponse(response)) retain(event, target, response)
      return response
    }))
    return
  }
  // Explicit recovery must reach the network, not return the same old Cache
  // Storage entry again. Keep ordinary offline book/shell fallback unchanged.
  if (request.cache === 'no-store' && url.pathname.startsWith('/library/')) {
    event.respondWith(fetch(request))
    return
  }
  const shellExcluded=/^\/(?:api|data|library|quran)\//.test(url.pathname)||/^\/(?:sitemap[^/]*|robots\.txt)$/.test(url.pathname)||/\.[a-z0-9]+$/i.test(url.pathname)&&url.pathname!=='/index.html'
  if (request.mode === 'navigate'&&!shellExcluded) {
    // Clean routes use the installed shell offline. Never cache author/book or
    // private server-rendered HTML as the common shell for another route/user.
    const shellPath=['/', '/index.html'].includes(url.pathname)
    // لا نسمح لـ HTTP cache أن يعيد قشرة إصدار سابق بعد تفعيل عامل جديد؛
    // هذا هو الفرق بين التحديث العادي وShift+Refresh. يقتصر reload على
    // تنقل HTML، أما الأصول ذات البصمة فتبقى immutable وكفؤة.
    const freshNavigation = new Request(request, { cache: 'reload' })
    event.respondWith(fetch(freshNavigation).then(response => { if (response.ok&&shellPath) retain(event, './index.html', response); return response }).catch(offlineShellResponse))
    return
  }
  // The complete author catalog is about 25 MB. Never block installation by
  // precaching it and never keep serving an old cache-first copy forever.
  // A successful response is retained only as an offline fallback.
  // المكتبة المنشورة إصدار مركزي حي. لا يجوز أن يحجب cache-first بيانًا
  // جديدًا أو PDF أضيف في نشر لاحق؛ الشبكة هي الأصل والكاش fallback offline.
  // v2 postings/snippets are multi-megabyte streaming responses. Cloning each
  // response into Cache Storage applies back-pressure to the visible search
  // (especially in Chromium) and caused the UI timeout even though the server
  // returned the same files in milliseconds. Rely on the HTTP cache and retain
  // any old cache entry only as an offline fallback.
  if (url.pathname.startsWith('/library/shamela-search-v2/')) {
    event.respondWith(fetch(request).catch(() => caches.match(request).then(cached => cached || Response.error())))
    return
  }
  // The heading bootstrap is latency-sensitive. On long-lived origins,
  // CacheStorage lookup before the network can exceed the client's timeout
  // even when this small release descriptor is served quickly by Pages.
  if (url.pathname === '/data/heading-release.json') {
    event.respondWith(fetch(request).catch(() => caches.match(request).then(cached => cached || Response.error())))
    return
  }
  if (url.pathname.endsWith(LARGE_CATALOG_PATH) || url.pathname.endsWith(LIGHTWEIGHT_AUTHOR_INDEX_PATH) || url.pathname.startsWith(TARAJM_DATA_PREFIX) || url.pathname.startsWith('/quran/') || url.pathname.startsWith('/library/published/') || url.pathname.startsWith('/library/shamela/') || url.pathname.startsWith('/library/shamela-search/')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok && !response.headers.get('content-type')?.toLowerCase().includes('text/html')) retain(event, request, response)
      return response
    }).catch(() => caches.match(request).then(cached => cached || Response.error())))
    return
  }
  event.respondWith(caches.match(request).then(async cached => {
    // أثناء انتشار نشر جديد قد تعيد استضافة SPA صفحة index.html مؤقتًا لطلب
    // chunk لم يصل بعد. تخزين HTML تحت عنوان JavaScript يسمّم الهاتف حتى
    // التحديث الإجباري. تجاهل أي نسخة مسمومة قديمة، ولا تحتفظ ببديل HTML
    // للأصول المبنية مطلقًا.
    const builtAsset = isBuiltAssetRequest(request, url)
    if (cached && (!builtAsset || !isHtmlResponse(cached))) return cached
    if (cached && builtAsset) event.waitUntil(caches.open(CACHE).then(cache => cache.delete(request)))
    const response = await fetch(request)
    if (response.ok && (!builtAsset || !isHtmlResponse(response))) retain(event, request, response)
    return response
  }))
})
