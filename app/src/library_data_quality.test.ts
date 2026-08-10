import { describe, expect, it } from 'vitest'
import { auditLibraryData } from './library_data_quality'
describe('library data quality audit', () => {
  it('finds missing metadata and duplicate explicit series positions without inventing issues', () => {
    const issues = auditLibraryData([
      { id: 'a', title: 'الأول', author: 'أ', seriesName: 'مدارج', seriesOrder: 1 },
      { id: 'b', title: 'الثاني', author: 'ب', contemporary: true, category: 'الفقه', publisher: 'دار', seriesName: 'مدارج', seriesOrder: 1 },
      { id: 'c', title: 'الثالث', author: 'ج', contemporary: true, category: 'الحديث', publisher: 'دار' },
    ])
    expect(issues.filter(issue => issue.message.includes('مكرر')).map(issue => issue.bookId).sort()).toEqual(['a', 'b'])
    expect(issues.some(issue => issue.bookId === 'a' && issue.kind === 'identity')).toBe(true)
    expect(issues.some(issue => issue.bookId === 'c')).toBe(false)
  })
})
