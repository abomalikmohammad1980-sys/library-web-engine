import { strict as assert } from 'node:assert'
import { describe, it } from 'vitest'
import { buildReadingInsights } from './reading_insights'

describe('reading insights', () => {
  it('builds a bounded chronological heatmap and honest totals', () => {
    const result = buildReadingInsights({ openedBookIds: [], openCounts: { a: 3, b: 2 }, reviewDays: ['2026-08-06', '2026-08-08'] }, new Date(2026, 7, 8), 3)
    assert.deepEqual(result.days.map(day => [day.key, day.active]), [['2026-08-06', true], ['2026-08-07', false], ['2026-08-08', true]])
    assert.equal(result.activeDays, 2); assert.equal(result.totalOpens, 5); assert.equal(result.completionPercent, 67)
  })
})
