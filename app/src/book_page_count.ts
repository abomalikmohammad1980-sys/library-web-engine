export interface BookPageCountSource {
  physicalPageCount?: number
  readerPageCount?: number
  wordPageMap?: { totalPages: number; pages?: readonly unknown[] }
}

const KEY_PREFIX = 'alkhizana:reader-page-count:'

export function cachedReaderPageCount(bookId: string): number | undefined {
  try {
    const value = Number(localStorage.getItem(`${KEY_PREFIX}${bookId}`))
    return Number.isInteger(value) && value > 0 ? value : undefined
  } catch { return undefined }
}

export function cacheReaderPageCount(bookId: string, count: number): void {
  if (!bookId || !Number.isInteger(count) || count < 1) return
  try { localStorage.setItem(`${KEY_PREFIX}${bookId}`, String(count)) } catch { /* IndexedDB remains authoritative */ }
}

export function clearCachedReaderPageCount(bookId: string): void {
  try { localStorage.removeItem(`${KEY_PREFIX}${bookId}`) } catch { /* no browser storage */ }
}

export function bookPageCount(book: BookPageCountSource, cachedCount?: number): number {
  const rendered = Number(cachedCount ?? book.physicalPageCount ?? book.readerPageCount)
  if (Number.isInteger(rendered) && rendered > 0) return rendered
  const mapped = Number(book.wordPageMap?.totalPages)
  if (Number.isInteger(mapped) && mapped > 0) return mapped
  return book.wordPageMap?.pages?.length ?? 0
}

export function wordPageMaximum(book: BookPageCountSource): number {
  const starts = (book.wordPageMap as { starts?: Array<{ adjustedPage?: number }> } | undefined)?.starts ?? []
  return Math.max(0, Number(book.wordPageMap?.totalPages) || 0, ...starts.map(item => Number(item.adjustedPage) || 0))
}
