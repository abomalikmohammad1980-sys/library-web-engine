export interface RecommendationBook { id: string; title: string; author: string; category?: string; addedAt: number }
export interface ReadingRecommendation<T extends RecommendationBook = RecommendationBook> { book: T; reason: string; score: number }

const UNKNOWN_AUTHORS = new Set(['غير معروف', 'مؤلف غير معروف', 'مجهول', 'غير محدد', 'unknown', 'unknown author'])
export function meaningfulRecommendationAuthor(author?: string): string | undefined {
  const value = author?.trim().replace(/\s+/g, ' ')
  return value && !UNKNOWN_AUTHORS.has(value.toLocaleLowerCase('ar')) ? value : undefined
}

export function recommendUnreadBooks<T extends RecommendationBook>(books: readonly T[], openedBookIds: readonly string[], openCounts: Readonly<Record<string, number>>, limit = 4): ReadingRecommendation<T>[] {
  const byId = new Map(books.map(book => [book.id, book]))
  const opened = new Set(openedBookIds)
  const categories = new Map<string, number>(), authors = new Map<string, number>()
  for (const id of opened) {
    const book = byId.get(id); if (!book) continue
    const weight = Math.max(1, openCounts[id] ?? 1)
    if (book.category?.trim()) categories.set(book.category, (categories.get(book.category) ?? 0) + weight)
    const author = meaningfulRecommendationAuthor(book.author)
    if (author) authors.set(author, (authors.get(author) ?? 0) + weight)
  }
  return books.filter(book => !opened.has(book.id)).map(book => {
    const category = book.category ? categories.get(book.category) ?? 0 : 0
    const authorName = meaningfulRecommendationAuthor(book.author)
    const author = authorName ? authors.get(authorName) ?? 0 : 0
    return { book, score: category * 3 + author * 2, reason: author ? `لأنك قرأت للمؤلف ${authorName}` : category ? `لأنك تقرأ في ${book.category}` : 'من أحدث كتب خزانتك' }
  }).sort((a, b) => b.score - a.score || b.book.addedAt - a.book.addedAt || a.book.title.localeCompare(b.book.title, 'ar')).slice(0, Math.max(0, limit))
}
