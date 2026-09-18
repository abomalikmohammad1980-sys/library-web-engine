import { unzipSync } from 'fflate'
import { rasterPayload } from '@engine/ooxml-dom'
import { h } from './ui'
import type { StoredBook } from './engine/library_store'
export { discoverWordCover, selectCoverCandidate } from '@library/word-cover'
import { discoverWordCover } from '@library/word-cover'
import { createTrackedObjectURL, revokeTrackedObjectURL, routeObserver, routeEventListener, routeAnimationFrame } from './resource_lifecycle'
import { coalesceCoverFit } from './cover_fit_scheduler'
import { brandMark } from './brand'

export function deterministicCoverHue(seed: string): number {
  let hash = 2166136261
  for (const char of seed) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) }
  return Math.abs(hash) % 360
}

export function deterministicCoverTemplate(seed: string): number { return deterministicCoverHue(seed) % 4 }

export function deterministicCoverPalette(bookId: string): number { return deterministicCoverHue(bookId) % 10 }

export interface CoverPalette {
  backgroundA: string; backgroundB: string; titleBackground: string; titleForeground: string
  authorForeground: string; metadataForeground: string; logoBackground: string; logoForeground: string
  accent: string; border: string
}

export const COVER_PALETTES: readonly CoverPalette[] = [
  { backgroundA: '#153f5b', backgroundB: '#071f32', titleBackground: '#062437', titleForeground: '#fff8e6', authorForeground: '#fff8e6', metadataForeground: '#fff8e6', logoBackground: '#fffaf0', logoForeground: '#153f5b', accent: '#f0c96f', border: '#d5a84e' },
  { backgroundA: '#6b2748', backgroundB: '#2d1021', titleBackground: '#351123', titleForeground: '#fff6e8', authorForeground: '#fff6e8', metadataForeground: '#fff6e8', logoBackground: '#fff8ef', logoForeground: '#6b2748', accent: '#f2ce7d', border: '#dca955' },
  { backgroundA: '#5b321d', backgroundB: '#23140c', titleBackground: '#2b170d', titleForeground: '#fff7e7', authorForeground: '#fff7e7', metadataForeground: '#fff7e7', logoBackground: '#fff9ee', logoForeground: '#5b321d', accent: '#edc36d', border: '#ce9944' },
  { backgroundA: '#30325f', backgroundB: '#13152f', titleBackground: '#171936', titleForeground: '#fff9e8', authorForeground: '#fff9e8', metadataForeground: '#fff9e8', logoBackground: '#fffaf1', logoForeground: '#30325f', accent: '#e1cc7b', border: '#bea950' },
  { backgroundA: '#73421b', backgroundB: '#321b09', titleBackground: '#381e0a', titleForeground: '#fff8e8', authorForeground: '#fff8e8', metadataForeground: '#fff8e8', logoBackground: '#fff9ee', logoForeground: '#73421b', accent: '#f3ce7b', border: '#dda84c' },
  { backgroundA: '#4e245e', backgroundB: '#211029', titleBackground: '#27122f', titleForeground: '#fff7e9', authorForeground: '#fff7e9', metadataForeground: '#fff7e9', logoBackground: '#fff9ef', logoForeground: '#4e245e', accent: '#e8c77c', border: '#cda85a' },
  { backgroundA: '#24506a', backgroundB: '#0d2636', titleBackground: '#102b3c', titleForeground: '#fff8e5', authorForeground: '#fff8e5', metadataForeground: '#fff8e5', logoBackground: '#fffaf0', logoForeground: '#24506a', accent: '#edca78', border: '#d2aa55' },
  { backgroundA: '#71352e', backgroundB: '#2d1411', titleBackground: '#341713', titleForeground: '#fff7e8', authorForeground: '#fff7e8', metadataForeground: '#fff7e8', logoBackground: '#fff9ef', logoForeground: '#71352e', accent: '#efc675', border: '#d7a24d' },
  { backgroundA: '#384e27', backgroundB: '#182411', titleBackground: '#1b2913', titleForeground: '#fff8e5', authorForeground: '#fff8e5', metadataForeground: '#fff8e5', logoBackground: '#fffaf0', logoForeground: '#384e27', accent: '#e5c873', border: '#c4a749' },
  { backgroundA: '#53452b', backgroundB: '#211b10', titleBackground: '#282014', titleForeground: '#fff8e6', authorForeground: '#fff8e6', metadataForeground: '#fff8e6', logoBackground: '#fffaf0', logoForeground: '#53452b', accent: '#e8ca7b', border: '#caaa59' },
] as const

