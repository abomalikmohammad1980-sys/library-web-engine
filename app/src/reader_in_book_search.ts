export interface ReaderPageSearchHit {
  pageIndex: number
  pageNumber: number
  occurrence: number
  offset: number
  endOffset: number
  text: string
}

export function nextReaderSearchIndex(current: number, total: number, delta: -1 | 1): number {
  if (total <= 0) return -1
  if (current < 0) return delta === 1 ? 0 : total - 1
  return ((current + delta) % total + total) % total
}

function normalizeReaderArabicSearch(value: string): ReturnType<typeof normalizeArabicSearchWithMap> {
  // كتب BOK وWord القديمة تمزج الياء/الكاف العربية والفارسية. الاستبدال
  // واحد لواحد، لذلك تبقى خريطة موضع النص الأصلي صحيحة للإبراز.
  return normalizeArabicSearchWithMap(value.replace(/[یېے]/gu, 'ي').replace(/[کڪ]/gu, 'ك'))
}

/** نواة حتمية خفيفة: تبحث في نصوص كل الصفحات، بما فيها غير المركبة في DOM. */
export function searchReaderPageTexts(pages: ReadonlyArray<{ text: string; pageNumber?: number }>, query: string): ReaderPageSearchHit[] {
  const q = normalizeReaderArabicSearch(query).text
  if (!q) return []
  const matches: ReaderPageSearchHit[] = []
  pages.forEach((page, pageIndex) => {
    const normalized=normalizeReaderArabicSearch(page.text);let offset = 0
    let occurrence = 0
    while ((offset = normalized.text.indexOf(q, offset)) >= 0) {
      matches.push({ pageIndex, pageNumber: page.pageNumber ?? pageIndex + 1, occurrence, offset:normalized.originalOffsets[offset]??0, endOffset:(normalized.originalOffsets[offset + q.length - 1]??0)+1, text: page.text })
      occurrence++
      offset += Math.max(1, q.length)
    }
  })
  return matches
}
import { normalizeArabicSearchWithMap } from '../../packages/search/src/index'

/** Mark the same normalized occurrence that search found, even across inline elements. */
export function markReaderSearchOccurrence(root: HTMLElement, query: string, occurrence: number): HTMLElement | undefined {
  root.querySelectorAll('mark.reader-search-mark').forEach(mark => mark.replaceWith(...mark.childNodes))
  root.normalize()
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const nodes: Array<{ node: Text; start: number; end: number }> = []
  let text = '', node: Node | null
  while ((node = walker.nextNode())) {
    const start = text.length
    text += node.textContent ?? ''
    nodes.push({ node: node as Text, start, end: text.length })
  }
  const hit = searchReaderPageTexts([{ text }], query)[occurrence]
  if (!hit) return
  let first: HTMLElement | undefined
  for (const entry of nodes) {
    const start = Math.max(entry.start, hit.offset), end = Math.min(entry.end, hit.endOffset)
    if (end <= start) continue
    const range = document.createRange()
    range.setStart(entry.node, start - entry.start)
    range.setEnd(entry.node, end - entry.start)
    const mark = document.createElement('mark')
    mark.className = 'reader-search-mark'
    range.surroundContents(mark)
    first ??= mark
  }
  return first
}
