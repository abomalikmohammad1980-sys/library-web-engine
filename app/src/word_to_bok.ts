import { loadBookFromBuffer } from './engine/bridge'

export interface WordToBokSource {
  fileName: string
  data: Uint8Array
  sourceData?: Uint8Array
  title: string
  author: string
}

interface BokTreeEntry { id: number; title: string; level: number; parent: number }
interface BokBuildPayload { title: string; author: string; pages: string[]; toc: BokTreeEntry[] }

function decodeLegacy(data: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: true }).decode(data).replace(/^\uFEFF/u, '') }
  catch { return new TextDecoder('windows-1256').decode(data) }
}

function legacyPayload(source: WordToBokSource): BokBuildPayload | undefined {
  if (!source.sourceData) return undefined
  const text = decodeLegacy(source.sourceData)
  const separator = /^[\t ]*PAGE_SEPARATOR[\t ]*(?:\r?\n|\r|$)/gmu
  if (!separator.test(text)) return undefined
  separator.lastIndex = 0
  return { title: source.title, author: source.author, pages: text.split(separator).map(page => page.replace(/^[\r\n]+|[\r\n]+$/g, '')), toc: [] }
}

function docxPayload(source: WordToBokSource): BokBuildPayload {
  const loaded = loadBookFromBuffer(source.data)
  const pages = loaded.pages.map(page => page.paragraphs.map(paragraph => paragraph.text).filter(Boolean).join('\n'))
  const toc: BokTreeEntry[] = []
  const seen = new Set<string>()
  loaded.pages.forEach((page, pageIndex) => {
    for (const paragraph of page.paragraphs) {
      const title = paragraph.text.trim()
      if (!title) continue
      const outline = paragraph.outlineLevel
      if (outline != null && outline >= 0 && outline <= 8) {
        const key = `${pageIndex + 1}|${outline}|${title}`
        if (!seen.has(key)) { seen.add(key); toc.push({ id: pageIndex + 1, title, level: outline + 1, parent: 0 }) }
      }
    }
  })
  if (!toc.length) {
    for (const paragraph of loaded.model.paragraphs) {
      if (!paragraph.toc?.entry) continue
      const page = Math.max(1, Number(paragraph.toc.pageNum) || 1)
      const level = Math.max(1, Number(paragraph.styleId?.match(/^TOC(\d+)$/i)?.[1]) || 1)
      const title = paragraph.toc.entry.trim()
      const key = `${page}|${level}|${title}`
      if (title && !seen.has(key)) { seen.add(key); toc.push({ id: page, title, level, parent: 0 }) }
    }
  }
  if (!pages.length) throw new Error('لم يُعثر على صفحات نصية في ملف Word')
  return { title: source.title, author: source.author, pages, toc }
}

export function prepareWordToBok(source: WordToBokSource): BokBuildPayload {
  return legacyPayload(source) ?? docxPayload(source)
}

export async function convertWordToBok(source: WordToBokSource): Promise<{ data: Uint8Array; fileName: string }> {
  const payload = prepareWordToBok(source)
  const response = await fetch('/api/convert/word-to-bok', {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload),
  })
  if (!response.ok) {
    let message = 'تعذّر تحويل Word إلى BOK'
    try { message = (await response.json() as { error?: string }).error ?? message } catch { /* non-JSON */ }
    throw new Error(message)
  }
  const safeTitle = source.title.replace(/[\\/:*?"<>|]/g, '-').trim() || 'كتاب'
  return { data: new Uint8Array(await response.arrayBuffer()), fileName: `${safeTitle}.bok` }
}
