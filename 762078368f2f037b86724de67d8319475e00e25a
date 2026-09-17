export interface ReadingPlan {
  bookId: string
  totalPages: number
  minutesPerDay: number
  pagesPerDay: number
  startedAt: string
  pausedAt?: string
}

export interface ReadingPlanProgress {
  currentPage: number
  completedPages: number
  remainingPages: number
  percent: number
  targetPageToday: number
  daysRemaining: number
}

const KEY = 'alkhizana:reading-plans:v1'

export function suggestedPagesPerDay(minutesPerDay: number): number {
  const safeMinutes = Math.max(5, Math.min(180, Math.round(minutesPerDay)))
  return Math.max(1, Math.round(safeMinutes / 2))
}

export function createReadingPlan(bookId: string, totalPages: number, minutesPerDay: number, startedAt = new Date()): ReadingPlan {
  if (!bookId.trim()) throw new Error('معرّف الكتاب مطلوب')
  if (!Number.isFinite(totalPages) || totalPages < 1) throw new Error('عدد صفحات الكتاب غير متاح')
  const safeMinutes = Math.max(5, Math.min(180, Math.round(minutesPerDay)))
  return { bookId, totalPages: Math.round(totalPages), minutesPerDay: safeMinutes, pagesPerDay: suggestedPagesPerDay(safeMinutes), startedAt: startedAt.toISOString() }
}

export function updateReadingPlanMinutes(plan: ReadingPlan, minutesPerDay: number): ReadingPlan {
  if (!Number.isFinite(minutesPerDay)) throw new Error('أدخل وقتًا يوميًا صالحًا')
  const safeMinutes = Math.max(5, Math.min(180, Math.round(minutesPerDay)))
  return { ...plan, minutesPerDay: safeMinutes, pagesPerDay: suggestedPagesPerDay(safeMinutes) }
}

export function pauseReadingPlan(plan: ReadingPlan, now = new Date()): ReadingPlan {
  return plan.pausedAt ? plan : { ...plan, pausedAt: now.toISOString() }
}

export function resumeReadingPlan(plan: ReadingPlan, now = new Date()): ReadingPlan {
  if (!plan.pausedAt) return plan
  const pausedDuration = Math.max(0, now.getTime() - new Date(plan.pausedAt).getTime())
  const startedAt = new Date(new Date(plan.startedAt).getTime() + pausedDuration).toISOString()
  const { pausedAt: _, ...active } = plan
  return { ...active, startedAt }
}

export function planProgress(plan: ReadingPlan, currentPageIndex: number, now = new Date()): ReadingPlanProgress {
  const currentPage = Math.max(1, Math.min(plan.totalPages, Math.floor(currentPageIndex) + 1))
  const started = new Date(plan.startedAt)
  const effectiveNow = plan.pausedAt ? new Date(plan.pausedAt) : now
  const elapsedDays = Math.max(0, Math.floor((dayStart(effectiveNow).getTime() - dayStart(started).getTime()) / 86_400_000))
  const targetPageToday = Math.min(plan.totalPages, (elapsedDays + 1) * plan.pagesPerDay)
  const remainingPages = Math.max(0, plan.totalPages - currentPage)
  return {
    currentPage,
    completedPages: currentPage,
    remainingPages,
    percent: Math.round((currentPage / plan.totalPages) * 100),
    targetPageToday,
    daysRemaining: Math.ceil(remainingPages / plan.pagesPerDay),
  }
}

export function listReadingPlans(): ReadingPlan[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]') as ReadingPlan[]
    return Array.isArray(parsed) ? parsed.filter(validPlan).map(plan => ({ ...plan, minutesPerDay: Number.isFinite(plan.minutesPerDay) ? plan.minutesPerDay : Math.max(5, plan.pagesPerDay * 2) })) : []
  } catch { return [] }
}

export function getReadingPlan(bookId: string): ReadingPlan | undefined {
  return listReadingPlans().find(plan => plan.bookId === bookId)
}

export function saveReadingPlan(plan: ReadingPlan): void {
  const plans = [plan, ...listReadingPlans().filter(item => item.bookId !== plan.bookId)]
  localStorage.setItem(KEY, JSON.stringify(plans))
}

export function removeReadingPlan(bookId: string): void {
  localStorage.setItem(KEY, JSON.stringify(listReadingPlans().filter(plan => plan.bookId !== bookId)))
}

export function readingPosition(bookId: string): number {
  return Math.max(0, Number(localStorage.getItem(`alkhizana:reading-position:${bookId}`)) || 0)
}

export function saveReadingPosition(bookId: string, pageIndex: number): void {
  if (!bookId.trim() || !Number.isFinite(pageIndex)) return
  localStorage.setItem(`alkhizana:reading-position:${bookId}`, String(Math.max(0, Math.floor(pageIndex))))
}

function validPlan(value: ReadingPlan): boolean {
  return Boolean(value && typeof value.bookId === 'string' && Number.isFinite(value.totalPages) && value.totalPages > 0 && Number.isFinite(value.pagesPerDay) && value.pagesPerDay > 0 && !Number.isNaN(new Date(value.startedAt).getTime()))
}

function dayStart(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}
