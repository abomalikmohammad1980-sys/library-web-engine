export interface ReadingActivity {
  lastBookId?: string
  lastOpenedAt?: number
  openedBookIds: string[]
  openCounts: Record<string, number>
  reviewDays: string[]
}

const KEY = 'alkhizana:reading-activity:v1'

export function getReadingActivity(): ReadingActivity {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ReadingActivity>
    return {
      ...(saved.lastBookId ? { lastBookId: saved.lastBookId } : {}),
      ...(saved.lastOpenedAt ? { lastOpenedAt: saved.lastOpenedAt } : {}),
      openedBookIds: Array.isArray(saved.openedBookIds) ? saved.openedBookIds : [],
      openCounts: saved.openCounts && typeof saved.openCounts === 'object' ? saved.openCounts : {},
      reviewDays: Array.isArray(saved.reviewDays) ? saved.reviewDays : [],
    }
  } catch {
    return { openedBookIds: [], openCounts: {}, reviewDays: [] }
  }
}

export function recordBookOpened(bookId: string): void {
  const state = getReadingActivity()
  state.lastBookId = bookId
  state.lastOpenedAt = Date.now()
  state.openedBookIds = [bookId, ...state.openedBookIds.filter((id) => id !== bookId)].slice(0, 50)
  state.openCounts[bookId] = (state.openCounts[bookId] ?? 0) + 1
  save(state)
}

export function completeTodayReview(): ReadingActivity {
  const state = getReadingActivity()
  const today = dayKey(new Date())
  if (!state.reviewDays.includes(today)) state.reviewDays = [...state.reviewDays, today].slice(-366)
  save(state)
  return state
}

export function reviewedToday(state = getReadingActivity()): boolean {
  return state.reviewDays.includes(dayKey(new Date()))
}

export function currentReviewStreak(state = getReadingActivity()): number {
  const days = new Set(state.reviewDays)
  let streak = 0
  const cursor = new Date()
  while (days.has(dayKey(cursor))) {
    streak++
    cursor.setDate(cursor.getDate() - 1)
  }
  return streak
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function save(state: ReadingActivity): void {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function saveReadingActivity(state: ReadingActivity): void { save(state) }
