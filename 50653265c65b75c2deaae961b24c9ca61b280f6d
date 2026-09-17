import { describe, expect, it } from 'vitest'
import { resolveShelfBookChoice } from './screens/shelves'

const books = [
  { id: 'a', title: 'الماجريات', author: 'إبراهيم عمر السكران' },
  { id: 'b', title: 'مقدمة في التفسير', author: 'ابن تيمية' },
  { id: 'c', title: 'مقدمة في أصول التفسير', author: 'مؤلف آخر' },
]

describe('direct shelf book picker', () => {
  it('accepts one unique partial Arabic title without requiring the full title', () => {
    expect(resolveShelfBookChoice(books, 'الماج')).toMatchObject({ id: 'a' })
  })

  it('accepts the explicit title and author label when titles may be similar', () => {
    expect(resolveShelfBookChoice(books, 'مقدمة في التفسير — ابن تيمية')).toMatchObject({ id: 'b' })
  })

  it('does not guess when a partial query matches more than one book', () => {
    expect(resolveShelfBookChoice(books, 'مقدمة')).toBeUndefined()
  })
})
