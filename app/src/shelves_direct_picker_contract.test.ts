import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { resolveShelfBookChoice } from './screens/shelves'

const screen = readFileSync(new URL('./screens/shelves.ts', import.meta.url), 'utf8')
const library = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
const css = readFileSync(new URL('./styles/screens.css', import.meta.url), 'utf8')

describe('direct shelf book picker', () => {
  it('normalizes Arabic partial input and resolves a unique book', () => {
    const books = [{ id: 'a', title: 'الماجريات', author: 'إبراهيم السكران' }, { id: 'b', title: 'الإجماع', author: 'أبو عبد الله' }]
    expect(resolveShelfBookChoice(books, 'ماج')).toEqual(books[0])
    expect(resolveShelfBookChoice(books, 'ابراهيم السكران')).toEqual(books[0])
  })

  it('renders searchable library choices inside every default/custom shelf', () => {
    expect(screen).toContain("class: 'shelf-card__picker-results'")
    expect(screen).toContain("role: 'listbox'")
    expect(screen).toContain("choices.filter(book => !query")
    expect(screen).toContain('if(!isCurrent())return; editor.setBook(shelfId, book.id, true)')
    expect(screen).toContain('if(!isCurrent())return; editor.setBook(shelf.id, book.id, false)')
    const store = readFileSync(new URL('./shelf_store.ts', import.meta.url), 'utf8')
    expect(store).toContain('if(identity.isCurrent())setBookOnShelf(id,bookId,included)')
  })

  it('keeps My Shelves after intake and uses a larger 390px-safe card', () => {
    expect(library).toMatch(/bookImportManager[\s\S]*shelves,[\s\S]*management/)
    expect(css).toContain('min-height: 168px')
    expect(css).toMatch(/@media \(max-width: 620px\)[^{]*\{ \.shelf-card__picker \{ grid-template-columns: 1fr;/)
  })
})
