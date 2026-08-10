import type { ReadingActivity } from './activity_store'

export interface ReadingDay { key: string; active: boolean }
export interface ReadingInsights { days: ReadingDay[]; activeDays: number; totalOpens: number; completionPercent: number }

export function buildReadingInsights(activity: ReadingActivity, now = new Date(), span = 28): ReadingInsights {
  const reviewed = new Set(activity.reviewDays)
  const days: ReadingDay[] = []
  for (let offset = span - 1; offset >= 0; offset--) {
    const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() - offset)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    days.push({ key, active: reviewed.has(key) })
  }
  const activeDays = days.filter(day => day.active).length
  return {
    days,
    activeDays,
    totalOpens: Object.values(activity.openCounts).reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0),
    completionPercent: span ? Math.round(activeDays / span * 100) : 0,
  }
}
