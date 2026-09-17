import { unzipSync } from 'fflate'
import { rasterPayload } from '@engine/ooxml-dom'
import { h } from './ui'
import type { StoredBook } from './engine/library_store'
export { discoverWordCover, selectCoverCandidate } from '@library/word-cover'
import { discoverWordCover } from '@library/word-cover'
import { createTrackedObjectURL, revokeTrackedObjectURL } from './resource_lifecycle'
import { brandMark } from './brand'

export function deterministicCoverHue(seed: string): number {
  let hash = 2166136261
  for (const char of seed) { hash ^= char.codePointAt(0) ?? 0; hash = Math.imul(hash, 16777619) }
  return Math.abs(hash) % 360
}

export function deterministicCoverTemplate(seed: string): number { return deterministicCoverHue(seed) % 4 }

const coverUrlCache = new Map<string, string>()
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
  const cover = h('span', { class: `${className} book-cover`, dataset: { coverTemplate: String(template) }, style: `--cover-hue:${book.coverHue ?? deterministicCoverHue(`${book.title}|${book.category ?? ''}`)}` })
  const url = storedCoverUrl(book)
  if (url) cover.appendChild(h('img', { src: url, alt: '' }))
  else cover.append(h('span', { class: 'book-cover__title' }, book.title), h('span', { class: 'book-cover__author' }, book.author || 'مؤلف غير معروف'), brandMark('book-cover__brand brand-mark'))
  return cover
}

export function previewCover(title: string, author: string, hue: number, real?: { bytes: Uint8Array; mimeType: string }, options: { category?: string; format?: string; template?: number } = {}): { element: HTMLElement; update: (nextTitle: string, nextAuthor: string, category?: string) => void } {
  const element = h('span', { class: 'import-book__cover book-cover', dataset: { coverTemplate: String(options.template ?? deterministicCoverTemplate(title)) }, style: `--cover-hue:${hue}` })
  if (real) {
    const url = createTrackedObjectURL(new Blob([new Uint8Array(real.bytes)], { type: real.mimeType }))
    const image = h('img', { src: url, alt: '' })
    const release = (): void => revokeTrackedObjectURL(url)
    image.addEventListener('load', release, { once: true })
    image.addEventListener('error', release, { once: true })
    element.appendChild(image)
    return { element, update: () => undefined }
  }
  const titleNode = h('span', { class: 'book-cover__title' }, title)
  const authorNode = h('span', { class: 'book-cover__author' }, author || 'اسم المؤلف')
  element.append(titleNode, authorNode, brandMark('book-cover__brand brand-mark'))
  return { element, update: (nextTitle, nextAuthor) => { titleNode.textContent = nextTitle || 'عنوان الكتاب'; authorNode.textContent = nextAuthor || 'اسم المؤلف' } }
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
