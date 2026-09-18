/** Preserve the first eighteen eligible passages without normalizing an entire book. */
export function homeQuoteCandidates(books: readonly {
  id: string
  readerModel?: { paragraphs: readonly { text: string }[] }
}[]): { text: string; bookId: string }[] {
  const result: { text: string; bookId: string }[] = []
  for (const book of books) {
    let count = 0
    for (const paragraph of book.readerModel?.paragraphs ?? []) {
      const text = paragraph.text.replace(/\s+/g, ' ').trim()
      if (text.length < 55 || text.length > 240) continue
      result.push({ text, bookId: book.id })
      if (++count === 18) break
    }
  }
  return result
}
