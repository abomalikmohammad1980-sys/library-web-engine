import { describe, expect, it } from 'vitest'
import { recommendUnreadBooks } from './reading_recommendations'

describe('local reading recommendations', () => {
  it('excludes opened books and explains category/author affinity', () => {
    const books = [
      { id: 'read', title: 'الأصل', author: 'أحمد', category: 'الحديث', addedAt: 1 },
      { id: 'author', title: 'للمؤلف', author: 'أحمد', category: 'الفقه', addedAt: 2 },
      { id: 'category', title: 'في الفن', author: 'خالد', category: 'الحديث', addedAt: 3 },
      { id: 'new', title: 'جديد', author: 'زيد', category: 'اللغة', addedAt: 4 },
    ]
    const result = recommendUnreadBooks(books, ['read'], { read: 3 })
    expect(result.map(item => item.book.id)).not.toContain('read')
    expect(result[0]).toMatchObject({ book: { id: 'category' }, reason: 'لأنك تقرأ في الحديث' })
    expect(result.find(item => item.book.id === 'author')?.reason).toContain('أحمد')
  })

  it('never treats placeholder or missing authors as a shared affinity', () => {
    const books = [
      { id: 'read', title: 'قديم', author: 'غير معروف', category: 'الفقه', addedAt: 1 },
      { id: 'unknown', title: 'مجهول آخر', author: 'مؤلف غير معروف', category: 'اللغة', addedAt: 3 },
      { id: 'category', title: 'صلة الفن', author: 'خالد', category: 'الفقه', addedAt: 2 },
    ]
    const result = recommendUnreadBooks(books, ['read'], { read: 5 })
    expect(result[0]?.book.id).toBe('category')
    expect(result.find(item => item.book.id === 'unknown')?.reason).toBe('من أحدث كتب خزانتك')
    expect(result.every(item => !item.reason.includes('غير معروف'))).toBe(true)
  })
})
