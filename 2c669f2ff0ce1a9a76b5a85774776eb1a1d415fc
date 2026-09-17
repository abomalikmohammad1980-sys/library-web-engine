import { describe, expect, it } from 'vitest'
import type { StoredAuthor, StoredBook } from './engine/library_store'
import { searchAuthorChronology } from './search_author_metadata'

const author = { id: 'nadwi', name: 'أبو الحسن الندوي', canonicalName: 'ابو الحسن الندوي', aliases: [], deathYearHijri: 1420, createdAt: 1, updatedAt: 1 } as StoredAuthor
const book = { id: 'book', title: 'السيرة', author: 'أبو الحسن الندوي' } as StoredBook

describe('search author chronology', () => {
  it('uses the canonical author record for older books without copied death metadata', () => {
    expect(searchAuthorChronology(book, [author])).toEqual({ deathYearHijri: 1420 })
    expect(searchAuthorChronology({ ...book, deathYearHijri: 1400 }, [author])).toEqual({ deathYearHijri: 1400 })
  })
})
