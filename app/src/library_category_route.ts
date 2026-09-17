import { BOOK_CATEGORIES } from './library_metadata'
import { UNCATEGORIZED_CATEGORY, LEGACY_UNCATEGORIZED_LABEL } from './taxonomy_links'
import {canonicalSubjectCategory} from './subject_categories'

export const INVALID_LIBRARY_CATEGORY = '__invalid_library_category__'

export interface LibraryCategoryRoute {
  requested: boolean
  valid: boolean
  value: string
}

function normalizedCategory(value: string): string {
  let decoded = value
  if (/%[0-9a-f]{2}/iu.test(value)) {
    try { decoded = decodeURIComponent(value) } catch { /* URLSearchParams already fails closed. */ }
  }
  return decoded.normalize('NFC').trim().replace(/\s+/gu, ' ')
}


/** يحول معامل category إلى قيمة موثوقة، ولا يحول المجهول إلى «كل الكتب». */
export function libraryCategoryRoute(params: URLSearchParams): LibraryCategoryRoute {
  if (!params.has('category')) return { requested: false, valid: true, value: '' }
  const raw = params.get('category') ?? ''
  if (!raw.trim()) return { requested: false, valid: true, value: '' }
  const normalized = normalizedCategory(raw)
  if (normalized === UNCATEGORIZED_CATEGORY || normalized === LEGACY_UNCATEGORIZED_LABEL) return { requested: true, valid: true, value: UNCATEGORIZED_CATEGORY }
  const resolved=canonicalSubjectCategory(normalized)
  const canonical = BOOK_CATEGORIES.includes(resolved)?resolved:undefined
  return canonical
    ? { requested: true, valid: true, value: canonical }
    : { requested: true, valid: false, value: INVALID_LIBRARY_CATEGORY }
}
