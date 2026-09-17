export interface SeriesBook { id: string; title: string; author: string; seriesName?: string; seriesOrder?: number }
export interface BookSeries { name: string; books: SeriesBook[] }
const key = (value: string): string => value.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ar')
export function groupBookSeries(books: readonly SeriesBook[]): BookSeries[] {
  const groups = new Map<string, BookSeries>()
  for (const book of books) { if (!book.seriesName?.trim()) continue; const normalized = key(book.seriesName); const group = groups.get(normalized) ?? { name: book.seriesName.trim(), books: [] }; group.books.push(book); groups.set(normalized, group) }
  return [...groups.values()].map(group => ({ ...group, books: group.books.sort((a, b) => (a.seriesOrder ?? Number.MAX_SAFE_INTEGER) - (b.seriesOrder ?? Number.MAX_SAFE_INTEGER) || a.title.localeCompare(b.title, 'ar')) })).sort((a, b) => a.name.localeCompare(b.name, 'ar'))
}
