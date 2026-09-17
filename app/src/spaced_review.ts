import { readingStorageKey } from './reading_identity_scope'
export interface SpacedReviewRecord { annotationId: string; intervalDays: number; reviewedAt: number; dueAt: number }
const KEY = 'alkhizana:spaced-review:v1'
const STEPS = [1, 3, 7, 14, 30]

export function listSpacedReviews(): SpacedReviewRecord[] {
  try {
    const value = JSON.parse(localStorage.getItem(readingStorageKey(KEY)) ?? '[]')
    return Array.isArray(value) ? value.filter(item => item && typeof item.annotationId === 'string' && Number.isFinite(item.dueAt) && Number.isFinite(item.intervalDays)) : []
  } catch { return [] }
}

export function recordReview(annotationId: string, outcome: 'remembered' | 'again', now = Date.now()): SpacedReviewRecord {
  const records = listSpacedReviews(), previous = records.find(item => item.annotationId === annotationId)
  const intervalDays = outcome === 'again' ? 1 : STEPS[Math.min(STEPS.length - 1, Math.max(0, STEPS.indexOf(previous?.intervalDays ?? 0) + 1))]!
  const record = { annotationId, intervalDays, reviewedAt: now, dueAt: now + intervalDays * 86_400_000 }
  localStorage.setItem(readingStorageKey(KEY), JSON.stringify([record, ...records.filter(item => item.annotationId !== annotationId)]))
  return record
}

export function dueAnnotationIds(annotationIds: readonly string[], now = Date.now()): Set<string> {
  const byId = new Map(listSpacedReviews().map(item => [item.annotationId, item]))
  return new Set(annotationIds.filter(id => !byId.has(id) || byId.get(id)!.dueAt <= now))
}

export function dueReviewCount(annotationIds: readonly string[], now = Date.now()): number {
  return dueAnnotationIds(annotationIds, now).size
}

export function nextReviewAt(annotationId: string): number | null {
  return listSpacedReviews().find(item => item.annotationId === annotationId)?.dueAt ?? null
}

export function reviewTiming(annotationId: string, now = Date.now()): 'due' | 'scheduled' | null {
  const dueAt = nextReviewAt(annotationId)
  return dueAt === null ? null : dueAt <= now ? 'due' : 'scheduled'
}

export function makeReviewDueNow(annotationId: string, now = Date.now()): boolean {
  const records = listSpacedReviews(), index = records.findIndex(item => item.annotationId === annotationId)
  if (index < 0) return false
  records[index] = { ...records[index]!, reviewedAt: now, dueAt: now }
  saveSpacedReviews(records)
  return true
}

export function saveSpacedReviews(records: readonly SpacedReviewRecord[]): void {
  const valid = records.filter(item => item.annotationId.trim() && Number.isFinite(item.intervalDays) && item.intervalDays > 0 && Number.isFinite(item.reviewedAt) && Number.isFinite(item.dueAt))
  if (valid.length) localStorage.setItem(readingStorageKey(KEY), JSON.stringify(valid)); else localStorage.removeItem(readingStorageKey(KEY))
}

export function removeSpacedReview(annotationId: string): void {
  saveSpacedReviews(listSpacedReviews().filter(item => item.annotationId !== annotationId))
}
