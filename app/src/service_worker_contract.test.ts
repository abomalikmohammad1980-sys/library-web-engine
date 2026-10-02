import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const bootstrap = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')
const pagesPreparation = readFileSync(resolve(import.meta.dirname, '../../deployment/cloudflare/scripts/prepare-cloudflare-pages.mjs'), 'utf8')

describe('service worker offline shell contract', () => {
  it('versions the cache and atomically installs declared and built assets', () => {
    expect(source).toMatch(/alkhizana-shell-v\d+/)
    expect(source).toContain("'./brand-logo-color.png'")
    expect(source).toContain("'./brand-logo-mono.png'")
    expect(source).toContain("'./icons/icon-512.png'")
    expect(source).toContain("'./icons/icon-maskable-512.png'")
    expect(source).toContain('await cache.addAll(SHELL)')
    expect(source).toContain('localAssetUrls(await indexResponse.clone().text()')
    expect(source).toContain("endsWith('.css')")
    expect(source).toContain('await cache.addAll([...new Set(cssAssets)])')
  })

  it('keeps the large author catalog out of precache and refreshes it network-first', () => {
    const shellDeclaration = source.match(/const SHELL = \[(.*?)\]/s)?.[1] ?? ''
    expect(shellDeclaration).not.toContain('shamela-authors.json')
    expect(source).toContain("const LARGE_CATALOG_PATH = '/data/shamela-authors.json'")
    expect(source).toContain('url.pathname.endsWith(LARGE_CATALOG_PATH)')
    expect(source).toContain('cached || Response.error()')
  })

  it('refreshes audited Tarajm bundles before falling back to an offline copy', () => {
    expect(source).toContain("const TARAJM_DATA_PREFIX = '/data/tarajm-'")
    expect(source).toContain('url.pathname.startsWith(TARAJM_DATA_PREFIX)')
    expect(source).toMatch(/startsWith\(TARAJM_DATA_PREFIX\)[\s\S]*fetch\(request\)[\s\S]*caches\.match\(request\)/)
  })

  it('refreshes the centrally published library before falling back offline', () => {
    expect(source).toContain("url.pathname.startsWith('/library/published/')")
    expect(source).toMatch(/startsWith\('\/library\/published\/'\)[\s\S]*fetch\(request\)[\s\S]*caches\.match\(request\)/)
  })

  it('refreshes Shamela catalogs, manifests and book packs before falling back offline', () => {
    expect(source).toContain("url.pathname.startsWith('/library/shamela/')")
    expect(source).toMatch(/startsWith\('\/library\/shamela\/'\)[\s\S]*fetch\(request\)[\s\S]*caches\.match\(request\)/)
  })

  it('refreshes both search index generations and never retains an HTML fallback as data',()=>{
    expect(source).toContain("url.pathname.startsWith('/library/shamela-search/')")
    expect(source).toContain("url.pathname.startsWith('/library/shamela-search-v2/')")
    expect(source).toContain("!response.headers.get('content-type')?.toLowerCase().includes('text/html')")
    const v2Branch=source.slice(source.indexOf("if (url.pathname.startsWith('/library/shamela-search-v2/'))"),source.indexOf("if (url.pathname.endsWith(LARGE_CATALOG_PATH)"))
    expect(v2Branch).not.toContain('retain(')
    expect(v2Branch).toContain('fetch(request).catch(')
  })

  it('keeps navigation fallback, API exclusion, activation cleanup, and immediate update', () => {
    expect(source).toContain("url.pathname.startsWith('/api/')")
    expect(source).toContain("caches.match('./index.html')")
    expect(source).toContain("keys.filter(key => key.startsWith('alkhizana-shell-') && key !== CACHE)")
    expect(source).toContain('self.skipWaiting()')
    expect(source).toContain('self.clients.claim()')
    expect(source).toContain("new Request(request, { cache: 'reload' })")
    expect(source).toContain('fetch(freshNavigation)')
    const updater=readFileSync(new URL('./service_worker_update.ts',import.meta.url),'utf8')
    expect(bootstrap).toContain('registerServiceWorkerUpdate(navigator.serviceWorker)')
    expect(updater).toContain("updateViaCache: 'none'")
    expect(updater).toContain('registration.update()')
    expect(bootstrap).toContain('import.meta.env.DEV')
    expect(bootstrap).toContain('navigator.serviceWorker.getRegistrations()')
    expect(bootstrap).toContain("key.startsWith('alkhizana-')")
    expect(source).toContain("LIGHTWEIGHT_AUTHOR_INDEX_PATH = '/data/shamela-author-index.json'")
    expect(bootstrap).toContain("'alkhizana:dev-sw-cleaned'")
  })

  it('forces phones to revalidate the worker and shell while keeping hashed assets immutable', () => {
    expect(pagesPreparation).toContain('/sw.js')
    expect(pagesPreparation).toContain('Cache-Control: no-store, max-age=0, must-revalidate')
    expect(pagesPreparation).toContain('/index.html')
    expect(pagesPreparation).toContain('Cache-Control: no-cache, max-age=0, must-revalidate')
    expect(pagesPreparation).toContain('/assets/*')
    expect(pagesPreparation).toContain('Cache-Control: public, max-age=31536000, immutable')
  })

  it('never serves or retains an HTML fallback as a built JavaScript, CSS, or worker asset', () => {
    expect(source).toContain("url.pathname.startsWith('/assets/')")
    expect(source).toContain("['script', 'style', 'worker'].includes(request.destination)")
    expect(source).toContain('if (cached && (!builtAsset || !isHtmlResponse(cached))) return cached')
    expect(source).toContain('cache.delete(request)')
    expect(source).toContain('if (response.ok && (!builtAsset || !isHtmlResponse(response))) retain(event, request, response)')
  })
})
