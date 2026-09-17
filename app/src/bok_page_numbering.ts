export interface BokNumberedPage { part: number; page: number }

/**
 * BOK corpora use two numbering conventions: some restart at page 1 for each
 * volume, while others keep one cumulative page counter across all volumes.
 * The reader UI always exposes «part / page», so cumulative later volumes must
 * be converted to a stable volume-local number. The first volume retains its
 * printed number (front matter commonly starts at 5–10 rather than 1).
 */
export function bokLocalPageNumbers(pages: readonly BokNumberedPage[]): number[] {
  const firstPart = pages[0]?.part ?? 1
  const firstPageByPart = new Map<number, number>()
  for (const item of pages) if (!firstPageByPart.has(item.part)) firstPageByPart.set(item.part, item.page)
  return pages.map(item => {
    const first = firstPageByPart.get(item.part) ?? item.page
    if (item.part === firstPart || first <= 10) return item.page
    return Math.max(1, item.page - first + 1)
  })
}
