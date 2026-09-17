import DOMPurify from 'dompurify'
import { marked } from 'marked'
import type { MarkdownAsset } from './engine/library_store'

export interface MarkdownTocEntry { title: string; level: number; bookmark: string; page: number }
export interface MarkdownRenderResult { pages: HTMLElement[]; toc: MarkdownTocEntry[]; assetUrls: string[] }

/** يحول GFM إلى DOM معقم RTL، ثم يقسم الكتل دون شطر جدول أو كتلة شيفرة. */
export function renderMarkdownPages(markdown: string, assets: MarkdownAsset[] = []): MarkdownRenderResult {
  const rendered = marked.parse(expandFootnotes(markdown), { gfm: true, breaks: false, async: false })
  const clean = DOMPurify.sanitize(String(rendered), {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'script', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style', 'srcdoc'],
  })
  const source = document.createElement('div')
  source.className = 'reader__markdown-document'
  source.dir = 'rtl'
  source.innerHTML = clean

  const assetUrls: string[] = []
  const byPath = new Map(assets.map(asset => [normalizeAssetPath(asset.path), asset]))
  for (const image of source.querySelectorAll<HTMLImageElement>('img[src]')) {
    const src = image.getAttribute('src') ?? ''
    if (!src || /^(?:[a-z]+:|\/|#)/i.test(src)) continue
    const asset = byPath.get(normalizeAssetPath(safeDecodeUri(src).split(/[?#]/, 1)[0] ?? ''))
    if (!asset) { image.classList.add('markdown-image--missing'); image.alt ||= 'صورة محلية غير مرفقة'; continue }
    const url = URL.createObjectURL(new Blob([new Uint8Array(asset.data).buffer], { type: asset.mimeType }))
    assetUrls.push(url); image.src = url
  }

  for (const link of source.querySelectorAll<HTMLAnchorElement>('a')) {
    const href = link.getAttribute('href') ?? ''
    if (/^https?:\/\//i.test(href)) { link.target = '_blank'; link.rel = 'noopener noreferrer' }
  }
  for (const code of source.querySelectorAll<HTMLElement>('pre, code')) code.dir = 'ltr'

  const ids = new Map<string, number>()
  for (const heading of source.querySelectorAll<HTMLHeadingElement>('h1,h2,h3,h4,h5,h6')) {
    const base = slug(heading.textContent ?? '') || 'عنوان'
    const copy = (ids.get(base) ?? 0) + 1
    ids.set(base, copy)
    heading.id = `md-${base}${copy > 1 ? `-${copy}` : ''}`
  }
  decorateTafsirAnchors(source)

  const pages: HTMLElement[] = []
  const toc: MarkdownTocEntry[] = []
  let page = markdownPage(1)
  let weight = 0
  for (const node of [...source.children]) {
    const blockWeight = node.matches('table') ? 7 : node.matches('pre') ? 5 : node.matches('h1,h2,h3,h4,h5,h6') ? 2 : 1
    if (weight && weight + blockWeight > 13) { pages.push(page); page = markdownPage(pages.length + 1); weight = 0 }
    page.appendChild(node)
    if (node.matches('h1,h2,h3,h4,h5,h6')) toc.push({ title: node.textContent?.trim() || 'عنوان', level: Number(node.tagName.slice(1)), bookmark: node.id, page: pages.length + 1 })
    weight += blockWeight
  }
  if (page.children.length > 1 || !pages.length) pages.push(page)
  return { pages, toc, assetUrls }
}

/** مرساة بنيوية مشتقة من عنوان السورة ومدى الآيات الموثق، لا من تخمين متن التفسير. */
function decorateTafsirAnchors(source: HTMLElement): void {
  let surah: number | undefined
  let range: { from: number; to: number } | undefined
  for (const child of [...source.children] as HTMLElement[]) {
    if (child.tagName === 'H2') {
      const match = child.textContent?.trim().match(/^سورة\s+(\d+)$/u)
      surah = match ? Number(match[1]) : undefined; range = undefined
    } else if (child.tagName === 'H3') {
      const match = child.textContent?.trim().match(/^الآيات?\s+(\d+)(?:\s*[–-]\s*(\d+))?$/u)
      range = match ? { from: Number(match[1]), to: Number(match[2] ?? match[1]) } : undefined
    }
    if (surah && range) {
      child.dataset.tafsirSurah = String(surah); child.dataset.tafsirFrom = String(range.from); child.dataset.tafsirTo = String(range.to)
    }
  }
}

function expandFootnotes(markdown: string): string {
  const notes = new Map<string, { number: number; body: string }>()
  const withoutDefinitions = markdown.replace(/^\[\^([^\]]+)\]:\s*(.+)$/gmu, (_whole, id: string, body: string) => {
    if (!notes.has(id)) notes.set(id, { number: notes.size + 1, body })
    return ''
  })
  const withReferences = withoutDefinitions.replace(/\[\^([^\]]+)\]/gu, (whole, id: string) => {
    const note = notes.get(id); if (!note) return whole
    return `<sup class="markdown-footnote-ref" id="md-footnote-ref-${safeId(id)}"><a href="#md-footnote-${safeId(id)}" aria-label="الحاشية ${note.number}">${note.number}</a></sup>`
  })
  if (!notes.size) return withReferences
  const items = [...notes.entries()].map(([id, note]) => `<li id="md-footnote-${safeId(id)}">${note.body} <a class="markdown-footnote-back" href="#md-footnote-ref-${safeId(id)}" aria-label="العودة من الحاشية ${note.number}">↩</a></li>`).join('\n')
  return `${withReferences}\n\n<section class="markdown-footnotes" aria-label="الحواشي"><hr><ol>${items}</ol></section>`
}

function safeId(value: string): string { return value.normalize('NFKC').replace(/[^\p{L}\p{N}_-]+/gu, '-').slice(0, 64) || 'note' }
function safeDecodeUri(value: string): string { try { return decodeURIComponent(value) } catch { return value } }
function normalizeAssetPath(path: string): string {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) { if (!part || part === '.') continue; if (part === '..') parts.pop(); else parts.push(part) }
  return parts.join('/')
}

function markdownPage(number: number): HTMLElement {
  const page = document.createElement('section')
  page.className = 'page reader__text-page reader__markdown-page'
  page.dataset.pageIndex = String(number - 1)
  page.dataset.wordPageNumber = String(number)
  page.setAttribute('aria-label', `صفحة Markdown ${number}`)
  const folio = document.createElement('div')
  folio.className = 'reader__text-folio'
  folio.setAttribute('aria-hidden', 'true')
  folio.textContent = `الصفحة ${number}`
  page.appendChild(folio)
  return page
}

function slug(value: string): string {
  return value.normalize('NFKC').trim().replace(/[\u064B-\u065F\u0670]/g, '').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '').slice(0, 72)
}
