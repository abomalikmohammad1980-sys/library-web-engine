import { describe, expect, it } from 'vitest'
import { createReadingPlan } from './reading_plan'
import { buildReadingJourneys } from './reading_journeys'

describe('reading journeys', () => {
  it('joins actual books, drops deleted ones, and prioritizes plans behind today', () => {
    const start = new Date('2026-08-01T08:00:00Z')
    const plans = [createReadingPlan('ahead', 100, 20, start), createReadingPlan('behind', 100, 20, start), createReadingPlan('deleted', 40, 10, start)]
    const journeys = buildReadingJourneys(plans, [
      { id: 'ahead', title: 'الأول', author: 'مؤلف' }, { id: 'behind', title: 'الثاني', author: 'مؤلف' },
    ], id => id === 'ahead' ? 39 : 4, new Date('2026-08-03T12:00:00Z'))
    expect(journeys.map(item => item.plan.bookId)).toEqual(['behind', 'ahead'])
    expect(journeys[0].pagesBehindToday).toBe(25)
    expect(journeys[1].pagesBehindToday).toBe(0)
  })
})