function paletteStyle(index: number): string {
  const palette = COVER_PALETTES[index]!
  return `--cover-bg-a:${palette.backgroundA};--cover-bg-b:${palette.backgroundB};--cover-title-bg:${palette.titleBackground};--cover-title-fg:${palette.titleForeground};--cover-author-fg:${palette.authorForeground};--cover-meta-fg:${palette.metadataForeground};--cover-logo-bg:${palette.logoBackground};--cover-logo-fg:${palette.logoForeground};--cover-accent:${palette.accent};--cover-border:${palette.border}`
}

export function coverTitleFit(title: string): number {
  const length = Array.from(title.trim()).length
  if (length > 120) return 7
  if (length > 80) return 8
  if (length > 48) return 9
  if (length > 28) return 10.5
  return 12
}

const coverUrlCache = new Map<string, string>()
/** Measure the actual shaped text after layout/font loading, not character count. */
function fitCoverText(cover: HTMLElement): void {
  const fit = () => {
    if (!cover.isConnected || !cover.clientWidth) return
    for (const node of cover.querySelectorAll<HTMLElement>('.book-cover__title, .book-cover__author')) {
      let low = 0.25, high = cover.clientWidth * (node.classList.contains('book-cover__title') ? .17 : .10)
      const range = document.createRange(); range.selectNodeContents(node)
      for (let i = 0; i < 16; i++) {
        const size = (low + high) / 2; node.style.fontSize = `${size}px`
        const text = range.getBoundingClientRect()
        if (text.height <= node.clientHeight - 2 && text.width <= node.clientWidth + .5) low = size
        else high = size
      }
      node.style.fontSize = `${low}px`
    }
  }
  const schedule=coalesceCoverFit(callback=>routeAnimationFrame(callback),fit)
  if (typeof ResizeObserver !== 'undefined') routeObserver(new ResizeObserver(schedule)).observe(cover)
  routeObserver(new MutationObserver(schedule)).observe(cover, {childList:true,subtree:true,characterData:true})
  void document.fonts?.ready.then(schedule)
  if (document.fonts) routeEventListener(document.fonts, 'loadingdone', schedule)
}
const MAX_COVER_URLS = 128

function cacheCoverUrl(key: string, url: string): string {
  const previous = coverUrlCache.get(key)
  if (previous && previous !== url) revokeTrackedObjectURL(previous)
  coverUrlCache.delete(key)
  coverUrlCache.set(key, url)
  while (coverUrlCache.size > MAX_COVER_URLS) {
    const oldest = coverUrlCache.entries().next().value as [string, string] | undefined
    if (!oldest) break
    coverUrlCache.delete(oldest[0])
    revokeTrackedObjectURL(oldest[1])
  }
  return url
}

export function clearCoverUrlCache(): void {
  for (const url of coverUrlCache.values()) revokeTrackedObjectURL(url)
  coverUrlCache.clear()
}

if (typeof window !== 'undefined') window.addEventListener('pagehide', clearCoverUrlCache)

export function bookCover(book: Pick<StoredBook, 'id' | 'title' | 'author' | 'data' | 'originalSha256' | 'coverMediaPath' | 'coverHue' | 'coverTemplate' | 'customCoverData' | 'customCoverMimeType' | 'category' | 'sourceFormat' | 'fileName' | 'mimeType'>, className: string): HTMLElement {
  const template = book.coverTemplate ?? deterministicCoverTemplate(`${book.title}|${book.category ?? ''}`)
  const palette = deterministicCoverPalette(book.id)
  const cover = h('span', { class: `${className} book-cover`, dataset: { coverTemplate: String(template), coverPalette: String(palette) }, style: `--cover-hue:${book.coverHue ?? deterministicCoverHue(`${book.title}|${book.category ?? ''}`)};--cover-fit:${coverTitleFit(book.title)};${paletteStyle(palette)}` })
  const url = storedCoverUrl(book)
  if (url) cover.appendChild(h('img', { src: url, alt: '' }))
  else {
    cover.append(h('span', { class: 'book-cover__title', title: book.title, dataset:{noTranslate:''} }, book.title), brandMark('book-cover__brand brand-mark'), h('span', { class: 'book-cover__author', title: book.author || 'مؤلف غير معروف', ...(book.author?{dataset:{noTranslate:''}}:{}) }, book.author || 'مؤلف غير معروف'))
    fitCoverText(cover)
  }
  return cover
}

