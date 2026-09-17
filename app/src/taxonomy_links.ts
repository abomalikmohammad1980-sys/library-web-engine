import { h } from './ui'
import type { BookAuthorRef, StoredBook } from './engine/library_store'
import { localPeopleHref, peopleHref } from './author_people'
import {canonicalSubjectCategory} from './subject_categories'
import {currentAuthorName,projectBookAuthorNames,bindAuthorDisplayName} from './author_display_names'

export const UNCATEGORIZED_CATEGORY = '__uncategorized__'
export const LEGACY_UNCATEGORIZED_LABEL = 'غير مصنف'

/** أسماء تصنيف قديمة ظهرت في بعض الحزم المنشورة قبل توحيد فهرس الشاملة. */
export function canonicalBookCategory(category?: string | null): string {
  const value = category?.trim() || ''
  return canonicalSubjectCategory(value)
}

export function effectiveBookCategory(book: {
  readonly category?: StoredBook['category'] | null | undefined
  readonly categoryOverride?: StoredBook['categoryOverride'] | null | undefined
}): string {
  const override = book.categoryOverride?.source === 'user' ? canonicalBookCategory(book.categoryOverride.value) : ''
  // Older published records stored the then-default "غير مصنف" as though it
  // were a user choice.  It must never hide a later authoritative category.
  return override && !(override === LEGACY_UNCATEGORIZED_LABEL && book.category?.trim())
    ? override
    : canonicalBookCategory(book.category) || LEGACY_UNCATEGORIZED_LABEL
}

export function categoryQueryValue(category?: string | null): string {
  const value = canonicalBookCategory(category)
  return !value || value === LEGACY_UNCATEGORIZED_LABEL ? UNCATEGORIZED_CATEGORY : value
}

export function matchesCategoryFilter(category: string | undefined, filter: string): boolean {
  if (!filter) return true
  if (filter === UNCATEGORIZED_CATEGORY || filter === LEGACY_UNCATEGORIZED_LABEL) return !category?.trim() || category === LEGACY_UNCATEGORIZED_LABEL
  return canonicalBookCategory(category) === canonicalBookCategory(filter)
}

export function authorHref(author: string): string {
  if(/^central-author:[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(author.trim()))return `#/people/${encodeURIComponent(author.trim())}`
  const shamela = /^(?:(?:local:)?shamela-author-|shamela[:\-])?(\d{1,6})$/u.exec(author.trim())
  if (shamela?.[1]) { const href=peopleHref(shamela[1]); if(href)return href }
  return localPeopleHref(author) ?? '#/authors'
}

/** A people-page link is safe only when the book carries an audited identity.
 * A name on its own remains useful display text but must not create a route that
 * can end at “المؤلف غير موجود”.
 */
export function knownAuthorHref(authorId?: string): string | undefined {
  const identity = authorId?.trim()
  return identity ? authorHref(identity) : undefined
}

export function categoryHref(category?: string | null): string {
  return `#/library?category=${encodeURIComponent(categoryQueryValue(category))}`
}

export function authorLink(author?: string, className?: string, authorId?: string): HTMLAnchorElement | HTMLSpanElement {
  const value = currentAuthorName(authorId,author?.trim() || 'مؤلف غير معروف')
  const href = knownAuthorHref(authorId)
  return bindAuthorDisplayName(href
    ? h('a', { href, dataset: { noTranslate: '' }, ...(className ? { class: className } : {}) }, value)
    : h('span', { dataset: { noTranslate: '' }, ...(className ? { class: className } : {}) }, value),authorId,author?.trim() || 'مؤلف غير معروف')
}

export function bookAuthorRefs(book: Pick<StoredBook, 'author' | 'authorId' | 'authors'>): BookAuthorRef[] {
  book=projectBookAuthorNames(book)
  const primaryName = book.author.trim().toLocaleLowerCase('ar')
  const source = book.authors?.length
    ? book.authors.map(author => !author.id && book.authorId && author.name.trim().toLocaleLowerCase('ar') === primaryName
      ? { ...author, id: book.authorId }
      : author)
    : [{ name: book.author, ...(book.authorId ? { id: book.authorId } : {}) }]
  const seen = new Set<string>()
  return source.filter(author => {
    const key = author.name.trim().toLocaleLowerCase('ar')
    if (!key || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function bookAuthorLinks(book: Pick<StoredBook, 'author' | 'authorId' | 'authors'>, className?: string): HTMLElement {
  const authors = bookAuthorRefs(book)
  return h('span', { class: ['book-author-links', className].filter(Boolean).join(' ') },
    ...authors.flatMap((author, index) => [index ? document.createTextNode('، ') : document.createTextNode(''), authorLink(author.name, undefined, author.id)]),
  )
}

export function categoryLink(category: string, className?: string): HTMLAnchorElement {
  const value=canonicalBookCategory(category)
  return h('a', { href: categoryHref(category), ...(value&&value!==LEGACY_UNCATEGORIZED_LABEL?{dataset:{noTranslate:''}}:{}), ...(className ? { class: className } : {}) }, value) as HTMLAnchorElement
}
