import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createReadingPlan, getReadingPlan, pauseReadingPlan, planProgress, removeReadingPlan, resumeReadingPlan, saveReadingPlan, suggestedPagesPerDay, updateReadingPlanMinutes } from './reading_plan'

describe('reading plans', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) })
  })

  it('changes daily pace without resetting the journey', () => {
    const original = createReadingPlan('book-1', 120, 15, new Date('2026-08-01T08:00:00Z'))
    expect(updateReadingPlanMinutes(original, 40)).toEqual({ ...original, minutesPerDay: 40, pagesPerDay: 20 })
    expect(updateReadingPlanMinutes(original, 999).minutesPerDay).toBe(180)
  })

  it('freezes targets while paused and shifts the schedule when resumed', () => {
    const plan = createReadingPlan('book-1', 120, 20, new Date('2026-08-01T08:00:00Z'))
    const paused = pauseReadingPlan(plan, new Date('2026-08-03T08:00:00Z'))
    expect(planProgress(paused, 0, new Date('2026-08-10T08:00:00Z')).targetPageToday).toBe(30)
    const resumed = resumeReadingPlan(paused, new Date('2026-08-10T08:00:00Z'))
    expect(resumed.pausedAt).toBeUndefined()
    expect(resumed.startedAt).toBe('2026-08-08T08:00:00.000Z')
  })

  it('turns available daily minutes into a bounded, useful page target', () => {
    expect(suggestedPagesPerDay(5)).toBe(3)
    expect(suggestedPagesPerDay(20)).toBe(10)
    expect(suggestedPagesPerDay(500)).toBe(90)
  })

  it('calculates today target and remaining days from the actual reading position', () => {
    const plan = createReadingPlan('book-1', 100, 20, new Date('2026-08-01T08:00:00Z'))
    const progress = planProgress(plan, 24, new Date('2026-08-03T20:00:00Z'))
    expect(progress).toMatchObject({ currentPage: 25, targetPageToday: 30, remainingPages: 75, daysRemaining: 8, percent: 25 })
  })

  it('replaces one book plan without duplicating it and can remove it', () => {
    saveReadingPlan(createReadingPlan('book-1', 100, 10))
    saveReadingPlan(createReadingPlan('book-1', 100, 30))
    expect(getReadingPlan('book-1')?.minutesPerDay).toBe(30)
    removeReadingPlan('book-1')
    expect(getReadingPlan('book-1')).toBeUndefined()
  })
})
