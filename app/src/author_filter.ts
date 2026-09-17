/** بحث أسماء المؤلفين: لا يخلط كلمات الاستعلام بين الترجمة والكتب والحقول الأخرى. */

export interface AuthorFilterEntry<T> {
  value: T
  name: string
  aliases?: readonly string[]
  bookCount: number
  hasBooks?: boolean
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
  return entries.filter(entry => (!ownersOnly || (entry.hasBooks ?? entry.bookCount > 0)) && authorNameMatches(entry.name, entry.aliases, query))
}

export function nextAuthorVisibleCount(current: number, total: number, batchSize = 100): number {
  return Math.min(total, Math.max(0, current) + Math.max(1, batchSize))
}

export const UNKNOWN_AUTHOR_DEATH_SENTINEL = 99999

export function isUnknownAuthorDeathYear(value: number | undefined | null): boolean {
  return value === UNKNOWN_AUTHOR_DEATH_SENTINEL
}

export function displayableAuthorDeathYear(value: number | undefined | null): number | undefined {
  return Number.isInteger(value) && value! > 0 && value! <= currentHijriYear() && !isUnknownAuthorDeathYear(value) ? value! : undefined
}
let calendarCache:{day:string;year:number}|undefined
export function currentHijriYear():number {
  // Calendar-labelled fields only. No inference/conversion from a bare Gregorian number.
  const now=new Date(),day=now.toISOString().slice(0,10)
  if(calendarCache?.day!==day)calendarCache={day,year:Number(new Intl.DateTimeFormat('en-u-ca-islamic-nu-latn',{year:'numeric'}).formatToParts(now).find(part=>part.type==='year')?.value)||0}
  return calendarCache.year
}
export type AuthorDirectorySort = 'death-asc' | 'death-desc' | 'name'

/** يرتب تاريخًا موثقًا فقط؛ السجل بلا وفاة يبقى أخيرًا في الاتجاهين. */
export function sortAuthorDirectoryEntries<T>(entries: readonly T[], mode: AuthorDirectorySort, authorOf: (entry: T) => { name: string; deathYearHijri?: number }): T[] {
  return [...entries].sort((leftEntry, rightEntry) => {
    const left = authorOf(leftEntry), right = authorOf(rightEntry)
    if (mode === 'name') return left.name.localeCompare(right.name, 'ar')
    const leftDeath = displayableAuthorDeathYear(left.deathYearHijri)
    const rightDeath = displayableAuthorDeathYear(right.deathYearHijri)
    const leftKnown = leftDeath != null
    const rightKnown = rightDeath != null
    if (leftKnown !== rightKnown) return leftKnown ? -1 : 1
    if (!leftKnown) return left.name.localeCompare(right.name, 'ar')
    const chronology = mode === 'death-desc'
      ? rightDeath! - leftDeath!
      : leftDeath! - rightDeath!
    return chronology || left.name.localeCompare(right.name, 'ar')
  })
}
