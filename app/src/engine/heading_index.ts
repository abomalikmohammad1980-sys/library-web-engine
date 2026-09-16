import type { StoredBook } from './library_store'
import { inferBookFormat } from '../book_format'

export interface HeadingEntry { value: string; paragraphIndex?: number; pageIndex?: number; pageLabel?: string; partLabel?: string }
export interface HeadingIndex { entries: HeadingEntry[]; complete: boolean }
const cache = new WeakMap<StoredBook, HeadingIndex>()
/** Only source TOC/outline records count as headings; metadata tags are not a TOC. */
export async function headingIndex(book: StoredBook): Promise<HeadingIndex> {
 const previous = cache.get(book); if (previous) return previous
 let result: HeadingIndex = { entries: [], complete: false }
 if (book.bokToc !== undefined) {
  const pages = new Map((book.bokPages ?? []).map((page, pageIndex) => [page.id, { page, pageIndex }]))
  result = { complete: true, entries: book.bokToc.filter(entry => entry.title.trim()).map(entry => {
   const found = pages.get(entry.id)
   return { value: entry.title, ...(found ? { pageIndex: found.pageIndex, pageLabel: String(found.page.page), partLabel: String(found.page.part) } : {}) }
  }) }
 } else if (book.textToc !== undefined) {
  result = { complete: true, entries: book.textToc.filter(entry => entry.title.trim()).map(entry => ({ value: entry.title, paragraphIndex: entry.paragraphIndex })) }
 } else if (book.data?.length && inferBookFormat(book) === 'pdf') {
  try { result=await (await import('../pdf_heading_index')).pdfHeadingIndex(book.data) }
  catch { /* A failed read must remain incomplete and retryable. */ }
 } else if (book.data?.length && inferBookFormat(book) === 'word') {
  try {
   const {extractFromDocx}=await import('@engine/ooxml-model')
   const paragraphs = extractFromDocx(book.data).paragraphs
   const toc = paragraphs.flatMap((paragraph, paragraphIndex) => paragraph.toc?.entry?.trim() ? [{ value: paragraph.toc.entry, paragraphIndex, ...(paragraph.toc.pageNum ? { pageLabel: paragraph.toc.pageNum } : {}) }] : [])
   result = { complete: true, entries: toc.length ? toc : paragraphs.flatMap((paragraph, paragraphIndex) => {
    if (paragraph.outlineLevel == null || paragraph.outlineLevel < 0 || paragraph.outlineLevel > 8) return []
    const value = paragraph.runs.map(run => run.text).join('').trim()
    return value ? [{ value, paragraphIndex }] : []
   }) }
  } catch { /* Source absent/unreadable is incomplete, never a fabricated empty TOC. */ }
 }
 // An unloaded source or transient parser failure must not poison this book
 // object for the remainder of the session; a later hydration can supply TOC.
 if(result.complete)cache.set(book, result); return result
}
