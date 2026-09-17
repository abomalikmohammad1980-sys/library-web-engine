export async function persistCompletedReaderPageCount(
  bookId: string,
  pageCount: number,
  persist: (id: string, count: number) => Promise<void>,
): Promise<number> {
  if (!bookId || bookId === 'upload' || bookId === 'hadith-1' || !Number.isInteger(pageCount) || pageCount < 1) return pageCount
  await persist(bookId, pageCount)
  return pageCount
}
