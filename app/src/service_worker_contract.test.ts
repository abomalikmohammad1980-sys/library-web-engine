import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const source = readFileSync(new URL('../public/sw.js', import.meta.url), 'utf8')
const bootstrap = readFileSync(new URL('./main.ts', import.meta.url), 'utf8')

describe('service worker offline shell contract', () => {
  it('versions the cache and atomically installs declared and built assets', () => {
    expect(source).toContain("alkhizana-shell-v8")
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

  it('refreshes the centrally published library before falling back offline', () => {
    expect(source).toContain("url.pathname.startsWith('/library/published/')")
    expect(source).toMatch(/startsWith\('\/library\/published\/'\)[\s\S]*fetch\(request\)[\s\S]*caches\.match\(request\)/)
  })

  it('keeps navigation fallback, API exclusion, activation cleanup, and immediate update', () => {
    expect(source).toContain("url.pathname.startsWith('/api/')")
    expect(source).toContain("caches.match('./index.html')")
    expect(source).toContain("keys.filter(key => key.startsWith('alkhizana-shell-') && key !== CACHE)")
    expect(source).toContain('self.skipWaiting()')
    expect(source).toContain('self.clients.claim()')
    expect(bootstrap).toContain("updateViaCache: 'none'")
    expect(bootstrap).toContain('registration.update()')
  })
})
