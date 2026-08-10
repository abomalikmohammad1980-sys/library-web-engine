import { strFromU8, unzipSync, type UnzipFileInfo } from 'fflate'

export const MAX_EPUB_BYTES = 50 * 1024 * 1024
export const MAX_EPUB_EXPANDED_BYTES = 120 * 1024 * 1024
const decoder = new TextDecoder('utf-8', { fatal: true })

export interface ParsedEpubTocEntry { title: string; level: number; paragraphIndex: number; bookmark: string; chapterIndex: number; anchor?: string }
export interface ParsedEpub { title: string; author: string; publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number; description?: string; text: string; chapters: Array<{ title: string; text: string; path: string }>; toc: ParsedEpubTocEntry[] }

function safePath(value: string): boolean { return Boolean(value) && !value.includes('\\') && !value.startsWith('/') && !/(^|\/)\.\.(\/|$)/.test(value) && !/^[a-z][a-z0-9+.-]*:/i.test(value) }
function attr(tag: string, name: string): string | undefined { return tag.match(new RegExp(`${name}\\s*=\\s*["']([^"']+)["']`, 'i'))?.[1] }
function decodeXml(value: string): string { return value.replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;/gi, '"').replace(/&#39;|&apos;/gi, "'").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n))) }
function cleanMarkup(value: string): string {
  return decodeXml(value.replace(/<script\b[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[\s\S]*?<\/style>/gi, ' ').replace(/<(br|p|div|h[1-6]|li|section|article)\b[^>]*>/gi, '\n').replace(/<[^>]+>/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n\n').trim())
    .split('\n').filter(line => !/^(?:unknown|cover)$/iu.test(line.trim())).join('\n').replace(/\n\s*\n+/g, '\n\n').trim()
}
function textParagraphs(value: string): string[] {
  return value.split(/\n{2,}/).map(paragraph => paragraph.replace(/\n/g, ' ').trim()).filter(Boolean)
}
function anchorParagraphOffsets(markup: string): Map<string, number> {
  const offsets = new Map<string, number>()
  for (const match of markup.matchAll(/<[^>]+\b(?:id|name)\s*=\s*["']([^"']+)["'][^>]*>/gi)) {
    const anchor = decodeXml(match[1] ?? '').trim()
    if (!anchor || offsets.has(anchor) || match.index === undefined) continue
    offsets.set(anchor, textParagraphs(cleanMarkup(markup.slice(0, match.index))).length)
  }
  return offsets
}
function resolveInside(baseFile: string, href: string): string {
  const raw = href.split('#')[0] ?? ''
  if (!safePath(raw)) throw new Error('يحتوي EPUB مسارًا خارجيًا أو غير آمن')
  const parts = [...baseFile.split('/').slice(0, -1), ...raw.split('/')]
  const normalized: string[] = []
  for (const part of parts) { if (!part || part === '.') continue; if (part === '..') { if (!normalized.length) throw new Error('يحتوي EPUB مسارًا خارج الحزمة'); normalized.pop() } else normalized.push(part) }
  return normalized.join('/')
}

function parseNcx(markup: string): Array<{ title: string; level: number; src: string }> {
  const entries: Array<{ title: string; level: number; src: string }> = []
  const stack: Array<{ title?: string; src?: string; level: number }> = []
  for (const match of markup.matchAll(/<navPoint\b[^>]*>|<\/navPoint>|<text\b[^>]*>([\s\S]*?)<\/text>|<content\b[^>]*>/gi)) {
    const token = match[0]
    if (/^<navPoint\b/i.test(token)) stack.push({ level: stack.length + 1 })
    else if (/^<\/navPoint/i.test(token)) {
      const item = stack.pop()
      if (item?.title && item.src) entries.push({ title: item.title, level: item.level, src: item.src })
    } else if (/^<text\b/i.test(token) && stack.length) stack[stack.length - 1]!.title ??= cleanMarkup(match[1] ?? '')
    else if (/^<content\b/i.test(token) && stack.length) { const src = attr(token, 'src'); if (src) stack[stack.length - 1]!.src ??= src }
  }
  return entries
}

export function parseEpub(data: Uint8Array, fileName: string): ParsedEpub {
  if (!/\.epub$/i.test(fileName)) throw new Error('اختر ملف EPUB صحيحًا')
  if (!data.length) throw new Error('ملف EPUB فارغ')
  if (data.length > MAX_EPUB_BYTES) throw new Error('حجم EPUB يتجاوز 50 ميجابايت')
  let expanded = 0
  let files: Record<string, Uint8Array>
  try {
    files = unzipSync(data, { filter(info: UnzipFileInfo) { if (!safePath(info.name)) throw new Error('unsafe_path'); expanded += info.originalSize; if (expanded > MAX_EPUB_EXPANDED_BYTES) throw new Error('expanded_limit'); return true } })
  } catch (error) {
    const code = error instanceof Error ? error.message : ''
    if (code.includes('unsafe_path')) throw new Error('يحتوي EPUB مسارًا غير آمن')
    if (code.includes('expanded_limit')) throw new Error('محتوى EPUB المضغوط يتجاوز الحد الآمن')
    throw new Error('حزمة EPUB تالفة أو غير صالحة')
  }
  const mime = files.mimetype
  if (!mime || strFromU8(mime).trim() !== 'application/epub+zip') throw new Error('ملف mimetype في EPUB غير صحيح')
  const container = files['META-INF/container.xml']
  if (!container) throw new Error('يفتقد EPUB ملف container.xml')
  const rootPath = attr(decoder.decode(container).match(/<rootfile\b[^>]*>/i)?.[0] ?? '', 'full-path')
  if (!rootPath || !safePath(rootPath) || !files[rootPath]) throw new Error('مسار OPF في EPUB غير صالح')
  const opf = decoder.decode(files[rootPath])
  const title = cleanMarkup(opf.match(/<dc:title\b[^>]*>([\s\S]*?)<\/dc:title>/i)?.[1] ?? '') || fileName.replace(/\.epub$/i, '')
  const author = cleanMarkup(opf.match(/<dc:creator\b[^>]*>([\s\S]*?)<\/dc:creator>/i)?.[1] ?? '') || 'غير معروف'
  const publisher = cleanMarkup(opf.match(/<dc:publisher\b[^>]*>([\s\S]*?)<\/dc:publisher>/i)?.[1] ?? '') || undefined
  const description = cleanMarkup(opf.match(/<dc:description\b[^>]*>([\s\S]*?)<\/dc:description>/i)?.[1] ?? '') || undefined
  const edition = cleanMarkup(opf.match(/<meta\b[^>]*(?:property=["'](?:schema:bookEdition|book:edition)["']|name=["'](?:edition|calibre:edition)["'])[^>]*>([\s\S]*?)<\/meta>/i)?.[1] ?? '') || undefined
  const contributors = [...opf.matchAll(/<dc:contributor\b([^>]*)>([\s\S]*?)<\/dc:contributor>/gi)]
  const editor = contributors.find(match => /(?:role\s*=\s*["'](?:edt|editor)["']|opf:role\s*=\s*["']edt["'])/i.test(match[1] ?? ''))
  const investigator = cleanMarkup(editor?.[2] ?? '') || undefined
  const date = cleanMarkup(opf.match(/<dc:date\b[^>]*>([\s\S]*?)<\/dc:date>/i)?.[1] ?? '')
  const hijri = date.match(/(?:^|\D)(1[234]\d{2})\s*هـ/u)?.[1]
  const publicationYearHijri = hijri ? Number(hijri) : undefined
  const manifest = new Map<string, { path: string; mediaType: string }>()
  for (const tag of opf.match(/<item\b[^>]*>/gi) ?? []) { const id = attr(tag, 'id'); const href = attr(tag, 'href'); if (!id || !href) continue; manifest.set(id, { path: resolveInside(rootPath, href), mediaType: attr(tag, 'media-type') ?? '' }) }
  const chapters: Array<{ title: string; text: string; path: string; headings: Map<string, string>; anchorOffsets: Map<string, number> }> = []
  for (const ref of opf.match(/<itemref\b[^>]*>/gi) ?? []) {
    const item = manifest.get(attr(ref, 'idref') ?? '')
    if (!item || !/^(application\/xhtml\+xml|text\/html)$/i.test(item.mediaType)) continue
    const bytes = files[item.path]; if (!bytes) throw new Error('يفتقد EPUB فصلًا مذكورًا في spine')
    const markup = decoder.decode(bytes)
    const text = cleanMarkup(markup)
    if (!text) continue
    const heading = cleanMarkup(markup.match(/<h[1-6]\b[^>]*>([\s\S]*?)<\/h[1-6]>/i)?.[1] ?? '')
    const htmlTitle = cleanMarkup(markup.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '')
    const chapterTitle = heading || (!/^(?:unknown|untitled)$/i.test(htmlTitle) ? htmlTitle : '') || `فصل ${chapters.length + 1}`
    const headings = new Map<string, string>()
    for (const found of markup.matchAll(/<h([1-6])\b([^>]*)>([\s\S]*?)<\/h\1>/gi)) { const id = attr(found[2] ?? '', 'id'); const value = cleanMarkup(found[3] ?? ''); if (id && value) headings.set(id, value) }
    chapters.push({ title: chapterTitle, text, path: item.path, headings, anchorOffsets: anchorParagraphOffsets(markup) })
  }
  if (!chapters.length) throw new Error('لا يحتوي EPUB فصولًا نصية قابلة للقراءة')
  const text = chapters.map(chapter => chapter.text).join('\n\n')
  const paragraphs = textParagraphs(text)
  const starts: number[] = []
  let paragraphCursor = 0
  for (const chapter of chapters) { starts.push(paragraphCursor); paragraphCursor += textParagraphs(chapter.text).length }
  const ncxItem = [...manifest.values()].find(item => /application\/x-dtbncx\+xml/i.test(item.mediaType))
  const ncx = ncxItem && files[ncxItem.path] ? parseNcx(decoder.decode(files[ncxItem.path]!)) : []
  const toc: ParsedEpubTocEntry[] = []
  ncx.forEach((entry, index) => {
    const [href, anchor] = entry.src.split('#')
    let path: string
    try { path = resolveInside(ncxItem!.path, href ?? '') } catch { return }
    const chapterIndex = chapters.findIndex(chapter => chapter.path === path)
    if (chapterIndex < 0) return
    const chapter = chapters[chapterIndex]!
    const start = starts[chapterIndex] ?? 0
    const anchoredOffset = anchor ? chapter.anchorOffsets.get(anchor) : 0
    const targetText = anchor ? chapter.headings.get(anchor) : chapter.title
    const chapterEnd = start + textParagraphs(chapter.text).length
    const found = anchoredOffset === undefined && targetText
      ? paragraphs.findIndex((paragraph, paragraphIndex) => paragraphIndex >= start && paragraphIndex < chapterEnd && paragraph.includes(targetText))
      : -1
    const paragraphIndex = anchoredOffset !== undefined ? start + anchoredOffset : found >= 0 ? found : start
    toc.push({ title: entry.title, level: entry.level, paragraphIndex, bookmark: `epub-toc-${index + 1}`, chapterIndex, ...(anchor ? { anchor } : {}) })
  })
  return { title, author, ...(publisher ? { publisher } : {}), ...(edition ? { edition } : {}), ...(investigator ? { investigator } : {}), ...(publicationYearHijri ? { publicationYearHijri } : {}), ...(description ? { description } : {}), chapters: chapters.map(({ title: chapterTitle, text: chapterText, path }) => ({ title: chapterTitle, text: chapterText, path })), text, toc }
}
