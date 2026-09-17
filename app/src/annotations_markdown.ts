import type { ReaderAnnotations } from './annotation_store'

export interface AnnotationBookMeta { title: string; author?: string }

function clean(value: string): string {
  return value.replace(/[\u202A-\u202E\u2066-\u2069]/g, '').replace(/\r?\n/g, ' ').replace(/\s+/g, ' ').replace(/[\\`*_{}\[\]()#+.!<>|-]/g, '\\$&').trim().slice(0, 100_000)
}

export function annotationsMarkdown(state: ReaderAnnotations, books: ReadonlyMap<string, AnnotationBookMeta>): string {
  const groups = new Map<string, Array<{ page: number; kind: string; text: string }>>()
  const add = (bookId: string, pageIndex: number, kind: string, text: string): void => {
    groups.set(bookId, [...(groups.get(bookId) ?? []), { page: pageIndex + 1, kind, text: clean(text) }])
  }
  state.notes.forEach(item => add(item.bookId, item.pageIndex, 'ملاحظة', item.text))
  state.highlights.forEach(item => {add(item.bookId, item.pageIndex, 'تظليل', item.text);if(item.comment)add(item.bookId,item.pageIndex,'تعليق شخصي على التظليل',item.comment)})
  for (const [bookId, pages] of Object.entries(state.bookmarks)) pages.forEach(page => add(bookId, page, 'علامة', 'موضع محفوظ'))
  const lines = ['# ذاكرة القراءة — الخِزانة', '']
  for (const [bookId, items] of [...groups].sort((a, b) => (books.get(a[0])?.title ?? a[0]).localeCompare(books.get(b[0])?.title ?? b[0], 'ar'))) {
    const meta = books.get(bookId)
    lines.push(`## ${clean(meta?.title ?? 'كتاب محفوظ')}`, ...(meta?.author ? [`_المؤلف: ${clean(meta.author)}_`] : []), '')
    for (const item of items.sort((a, b) => a.page - b.page || a.kind.localeCompare(b.kind, 'ar'))) lines.push(`- **${item.kind} — صفحة ${item.page}:** ${item.text}`)
    lines.push('')
  }
  return `${lines.join('\n').trimEnd()}\n`
}
