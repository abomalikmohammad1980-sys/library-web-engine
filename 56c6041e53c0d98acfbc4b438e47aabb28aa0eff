import { h } from './ui'
import type { BookAuthorRef, StoredBook } from './engine/library_store'

export const UNCATEGORIZED_CATEGORY = '__uncategorized__'

export function categoryQueryValue(category?: string | null): string {
  return category?.trim() ? category.trim() : UNCATEGORIZED_CATEGORY
}

export function matchesCategoryFilter(category: string | undefined, filter: string): boolean {
  if (!filter) return true
  if (filter === UNCATEGORIZED_CATEGORY) return !category?.trim()
  return category === filter
}

export function authorHref(author: string): string {
  return `#/author/${encodeURIComponent(author || 'غير معروف')}`
}

export function categoryHref(category?: string | null): string {
  return `#/library?category=${encodeURIComponent(categoryQueryValue(category))}`
}

export function authorLink(author?: string, className?: string): HTMLAnchorElement {
  const value = author?.trim() || 'مؤلف غير معروف'
  return h('a', { href: authorHref(author?.trim() || 'غير معروف'), ...(className ? { class: className } : {}) }, value) as HTMLAnchorElement
}

export function bookAuthorRefs(book: Pick<StoredBook, 'author' | 'authorId' | 'authors'>): BookAuthorRef[] {
  const source = book.authors?.length ? book.authors : [{ name: book.author, ...(book.authorId ? { id: book.authorId } : {}) }]
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
    ...authors.flatMap((author, index) => [index ? document.createTextNode('، ') : document.createTextNode(''), authorLink(author.name)]),
  )
}

export function categoryLink(category: string, className?: string): HTMLAnchorElement {
  return h('a', { href: categoryHref(category), ...(className ? { class: className } : {}) }, category) as HTMLAnchorElement
}
