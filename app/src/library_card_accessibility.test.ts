import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { libraryBookActionLabel, libraryBookTitleId } from './library_card_accessibility'

describe('library card accessibility', () => {
  it('creates stable distinct title ids and book-specific actions', () => {
    expect(libraryBookTitleId('book-a')).not.toBe(libraryBookTitleId('book-b'))
    expect(libraryBookTitleId('book-a')).toBe(libraryBookTitleId('book-a'))
    expect(libraryBookActionLabel('select', 'كتاب أ')).toBe('تحديد كتاب أ')
    expect(libraryBookActionLabel('delete', 'كتاب أ')).toBe('حذف كتاب أ')
  })

  it('binds each article and action to the specific book instead of generic labels', () => {
    const source = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')
    expect(source).toContain("'aria-labelledby': titleId")
    expect(source).toContain("id: titleId")
    expect(source).toContain("libraryBookActionLabel('select'")
    expect(source).toContain("libraryBookActionLabel('delete'")
    expect(source).not.toContain("'aria-label': 'حذف',")
  })
})
