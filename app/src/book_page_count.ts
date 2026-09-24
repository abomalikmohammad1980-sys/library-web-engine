export interface BookPageCountSource {
  sourceFormat?:string
  physicalPageCount?: number
  readerPageCount?: number
  wordPageMap?: { totalPages: number; pages?: readonly unknown[] }
  bokPages?: ReadonlyArray<{ part?: number }>
  volumes?: readonly unknown[]
  parts?: readonly unknown[]
  volumeCount?: number
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
  if (book.bokPages?.length) return book.bokPages.length
  const rendered = Number(cachedCount ?? book.physicalPageCount ?? book.readerPageCount)
  if (Number.isInteger(rendered) && rendered > 0) return rendered
  const mapped = Number(book.wordPageMap?.totalPages)
  if (Number.isInteger(mapped) && mapped > 0) return mapped
  return book.wordPageMap?.pages?.length ?? 0
}

export function bookVolumeCount(book: BookPageCountSource): number {
  if(book.sourceFormat==='jpeg')return 1 // image source files are pages, not printed volumes
  if (book.bokPages?.length) {
    const parts = new Set(book.bokPages.map(page => Number(page.part)).filter(part => Number.isInteger(part) && part > 0))
    if (parts.size) return parts.size
  }
  const derived = book.volumes?.length ?? book.parts?.length ?? Number(book.volumeCount)
  return Number.isInteger(derived) && derived > 0 ? derived : 1
}

export function wordPageMaximum(book: BookPageCountSource): number {
  const starts = (book.wordPageMap as { starts?: Array<{ adjustedPage?: number }> } | undefined)?.starts ?? []
  return Math.max(0, Number(book.wordPageMap?.totalPages) || 0, ...starts.map(item => Number(item.adjustedPage) || 0))
}
