import { describe, expect, it } from 'vitest'
import { annotationsMarkdown } from './annotations_markdown'

describe('annotations Markdown export', () => {
  it('groups documented memory by book and orders physical pages', () => {
    const text = annotationsMarkdown({
      notes: [{ id: 'n', bookId: 'b', pageIndex: 4, text: 'فائدة\nمهمة', createdAt: 2 }],
      highlights: [{ id: 'h', bookId: 'b', pageIndex: 1, text: 'دليل', color: 'evidence', createdAt: 1 }],
      bookmarks: { b: [2] },
    }, new Map([['b', { title: 'كتاب العلم', author: 'أحمد' }]]))
    expect(text).toContain('## كتاب العلم\n_المؤلف: أحمد_')
    expect(text.indexOf('صفحة 2')).toBeLessThan(text.indexOf('صفحة 3'))
    expect(text.indexOf('صفحة 3')).toBeLessThan(text.indexOf('صفحة 5'))
    expect(text).toContain('فائدة مهمة')
  })
})

