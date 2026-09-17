import DOMPurify from 'dompurify'
import {safeImportedStyle} from './import_style_security'
import { strFromU8, unzipSync } from 'fflate'
import { parseEpub } from './epub_import'
import { decorateImportedTextualDom } from './shamela_text_presentation'

export interface EpubRendition {
  pages: HTMLElement[]
  toc: Array<{ title: string; level: number; page: number; bookmark: string }>
  cleanup(): void
}

const IMAGE_OR_FONT = /^(?:image\/(?:png|jpeg|gif|webp|svg\+xml)|font\/(?:ttf|otf|woff2?)|application\/(?:font-woff|vnd\.ms-fontobject|x-font-ttf|x-font-opentype))$/i

function safePath(value: string): boolean {
  return Boolean(value) && !value.includes('\\') && !value.startsWith('/') && !/(^|\/)\.\.(\/|$)/.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value)
}

function resolveInside(baseFile: string, href: string): string | undefined {
  let raw = (href.split('#')[0] ?? '').trim()
  try { raw = decodeURIComponent(raw) } catch { return undefined }
  if (!raw) return baseFile
  if (!safePath(raw)) return undefined
  const parts = [...baseFile.split('/').slice(0, -1), ...raw.split('/')], normalized: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') { if (!normalized.length) return undefined; normalized.pop() } else normalized.push(part)
  }
  return normalized.join('/')
}

function mimeFromPath(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  return ({ png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ttf: 'font/ttf', otf: 'font/otf', woff: 'font/woff', woff2: 'font/woff2' } as Record<string, string>)[ext ?? ''] ?? 'application/octet-stream'
}

function safeStyle(value: string): string {
  return safeImportedStyle(value) // javascript|expression and network CSS are not document formatting.
}

function safeId(chapter: number, value: string): string {
  const normalized = value.replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 80) || 'top'
  return `epub-${chapter + 1}-${normalized}`
}

