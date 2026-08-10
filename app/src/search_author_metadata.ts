import { canonicalAuthorName, type StoredAuthor, type StoredBook } from './engine/library_store'

export interface SearchAuthorChronology { deathYearHijri?: number; contemporary?: boolean }

/** يكمّل زمن المؤلف من سجله المعياري إذا لم تكن النسخة القديمة للكتاب تحمله. */
export function searchAuthorChronology(book: StoredBook, authors: StoredAuthor[]): SearchAuthorChronology {
  const canonical = canonicalAuthorName(book.author)
  const record = authors.find(author => author.id === book.authorId
    || author.canonicalName === canonical
    || author.aliases.some(alias => canonicalAuthorName(alias) === canonical))
  const deathYearHijri = book.deathYearHijri ?? record?.deathYearHijri
  const contemporary = book.contemporary ?? record?.contemporary
  return {
    ...(deathYearHijri === undefined ? {} : { deathYearHijri }),
    ...(contemporary === undefined ? {} : { contemporary }),
  }
}
