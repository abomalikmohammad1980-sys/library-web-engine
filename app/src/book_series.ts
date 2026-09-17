import { compareBooksByAuthorDeath, type OrderableBook } from './book_ordering'
import type { StoredBook } from './engine/library_store'

export interface SeriesBook extends OrderableBook {
  seriesName?: string
  seriesOrder?: number
  authorId?: string
  category?: string
  categoryOverride?: StoredBook['categoryOverride']
}
export interface BookSeries { name: string; books: SeriesBook[] }
const key = (value: string): string => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ar')
export function groupBookSeries(books: readonly SeriesBook[]): BookSeries[] {
  const groups = new Map<string, BookSeries>()
  for (const book of books) { if (!book.seriesName?.trim()) continue; const normalized = key(book.seriesName); const group = groups.get(normalized) ?? { name: book.seriesName.trim(), books: [] }; group.books.push(book); groups.set(normalized, group) }
  return [...groups.values()].map(group => ({ ...group, books: group.books.sort((a, b) => (a.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.seriesOrder ?? Number.MAX_SAFE_INTEGER) || compareBooksByAuthorDeath(a, b)) })).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}