function scopedCss(css: string, scope: string, basePath: string, assetUrl: (path: string) => string | undefined): string {
  const noImports = css.replace(/@import[\s\S]*?;/gi, '').replace(/\/\*[\s\S]*?\*\//g, '')
  const rewritten = noImports.replace(/url\(\s*(['"]?)(.*?)\1\s*\)/gi, (_all, _quote, href: string) => {
    const path = resolveInside(basePath, href)
    const url = path ? assetUrl(path) : undefined
    return url ? `url("${url}")` : 'none'
  })
  return rewritten.replace(/([^{}]+)\{([^{}]*)\}/g, (_all, selectorText: string, body: string) => {
    const declarations = safeStyle(body)
    if (!declarations) return ''
    const selector = selectorText.trim()
    if (/^@(?:font-face|media|supports)/i.test(selector)) return ''
    if (selector.startsWith('@')) return ''
    if (!/^[\w\s.#,>*+\-]+$/.test(selector)) return ''
    const scoped = selector.split(',').map((item: string) => {
      const clean = item.trim().replace(/^(?:html|body)(?=\s|$)/i, '').trim()
      return clean ? `${scope} ${clean}` : scope
    }).join(',')
    return `${scoped}{${declarations}}`
  })
}

/** يبني نسخة DOM آمنة من الأصل نفسه؛ كل الموارد blob محلية ولا شبكة. */
export function renderEpubRendition(data: Uint8Array, fileName: string): EpubRendition {
  const parsed = parseEpub(data, fileName)
  const files = unzipSync(data), urls = new Map<string, string>()
  const assetUrl = (path: string): string | undefined => {
    if (urls.has(path)) return urls.get(path)
    const bytes = files[path]
    if (!bytes) return undefined
    const mime = mimeFromPath(path)
    if (!IMAGE_OR_FONT.test(mime)) return undefined
    const url = URL.createObjectURL(new Blob([bytes.slice().buffer as ArrayBuffer], { type: mime }))
    urls.set(path, url); return url
  }
  const pages = parsed.chapters.map((chapter, chapterIndex) => {
    const markup = strFromU8(files[chapter.path] ?? new Uint8Array())
    const doc = new DOMParser().parseFromString(markup, 'text/html')
    const fragment = DOMPurify.sanitize(doc.body?.innerHTML ?? markup, {
      RETURN_DOM_FRAGMENT: true,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button', 'textarea', 'select', 'option', 'meta', 'base', 'style', 'link', 'svg', 'math', 'video', 'audio', 'source'],
      FORBID_ATTR: ['srcdoc', 'srcset', 'sizes', 'ping', 'autofocus', 'formaction'],
      ALLOW_DATA_ATTR: false,
    }) as DocumentFragment
    const content = document.createElement('article')
    content.className = 'reader__epub-content'
    content.dir = doc.documentElement.getAttribute('dir') === 'ltr' || doc.body?.getAttribute('dir') === 'ltr' ? 'ltr' : 'rtl'
    content.appendChild(fragment)
    decorateImportedTextualDom(content)
    for (const element of content.querySelectorAll<HTMLElement>('*')) {
      for (const name of element.getAttributeNames()) if (/^on/i.test(name)) element.removeAttribute(name)
      if (element.hasAttribute('style')) element.setAttribute('style', safeStyle(element.getAttribute('style') ?? ''))
      const originalId = element.id || element.getAttribute('name') || ''
      if (originalId) element.id = safeId(chapterIndex, originalId)
    }
    for (const media of content.querySelectorAll<HTMLElement>('[src],[poster]')) for (const name of ['src', 'poster']) {
      const href = media.getAttribute(name); if (!href) continue
      const path = resolveInside(chapter.path, href), url = path ? assetUrl(path) : undefined
      if (url) media.setAttribute(name, url); else media.removeAttribute(name)
    }
    for (const link of content.querySelectorAll<HTMLAnchorElement>('a[href]')) {
      const href = link.getAttribute('href') ?? '', [rawPath, anchor = ''] = href.split('#')
      const path = resolveInside(chapter.path, rawPath ?? '')
      if (!path || !parsed.chapters.some(item => item.path === path)) { link.removeAttribute('href'); continue }
      const targetChapter = parsed.chapters.findIndex(item => item.path === path)
      link.href = `#${safeId(targetChapter, anchor || 'top')}`
      link.dataset.epubChapter = String(targetChapter); link.dataset.epubAnchor = anchor
    }
    const page = document.createElement('section')
    page.className = 'page reader__text-page reader__epub-page'
    page.dataset.pageIndex = String(chapterIndex); page.dataset.wordPageNumber = String(chapterIndex + 1); page.dataset.searchText = chapter.text
    page.id = safeId(chapterIndex, 'top')
    const style = document.createElement('style')
    const linkedCss = [...doc.querySelectorAll<HTMLLinkElement>('link[rel~="stylesheet"][href]')].map(link => resolveInside(chapter.path, link.getAttribute('href') ?? '')).filter((path): path is string => Boolean(path && files[path]))
    const externalCss = [...new Set(linkedCss)].map(path => scopedCss(strFromU8(files[path]!), '.reader__epub-content', path, assetUrl)).join('\n')
    const inlineCss = [...doc.querySelectorAll('style')].map(node => scopedCss(node.textContent ?? '', '.reader__epub-content', chapter.path, assetUrl)).join('\n')
    const chapterCss = `${externalCss}\n${inlineCss}`
    style.textContent = chapterCss
    page.append(style, content)
    return page
  })
  const toc = parsed.toc.map(entry => ({ title: entry.title, level: entry.level, page: entry.chapterIndex + 1, bookmark: safeId(entry.chapterIndex, entry.anchor || 'top') }))
  return { pages, toc, cleanup: () => { for (const url of urls.values()) URL.revokeObjectURL(url); urls.clear() } }
}