export function previewCover(title: string, author: string, hue: number, real?: { bytes: Uint8Array; mimeType: string }, options: { category?: string; format?: string; template?: number } = {}): { element: HTMLElement; update: (nextTitle: string, nextAuthor: string, category?: string) => void } {
  const palette = deterministicCoverPalette(title)
  const element = h('span', { class: 'import-book__cover book-cover', dataset: { coverTemplate: String(options.template ?? deterministicCoverTemplate(title)), coverPalette: String(palette) }, style: `--cover-hue:${hue};--cover-fit:${coverTitleFit(title)};${paletteStyle(palette)}` })
  if (real) {
    const url = createTrackedObjectURL(new Blob([new Uint8Array(real.bytes)], { type: real.mimeType }))
    const image = h('img', { src: url, alt: '' })
    const release = (): void => revokeTrackedObjectURL(url)
    image.addEventListener('load', release, { once: true })
    image.addEventListener('error', release, { once: true })
    element.appendChild(image)
    return { element, update: () => undefined }
  }
  const titleNode = h('span', { class: 'book-cover__title', title, ...(title?{dataset:{noTranslate:''}}:{}) }, title)
  const authorNode = h('span', { class: 'book-cover__author', title: author || 'اسم المؤلف', ...(author?{dataset:{noTranslate:''}}:{}) }, author || 'اسم المؤلف')
  element.append(titleNode, brandMark('book-cover__brand brand-mark'), authorNode)
  fitCoverText(element)
  return { element, update: (nextTitle, nextAuthor) => {
    if(nextTitle)titleNode.dataset.noTranslate='';else delete titleNode.dataset.noTranslate
    if(nextAuthor)authorNode.dataset.noTranslate='';else delete authorNode.dataset.noTranslate
    titleNode.textContent = nextTitle || 'عنوان الكتاب'; titleNode.title = nextTitle || 'عنوان الكتاب'; authorNode.textContent = nextAuthor || 'اسم المؤلف'; authorNode.title = nextAuthor || 'اسم المؤلف'; element.style.setProperty('--cover-fit', String(coverTitleFit(nextTitle)))
  } }
}

function storedCoverUrl(book: Pick<StoredBook, 'data' | 'originalSha256' | 'coverMediaPath' | 'customCoverData' | 'customCoverMimeType'>): string | undefined {
  if (book.customCoverData?.length) {
    const customKey = `${book.originalSha256}:custom-cover`
    const cached = coverUrlCache.get(customKey)
    if (cached) return cached
    return cacheCoverUrl(customKey, createTrackedObjectURL(new Blob([new Uint8Array(book.customCoverData)], { type: book.customCoverMimeType || 'image/jpeg' })))
  }
  if (!book.coverMediaPath) {
    const fallbackKey = `${book.originalSha256}:auto-cover`
    const cachedAuto = coverUrlCache.get(fallbackKey)
    if (cachedAuto) return cachedAuto
    const discovered = discoverWordCover(book.data)
    if (!discovered) return undefined
    const url = createTrackedObjectURL(new Blob([new Uint8Array(discovered.bytes)], { type: discovered.mimeType }))
    return cacheCoverUrl(fallbackKey, url)
  }
  const key = `${book.originalSha256}:${book.coverMediaPath}`
  const cached = coverUrlCache.get(key)
  if (cached) return cached
  try {
    const files = unzipSync(book.data)
    const bytes = files[`word/${book.coverMediaPath}`]
    if (!bytes) return undefined
    const payload = rasterPayload(bytes)
    if (!payload) return undefined
    const url = createTrackedObjectURL(new Blob([new Uint8Array(payload.bytes)], { type: payload.mime }))
    return cacheCoverUrl(key, url)
  } catch { return undefined }
}

function imageMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
}
