export interface QualityBook { id: string; title: string; author: string; category?: string; contemporary?: boolean; deathYearHijri?: number; publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number; seriesName?: string; seriesOrder?: number }
export type QualityIssueKind = 'identity' | 'classification' | 'edition' | 'series'
export interface QualityIssue { id: string; bookId: string; bookTitle: string; kind: QualityIssueKind; severity: 'high' | 'medium'; message: string }
export function auditLibraryData(books: readonly QualityBook[]): QualityIssue[] {
  const issues: QualityIssue[] = [], add = (book: QualityBook, kind: QualityIssueKind, severity: QualityIssue['severity'], message: string): void => { issues.push({ id: `${book.id}:${kind}:${message}`, bookId: book.id, bookTitle: book.title, kind, severity, message }) }
  for (const book of books) {
    if (!book.title.trim() || !book.author.trim()) add(book, 'identity', 'high', 'العنوان أو المؤلف مفقود')
    if (!book.contemporary && !(Number(book.deathYearHijri) > 0)) add(book, 'identity', 'high', 'حالة المؤلف أو سنة الوفاة غير موثقة')
    if (!book.category?.trim()) add(book, 'classification', 'medium', 'الكتاب غير مصنف')
    if (![book.publisher, book.edition, book.investigator, book.publicationYearHijri].some(Boolean)) add(book, 'edition', 'medium', 'لا توجد بيانات ناشر أو طبعة أو محقق أو سنة نشر')
    if (book.seriesName?.trim() && !(Number(book.seriesOrder) > 0)) add(book, 'series', 'medium', 'اسم السلسلة موجود بلا ترتيب')
  }
  const orders = new Map<string, QualityBook[]>()
  for (const book of books) if (book.seriesName?.trim() && Number(book.seriesOrder) > 0) { const key = `${book.seriesName.trim().toLocaleLowerCase('ar')}\0${book.seriesOrder}`; orders.set(key, [...(orders.get(key) ?? []), book]) }
  for (const duplicates of orders.values()) if (duplicates.length > 1) for (const book of duplicates) add(book, 'series', 'high', `ترتيب السلسلة ${book.seriesOrder} مكرر`)
  return issues.sort((a, b) => (a.severity === b.severity ? a.bookTitle.localeCompare(b.bookTitle, 'ar') : a.severity === 'high' ? -1 : 1))
}
