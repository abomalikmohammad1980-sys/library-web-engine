import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'

describe('review due status contract', () => {
  it('shows a scheduled date on non-bookmark memory cards outside the due queue', () => {
    const source = readFileSync(new URL('./screens/notes.ts', import.meta.url), 'utf8')
    expect(source).toContain("item.kind === 'bookmark' ? null : nextReviewAt(item.id)")
    expect(source).toContain("nextDue !== null && active !== 'review'")
    expect(source).toContain('المراجعة القادمة:')
    expect(source).toContain("reviewTiming(item.id) === 'due' ? 'المراجعة مستحقة الآن'")
  })
})
