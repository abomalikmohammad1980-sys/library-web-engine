import {effectiveBookCategory,canonicalBookCategory,LEGACY_UNCATEGORIZED_LABEL} from './taxonomy_links'
import type {StoredBook} from './engine/library_store'
import {normalizeArabicAuthorName} from './author_filter'

type WorkBook = {id:string;title:string;category?:string}
export function mergeAuthorWorkBooks(indexed:readonly WorkBook[],local:readonly (WorkBook & {categoryOverride?:StoredBook['categoryOverride']})[]):WorkBook[]{
  const authoritative=new Map(indexed.map(book=>[book.id,book]))
  const merged=new Map(indexed.map(book=>[book.id,{...book}]))
  for(const book of local){
    const effective=effectiveBookCategory(book),fallback=canonicalBookCategory(authoritative.get(book.id)?.category)
    merged.set(book.id,{id:book.id,title:book.title,category:effective===LEGACY_UNCATEGORIZED_LABEL&&fallback?fallback:effective})
  }
  return [...merged.values()]
}

export interface AuthorWorkGroupInput {
  id?: string
  title: string
  category?: string
  available: boolean
}

export interface AuthorWorkGroup {
  category: string
  works: AuthorWorkGroupInput[]
}

const UNKNOWN_CATEGORY = 'غير مصنف'
const LISTED_CATEGORY = 'مؤلفات أخرى'

function normalizedCategory(work: AuthorWorkGroupInput): string {
  if (!work.available) return LISTED_CATEGORY
  return canonicalBookCategory(work.category) || UNKNOWN_CATEGORY
}

export function groupAuthorWorksByCategory(works: readonly AuthorWorkGroupInput[]): AuthorWorkGroup[] {
  const groups = new Map<string, AuthorWorkGroupInput[]>()
  const availableTitles=new Set(works.filter(work=>work.available&&work.id).map(work=>normalizeArabicAuthorName(work.title)))
  for (const work of works) {
    if(!work.available&&availableTitles.has(normalizeArabicAuthorName(work.title)))continue
    const category = normalizedCategory(work)
    const current = groups.get(category) ?? []
    current.push(work)
    groups.set(category, current)
  }
  return [...groups.entries()]
    .sort(([a], [b]) => {
      if (a === LISTED_CATEGORY) return 1
      if (b === LISTED_CATEGORY) return -1
      if (a === UNKNOWN_CATEGORY) return 1
      if (b === UNKNOWN_CATEGORY) return -1
      return a.localeCompare(b, 'ar')
    })
    .map(([category, entries]) => ({
      category,
      works: [...entries].sort((a, b) => a.title.localeCompare(b.title, 'ar')),
    }))
}
