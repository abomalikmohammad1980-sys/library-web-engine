import { planProgress, type ReadingPlan, type ReadingPlanProgress } from './reading_plan'
import { compareBooksByAuthorDeath } from './book_ordering'
import type { StoredBook } from './engine/library_store'

export interface ReadingJourney {
  id: string
  plan: ReadingPlan
  title: string
  author: string
  authorId?: string
  category?: string
  categoryOverride?: StoredBook['categoryOverride']
  deathYearHijri?: number
  contemporary?: boolean
  progress: ReadingPlanProgress
  pagesBehindToday: number
}

export function buildReadingJourneys(
  plans: readonly ReadingPlan[],
  books: readonly (Pick<StoredBook, 'id' | 'title' | 'author'> & Partial<Pick<StoredBook, 'authorId' | 'category' | 'categoryOverride' | 'deathYearHijri' | 'contemporary'>>)[],
  positionFor: (bookId: string) => number,
  now = new Date(),
): ReadingJourney[] {
  const byId = new Map(books.map(book => [book.id, book]))
  return plans.flatMap(plan => {
    const book = byId.get(plan.bookId)
    if (!book) return []
    const progress = planProgress(plan, positionFor(plan.bookId), now)
    return [{
      id: book.id, plan, title: book.title, author: book.author,
      ...(book.authorId ? { authorId: book.authorId } : {}),
      ...(book.category ? { category: book.category } : {}),
      ...(book.categoryOverride ? { categoryOverride: book.categoryOverride } : {}),
      ...(book.deathYearHijri ? { deathYearHijri: book.deathYearHijri } : {}),
      ...(book.contemporary !== undefined ? { contemporary: book.contemporary } : {}),
      progress, pagesBehindToday: Math.max(0, progress.targetPageToday - progress.currentPage),
    }]
  }).sort((a, b) => Number(a.progress.remainingPages === 0) - Number(b.progress.remainingPages === 0)
    || b.pagesBehindToday - a.pagesBehindToday
    || compareBooksByAuthorDeath(a, b))
}
