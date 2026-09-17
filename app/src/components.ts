import type { Book } from './data'
import { h, type Child } from './ui'
import { authorLink } from './taxonomy_links'
import { bindBookDisplayTitle } from './book_locale_display'

export function bookCard(book: Book & { authorId?: string }): HTMLElement {
  const card = h('article', { class: 'book-card' })
  card.appendChild(bindBookDisplayTitle(h('a', { class: 'book-card__cover', dataset: { noTranslate: '' }, href: `#/reader/${book.id}` }, book.title), book.id, book.title))
  card.appendChild(bindBookDisplayTitle(h('a', { class: 'book-card__title', dataset: { noTranslate: '' }, href: `#/reader/${book.id}` }, book.title), book.id, book.title))
  card.appendChild(authorLink(book.author, 'book-card__author', book.authorId))
  card.appendChild(h('span', { class: 'book-card__meta' }, 'docx · محرك المشهد'))
  return card
}

export function sectionHeader(title: string, action?: string, id?: string, href = '#/browse'): HTMLElement {
  const header = h('div', { class: 'section-header' })
  header.appendChild(h('h2', id ? { id } : null, title))
  if (action) header.appendChild(h('a', { href }, action))
  return header
}

export function pageContent(...children: Child[]): HTMLElement {
  return h('div', { class: 'app-main__inner' }, ...children)
}
