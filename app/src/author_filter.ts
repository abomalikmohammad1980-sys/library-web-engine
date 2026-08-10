/** بحث أسماء المؤلفين: لا يخلط كلمات الاستعلام بين الترجمة والكتب والحقول الأخرى. */

export interface AuthorFilterEntry<T> {
  value: T
  name: string
  aliases?: readonly string[]
  bookCount: number
}

export function normalizeArabicAuthorName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, '')
    .replace(/ـ/g, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('ar')
}

export function authorNameMatches(name: string, aliases: readonly string[] | undefined, query: string): boolean {
  const normalizedQuery = normalizeArabicAuthorName(query)
  if (!normalizedQuery) return true
  // هذا مرشح واجهة حي، لا مطابقة هوية للاستيراد: كل جزء مكتوب يجب أن
  // يظهر فورًا، مثل «دع» و«دعا» في «دعامة».
  return [name, ...(aliases ?? [])].some(candidate => normalizeArabicAuthorName(candidate).includes(normalizedQuery))
}

export function filterAuthorEntries<T>(entries: readonly AuthorFilterEntry<T>[], query: string, ownersOnly: boolean): AuthorFilterEntry<T>[] {
  return entries.filter(entry => (!ownersOnly || entry.bookCount > 0) && authorNameMatches(entry.name, entry.aliases, query))
}

export function nextAuthorVisibleCount(current: number, total: number, batchSize = 80): number {
  return Math.min(total, Math.max(0, current) + Math.max(1, batchSize))
}
