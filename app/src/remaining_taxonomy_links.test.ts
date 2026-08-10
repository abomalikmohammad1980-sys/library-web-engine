import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('remaining taxonomy destinations', () => {
  it('links the book category eyebrow and separates quote book/author destinations', () => {
    const book = readFileSync(new URL('./screens/book.ts', import.meta.url), 'utf8')
    const home = readFileSync(new URL('./screens/home.ts', import.meta.url), 'utf8')
    expect(book).toContain("book.category ? categoryLink(book.category) : 'كتاب في الخزانة'")
    expect(home).toContain("class: 'daily-quote__source'")
    expect(home).toContain("h('a', { href: `#/reader/${book.id}` }, book.title)")
    expect(home).toContain('authorLink(book.author)')
  })
})
