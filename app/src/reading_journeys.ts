import { planProgress, type ReadingPlan, type ReadingPlanProgress } from './reading_plan'

export interface ReadingJourney {
  plan: ReadingPlan
  title: string
  author: string
  progress: ReadingPlanProgress
  pagesBehindToday: number
}

export function buildReadingJourneys(
  plans: readonly ReadingPlan[],
  books: readonly { id: string; title: string; author: string }[],
  positionFor: (bookId: string) => number,
  now = new Date(),
): ReadingJourney[] {
  const byId = new Map(books.map(book => [book.id, book]))
  return plans.flatMap(plan => {
    const book = byId.get(plan.bookId)
    if (!book) return []
    const progress = planProgress(plan, positionFor(plan.bookId), now)
    return [{ plan, title: book.title, author: book.author, progress, pagesBehindToday: Math.max(0, progress.targetPageToday - progress.currentPage) }]
  }).sort((a, b) => Number(a.progress.remainingPages === 0) - Number(b.progress.remainingPages === 0) || b.pagesBehindToday - a.pagesBehindToday || a.title.localeCompare(b.title, 'ar'))
}
