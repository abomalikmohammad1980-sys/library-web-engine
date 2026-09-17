import {displayableAuthorDeathYear} from './author_filter'
export interface OrderableBook {
  id: string
  title: string
  author: string
  deathYearHijri?: number
  contemporary?: boolean
}

const arabicCompare = (a: string, b: string) => a.localeCompare(b, 'ar', { sensitivity: 'base', numeric: true })
const deathYear = (book: OrderableBook): number => book.contemporary ? Number.POSITIVE_INFINITY : displayableAuthorDeathYear(book.deathYearHijri)??Number.POSITIVE_INFINITY

/** العقد الحتمي العام: الأقدم وفاة، ثم المؤلف، ثم العنوان، ثم المعرّف. */
export function compareBooksByAuthorDeath(a: OrderableBook, b: OrderableBook): number {
  return deathYear(a) - deathYear(b)
    || arabicCompare(a.author, b.author)
    || arabicCompare(a.title, b.title)
    || a.id.localeCompare(b.id, 'en', { numeric: true })
}

/** للقوائم الخاصة: المقياس الأساسي أولًا، وعقد الوفاة هو فاصل التعادل. */
export function compareBooksByMetric<T extends OrderableBook>(metric: (book: T) => number, direction: 'asc' | 'desc' = 'desc') {
  const sign = direction === 'asc' ? 1 : -1
  return (a: T, b: T): number => sign * (metric(a) - metric(b)) || compareBooksByAuthorDeath(a, b)
}

export function orderedBooks<T extends OrderableBook>(books: readonly T[]): T[] {
  return [...books].sort(compareBooksByAuthorDeath)
}

export type BookSort = 'death' | 'author' | 'title' | 'death-desc' | 'author-desc' | 'title-desc'
export const BOOK_SORT_OPTIONS: readonly {value:BookSort;label:string}[] = [
  {value:'death',label:'وفاة المؤلف — الأقدم أولًا'}, {value:'death-desc',label:'وفاة المؤلف — الأحدث أولًا'},
  {value:'author',label:'اسم المؤلف — تصاعديًا'}, {value:'author-desc',label:'اسم المؤلف — تنازليًا'},
  {value:'title',label:'عنوان الكتاب — تصاعديًا'}, {value:'title-desc',label:'عنوان الكتاب — تنازليًا'},
]
export function parseBookSort(value:string|null):BookSort {return BOOK_SORT_OPTIONS.find(option=>option.value===value)?.value??'death'}
/** Only explicitly Hijri dates are chronological; Gregorian-only dates stay unknown. */
export function sortBooks<T extends OrderableBook>(books: readonly T[], order: BookSort = 'death'): T[] {
  return [...books].sort(compareBooks(order))
}
export function compareBooks(order:BookSort='death'):(a:OrderableBook,b:OrderableBook)=>number {
  const direction=order.endsWith('-desc')?-1:1
  return (a,b)=>{
    if(order.startsWith('title'))return direction*arabicCompare(a.title,b.title)||compareBooksByAuthorDeath(a,b)
    if(order.startsWith('author'))return direction*arabicCompare(a.author,b.author)||arabicCompare(a.title,b.title)||a.id.localeCompare(b.id)
    const left=deathYear(a),right=deathYear(b)
    if(Number.isFinite(left)!==Number.isFinite(right))return Number.isFinite(left)?-1:1
    return direction*(left-right)||arabicCompare(a.author,b.author)||arabicCompare(a.title,b.title)||a.id.localeCompare(b.id)
  }
}

export function bookOrdinal(index: number): { number: number; label: string } {
  const number = Math.max(1, Math.trunc(index) + 1)
  return { number, label: `الكتاب ${number}` }
}
