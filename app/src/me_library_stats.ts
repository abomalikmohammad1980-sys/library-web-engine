import type { StoredBook } from './engine/library_store'
import { effectiveBookCategory } from './taxonomy_links'

export interface LibraryStatRow { label: string; count: number; centuryDisplay?: { ordinal: string; gregorianRange: string } }

const validDeathYear = (value: unknown): value is number =>
  Number.isFinite(value) && Number(value) >= 1 && Number(value) < 10_000

type ChronologyBook=Pick<StoredBook,'deathYearHijri'> & Partial<Pick<StoredBook,'contemporary'|'author'|'authorId'>>
export function hijriCenturyGregorianRange(century:number):string {
  // Civil Islamic calendar: find the Gregorian years containing the first and last day.
  const calendar=new Intl.DateTimeFormat('en-u-ca-islamic-civil-nu-latn',{year:'numeric',timeZone:'UTC'})
  const start=(year:number)=>{let lo=Date.UTC(600,0,1)/86400000,hi=Date.UTC(2200,0,1)/86400000;while(lo<hi){const mid=Math.floor((lo+hi)/2),value=Number(calendar.formatToParts(new Date(mid*86400000)).find(p=>p.type==='year')?.value);if(value<year)lo=mid+1;else hi=mid}return lo}
  return `${new Date(start((century-1)*100+1)*86400000).getUTCFullYear()} – ${new Date((start(century*100+1)-1)*86400000).getUTCFullYear()}`
}
export function libraryCenturyRows(books: readonly ChronologyBook[]): LibraryStatRow[] {
  const counts = Array.from({ length: 15 }, () => 0)
  let contemporary=0,unknown=0,undated=0,outside=0
  for (const book of books) {
    if (!validDeathYear(book.deathYearHijri)) {if(book.contemporary)contemporary++;else if(!book.author?.trim()||/^(?:مجهول|مؤلف مجهول|غير معروف)$/.test(book.author.trim())||book.deathYearHijri===99999)unknown++;else undated++;continue}
    const century = Math.ceil(book.deathYearHijri / 100)
    if (century >= 1 && century <= counts.length) counts[century - 1] = (counts[century - 1] ?? 0) + 1
    else outside++
  }
  return [{label:'كتب معاصرة',count:contemporary},{label:'مؤلف مجهول',count:unknown},...counts.map((count, index) => {
    const ordinal=ordinalCentury(index+1),gregorianRange=hijriCenturyGregorianRange(index+1)
    return { label: `القرن ${ordinal} الهجري (الموافق: ${gregorianRange} م)`, count, centuryDisplay:{ordinal,gregorianRange} }
  }),...(undated?[{label:'مؤلف معلوم، وفاة غير موثقة',count:undated}]:[]),...(outside?[{label:'خارج القرون المعروضة',count:outside}]:[])]
}

export function libraryTopCategoryRows(books: readonly Pick<StoredBook, 'category' | 'categoryOverride'>[], limit = 10): LibraryStatRow[] {
  const counts = new Map<string, number>()
  for (const book of books) {
    const category = effectiveBookCategory(book)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, 'ar'))
    .slice(0, Math.max(0, limit))
}

export function libraryDatedBookCount(books: readonly Pick<StoredBook, 'deathYearHijri'>[]): number {
  return books.reduce((count, book) => count + (validDeathYear(book.deathYearHijri) ? 1 : 0), 0)
}

function ordinalCentury(value: number): string {
  return ['', 'الأول', 'الثاني', 'الثالث', 'الرابع', 'الخامس', 'السادس', 'السابع', 'الثامن', 'التاسع', 'العاشر', 'الحادي عشر', 'الثاني عشر', 'الثالث عشر', 'الرابع عشر', 'الخامس عشر'][value] ?? String(value)
}
