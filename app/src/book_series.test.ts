import { describe, expect, it } from 'vitest'
import { groupBookSeries } from './book_series'
describe('scientific book series', () => {
  it('groups only explicitly named series and orders numbered books first', () => {
    const groups = groupBookSeries([{ id: '2', title: 'الثاني', author: 'أ', seriesName: 'مدارج العلم', seriesOrder: 2 }, { id: '1', title: 'الأول', author: 'أ', seriesName: 'مَدارج العلم', seriesOrder: 1 }, { id: 'x', title: 'مستقل', author: 'ب' }])
    expect(groups).toHaveLength(1); expect(groups[0]?.name).toBe('مدارج العلم'); expect(groups[0]?.books.map(book => book.id)).toEqual(['1', '2'])
  })
})
