export interface EditionBook { id: string; title: string; author: string; publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number }
export interface EditionGroup { workTitle: string; books: EditionBook[] }
export function normalizeWorkTitle(title: string): string { return title.normalize('NFKC').replace(/[\u064B-\u065F\u0670ـ]/g, '').replace(/[()[\]{}«»"'،,:؛.!؟/_-]+/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ar') }
export function groupBookEditions(books: readonly EditionBook[]): EditionGroup[] {
  const groups = new Map<string, EditionBook[]>()
  for (const book of books) { const key = normalizeWorkTitle(book.title); if (!key) continue; groups.set(key, [...(groups.get(key) ?? []), book]) }
  return [...groups.values()].filter(group => group.length > 1).map(group => ({ workTitle: group[0]!.title, books: [...group].sort((a, b) => (b.publicationYearHijri ?? 0) - (a.publicationYearHijri ?? 0) || a.title.localeCompare(b.title, 'ar')) })).sort((a, b) => a.workTitle.localeCompare(b.workTitle, 'ar'))
}
