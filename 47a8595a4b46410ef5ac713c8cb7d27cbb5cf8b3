const CACHE = 'alkhizana-shell-v8'
const LARGE_CATALOG_PATH = '/data/shamela-authors.json'
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

self.addEventListener('install', event => {
  event.waitUntil(installShell().then(() => self.skipWaiting()))
})

self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('alkhizana-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()))
})

self.addEventListener('fetch', event => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(response => { if (response.ok) retain(event, './index.html', response); return response }).catch(() => caches.match('./index.html')))
    return
  }
  // The complete author catalog is about 25 MB. Never block installation by
  // precaching it and never keep serving an old cache-first copy forever.
  // A successful response is retained only as an offline fallback.
  // المكتبة المنشورة إصدار مركزي حي. لا يجوز أن يحجب cache-first بيانًا
  // جديدًا أو PDF أضيف في نشر لاحق؛ الشبكة هي الأصل والكاش fallback offline.
  if (url.pathname.endsWith(LARGE_CATALOG_PATH) || url.pathname.startsWith('/quran/') || url.pathname.startsWith('/library/published/')) {
    event.respondWith(fetch(request).then(response => {
      if (response.ok) retain(event, request, response)
      return response
    }).catch(() => caches.match(request).then(cached => cached || Response.error())))
    return
  }
  event.respondWith(caches.match(request).then(cached => cached || fetch(request).then(response => {
    if (response.ok) retain(event, request, response)
    return response
  })))
})
