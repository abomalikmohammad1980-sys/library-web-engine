import {backgroundDataInteractionAllowed} from './background_data_scheduler'
import {whenNearViewport} from './near_viewport'
import { h } from './ui'
import type { StoredBook } from './engine/library_store'
import { createTrackedObjectURL, revokeTrackedObjectURL, routeObserver, routeEventListener, routeAnimationFrame, captureRouteResourceScope, type ResourceScope } from './resource_lifecycle'
import { fitCoverTextBatch, type CoverFitTarget } from './cover_text_fit'
import { brandMark } from './brand'

import {deterministicCoverHue,deterministicCoverTemplate} from './book_cover_identity'
export {deterministicCoverHue,deterministicCoverTemplate} from './book_cover_identity'

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
const coverFitQueues = new WeakMap<ResourceScope, Set<HTMLElement>>()
/** Measure the actual shaped text after layout/font loading, not character count. */
function fitCoverText(cover: HTMLElement): void {
  const scope = captureRouteResourceScope()
  // A hidden reader-info cover must not synchronously measure the entire
  // (potentially 10k-page) reading stream before the first paint.
  let visible = typeof IntersectionObserver === 'undefined'
  const allowed=()=>backgroundDataInteractionAllowed()||Boolean(cover.closest('.quick-book-import'))
  const schedule = () => {
    if(!allowed())return
    if (scope.disposed || !visible) return
    let queue = coverFitQueues.get(scope)
    if (!queue) {
      queue = new Set()
      coverFitQueues.set(scope, queue)
      scope.add(() => { queue!.clear(); coverFitQueues.delete(scope) })
    }
    const pending = queue.size > 0
    queue.add(cover)
    if (pending) return
    routeAnimationFrame(() => {
      const covers = [...queue!]
      queue!.clear()
      if(!allowed())return
      const targets: CoverFitTarget[] = []
      for (const item of covers) {
        if (!item.isConnected || !item.clientWidth) continue
        const width = item.clientWidth
        for (const node of item.querySelectorAll<HTMLElement>('.book-cover__title, .book-cover__author')) {
          const range = document.createRange(); range.selectNodeContents(node)
          targets.push({
            maximum: width * (node.classList.contains('book-cover__title') ? .17 : .10),
            write: size => { node.style.fontSize = `${size}px` },
            fits: () => {
              const text = range.getBoundingClientRect()
              return text.height <= node.clientHeight - 2 && text.width <= node.clientWidth + .5
            },
          })
        }
      }
      fitCoverTextBatch(targets)
    }, scope)
  }
  if (typeof IntersectionObserver !== 'undefined') routeObserver(new IntersectionObserver(entries => {
    const next = entries.some(entry => entry.isIntersecting)
    if (next && !visible) { visible = true; schedule() }
    else visible = next
  }, { rootMargin: '160px' }), scope).observe(cover)
  routeEventListener(window,'alkhizana:import-activity',schedule,undefined,scope)
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
  const url = customCoverUrl(book)
  if (url) cover.appendChild(h('img', { src: url, alt: '' }))
  else {
    cover.append(h('span', { class: 'book-cover__title', title: book.title, dataset:{noTranslate:''} }, book.title), brandMark('book-cover__brand brand-mark'), h('span', { class: 'book-cover__author', title: book.author || 'مؤلف غير معروف', ...(book.author?{dataset:{noTranslate:''}}:{}) }, book.author || 'مؤلف غير معروف'))
    fitCoverText(cover)
    if (book.data?.length) {
      const scope=captureRouteResourceScope()
      whenNearViewport(cover,()=>{
        void storedCoverUrl(book).then(url=>{if(url&&!scope.disposed&&cover.isConnected)cover.replaceChildren(h('img',{src:url,alt:''}))}).catch(()=>undefined)
      },scope)
    }
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

function customCoverUrl(book: Pick<StoredBook, 'customCoverData' | 'customCoverMimeType' | 'originalSha256'>): string | undefined {
  if (book.customCoverData?.length) {
    const customKey = `${book.originalSha256}:custom-cover`
    const cached = coverUrlCache.get(customKey)
    if (cached) return cached
    return cacheCoverUrl(customKey, createTrackedObjectURL(new Blob([new Uint8Array(book.customCoverData)], { type: book.customCoverMimeType || 'image/jpeg' })))
  }
  return undefined
}

async function storedCoverUrl(book: Pick<StoredBook, 'data' | 'originalSha256' | 'coverMediaPath'>): Promise<string|undefined> {
  const key=`${book.originalSha256}:${book.coverMediaPath??'auto-cover'}`
  const cached=coverUrlCache.get(key)
  if(cached)return cached
  const {wordCoverPayload}=await import('./word_cover_payload')
  // A concurrent card may have decoded the same cover while the module loaded.
  const ready=coverUrlCache.get(key)
  if(ready)return ready
  const payload=wordCoverPayload(book.data,book.coverMediaPath)
  if(!payload)return undefined
  return cacheCoverUrl(key,createTrackedObjectURL(new Blob([new Uint8Array(payload.bytes)],{type:payload.mimeType})))
}

function imageMime(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase()
  return ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg'
}
