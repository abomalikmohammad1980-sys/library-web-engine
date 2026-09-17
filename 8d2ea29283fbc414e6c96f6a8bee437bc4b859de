import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { authorNameMatches, normalizeArabicAuthorName } from './author_filter'
import { mergeAuthorRecords, type StoredAuthor } from './engine/library_store'

const screen = readFileSync(new URL('./screens/library.ts', import.meta.url), 'utf8')

describe('authors are a directory for the real local library', () => {
  it('counts cards from StoredBook matches and never exposes source-catalog book totals', () => {
    expect(screen).toContain('books.length} كتاب في الخزانة')
    expect(screen).toContain('groupedById')
    expect(screen).toContain('groupedByName')
    expect(screen).not.toContain('shamelaBookCount')
    expect(screen).not.toContain('كتب المؤلف في الشاملة')
  })

  it('keeps Arabic partial substring matching', () => {
    expect(authorNameMatches('دعامة بن فلان', [], 'دعا')).toBe(true)
  })

  it('merges duplicate سعيد حوى records into one primary identity', () => {
    const primary = { id: 'said', name: 'سعيد حوى', canonicalName: normalizeArabicAuthorName('سعيد حوى'), aliases: [], createdAt: 1, updatedAt: 1 } as StoredAuthor
    const duplicate = { id: 'said-2', name: 'سعيد بن محمد ديب حوّى', canonicalName: normalizeArabicAuthorName('سعيد بن محمد ديب حوى'), aliases: ['سعيد حوى'], biography: 'ترجمة', createdAt: 2, updatedAt: 2 } as StoredAuthor
    const merged = mergeAuthorRecords(primary, duplicate, 3)
    expect(merged.id).toBe('said')
    expect(merged.name).toBe('سعيد حوى')
    expect(merged.aliases.filter(name => normalizeArabicAuthorName(name) === normalizeArabicAuthorName('سعيد حوى'))).toHaveLength(0)
    expect(merged.aliases).toContain('سعيد بن محمد ديب حوّى')
  })
})
