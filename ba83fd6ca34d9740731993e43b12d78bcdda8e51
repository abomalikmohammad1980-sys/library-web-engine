import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('expanded search metadata filters', () => {
  it('indexes coauthors, tags and category and exposes real category/death filters', () => {
    const store = readFileSync(new URL('./engine/search_store.ts', import.meta.url), 'utf8')
    const screen = readFileSync(new URL('./screens/search.ts', import.meta.url), 'utf8')
    expect(store).toContain("const authors = book.authors?.length")
    expect(store).toContain("const tags = book.tags?.map")
    expect(store).toContain('searchAuthorChronology(book, authorRecords)')
    expect(store).toContain("['heading', headings.join(' ')]")
    expect(store).toContain("['card', cardText]")
    expect(store).toContain('options.authors?.length && !options.authors.some(author => authors.includes(author))')
    expect(store).toContain("export type SearchField = 'body' | 'heading' | 'tag' | 'card'")
    expect(screen).toContain("multiChoice('التصنيفات'")
    expect(screen).toContain("labeledSelect('القرن الهجري'")
    expect(screen).toContain("'قبل الهجرة'")
    expect(screen).toContain("'معاصر'")
    expect(screen).toContain("'شجرة العناوين'")
    expect(screen).toContain("'بطاقات الكتب'")
    expect(screen).toContain("'سنة وفاة المؤلف من'")
    expect(screen).toContain('authors: author.values()')
    expect(screen).toContain("['death', 'وفيات المؤلفين: الأقدم أولًا']")
    expect(screen).toContain('values.sort(compareSearchResultsByDeath)')
    expect(screen).not.toContain("'غير متاحين في بيانات الكتب الحالية'")
    // المسح يعيد كل مرشحات البحث الحالية، بما فيها المرشحات المضافة لاحقًا؛
    // لا يثبت العقد ترتيب الخصائص النصي داخل الكائن.
    for (const field of ['category', 'books', 'authors', 'categories', 'century', 'from', 'to', 'fields', 'sort']) {
      expect(screen).toMatch(new RegExp(`${field}: null`))
    }
  })
})
