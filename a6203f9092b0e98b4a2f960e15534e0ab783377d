import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('scheduled reviews filter contract', () => {
  it('supports a deep-linked scheduled tab containing only future annotation reviews', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain("'review', 'scheduled', 'note'")
    expect(source).toContain("['scheduled', 'مراجعات قادمة']")
    expect(source).toContain("active === 'scheduled' ? item.kind !== 'bookmark' && reviewTiming(item.id) === 'scheduled'")
    expect(source).toContain('لا توجد مراجعات قادمة مجدولة')
    expect(source).toContain("annotationActionLabel('dueNow', label, bookTitle, item.pageIndex + 1)")
    expect(source).toContain('makeReviewDueNow(item.id)')
  })
})
