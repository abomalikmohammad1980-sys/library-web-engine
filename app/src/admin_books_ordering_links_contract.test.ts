import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { orderedBooks } from './book_ordering'

const screen=readFileSync(new URL('./screens/admin_books.ts',import.meta.url),'utf8')

describe('published admin book list ordering, numbering, and links',()=>{
  it('orders central books by author death before rendering them',()=>{
    const books=[
      {id:'late',title:'ألف',author:'متأخر',deathYearHijri:900},
      {id:'early',title:'باء',author:'متقدم',deathYearHijri:200},
    ]
    expect(orderedBooks(books).map(book=>book.id)).toEqual(['early','late'])
    expect(screen).not.toContain('listBooks()')
  })
  it('numbers rows and exposes independent book, author, and category links without covering edit controls',()=>{
    expect(screen).toContain('adminRow(book,versions.get(centralBookRecordId(book.id))??0,0)')
    expect(screen).toContain('const ordinal=bookOrdinal(index)')
    expect(screen).toContain('href: `#/reader/${book.id}`')
    expect(screen).toContain('authorLink(book.author,undefined,book.authorId)')
    expect(screen).toContain('categoryLink(effectiveBookCategory(book))')
    expect(screen).not.toContain("class: 'library-admin__surface'")
  })
})
