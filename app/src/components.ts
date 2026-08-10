import type { Book } from './data'
import { h, type Child } from './ui'
import { authorLink } from './taxonomy_links'

export function bookCard(book: Book): HTMLElement {
  const card = h('article', { class: 'book-card' })
  card.appendChild(h('a', { class: 'book-card__cover', href: `#/reader/${book.id}` }, book.title))
  card.appendChild(h('a', { class: 'book-card__title', href: `#/reader/${book.id}` }, book.title))
  card.appendChild(authorLink(book.author, 'book-card__author'))
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
