import { beforeEach, describe, expect, it, vi } from 'vitest'
import { importReadingData, mergeReadingData, normalizeReadingData, type ReadingDataSnapshot } from './reading_data'
import { getReadingPlan, readingPosition } from './reading_plan'

const snapshot = (overrides: Partial<ReadingDataSnapshot> = {}): ReadingDataSnapshot => ({
  format: 'alkhizana-reading-data', version: 3, exportedAt: '2026-08-08T00:00:00.000Z',
  activity: { openedBookIds: [], openCounts: {}, reviewDays: [] }, annotations: { bookmarks: {}, notes: [], highlights: [] },
  settings: { interfaceScale: 100, readerScale: 100, highContrast: false, reduceMotion: false }, shelves: [], quotes: [], readingPlans: [], readingPositions: {}, dismissedRecommendationIds: [], spacedReviews: [], researchProjects: [], ...overrides,
})

describe('reading data backup', () => {
  beforeEach(() => {
    const values = new Map<string, string>()
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) })
    vi.stubGlobal('document', { documentElement: { style: { setProperty: vi.fn() }, classList: { toggle: vi.fn() } } })
    vi.stubGlobal('window', { dispatchEvent: vi.fn() })
    vi.stubGlobal('CustomEvent', class { constructor(public type: string, public init?: unknown) {} })
  })

  it.each([1, 2])('accepts version %s and fills v3 collections without inventing records', version => {
    const normalized = normalizeReadingData({ format: 'alkhizana-reading-data', version, activity: {}, annotations: {}, settings: {} })
    expect(normalized.version).toBe(3); expect(normalized.shelves).toEqual([]); expect(normalized.quotes).toEqual([])
    expect(normalized.readingPlans).toEqual([]); expect(normalized.readingPositions).toEqual({})
    expect(normalized.dismissedRecommendationIds).toEqual([])
    expect(normalized.spacedReviews).toEqual([])
    expect(normalized.researchProjects).toEqual([])
  })

  it('merges recommendation dismissals without deleting either device preference', () => {
    const merged = mergeReadingData(snapshot({ dismissedRecommendationIds: ['a'] }), snapshot({ dismissedRecommendationIds: ['b', 'a'] }))
    expect(merged.dismissedRecommendationIds).toEqual(['a', 'b'])
  })

  it('keeps the newest spaced review per annotation', () => {
    const old = { annotationId: 'n', intervalDays: 1, reviewedAt: 10, dueAt: 20 }
    const fresh = { annotationId: 'n', intervalDays: 7, reviewedAt: 30, dueAt: 40 }
    const note = { id: 'n', bookId: 'b', pageIndex: 0, text: 'فائدة', createdAt: 1 }
    expect(mergeReadingData(snapshot({ spacedReviews: [old], annotations: { bookmarks: {}, notes: [note], highlights: [] } }), snapshot({ spacedReviews: [fresh], annotations: { bookmarks: {}, notes: [note], highlights: [] } })).spacedReviews).toEqual([fresh])
    expect(mergeReadingData(snapshot({ spacedReviews: [old] }), snapshot()).spacedReviews).toEqual([])
  })

  it('merges the newest research project and removes orphan benefit references', () => {
    const note = { id: 'n', bookId: 'b', pageIndex: 0, text: 'فائدة', createdAt: 1 }
    const old = { id: 'p', title: 'قديم', description: '', annotationIds: ['n', 'missing'], createdAt: 1, updatedAt: 2 }
    const fresh = { ...old, title: 'جديد', updatedAt: 3 }
    const merged = mergeReadingData(snapshot({ annotations: { bookmarks: {}, notes: [note], highlights: [] }, researchProjects: [old] }), snapshot({ annotations: { bookmarks: {}, notes: [note], highlights: [] }, researchProjects: [fresh] }))
    expect(merged.researchProjects).toEqual([{ ...fresh, annotationIds: ['n'] }])
  })

  it('rejects unrelated JSON before any storage mutation', () => {
    expect(() => normalizeReadingData({ format: 'other', version: 2 })).toThrow('ليس نسخة بيانات')
  })

  it('merges annotations, shelves and activity without deleting current data', () => {
    const current = snapshot({
      activity: { lastBookId: 'a', lastOpenedAt: 10, openedBookIds: ['a'], openCounts: { a: 4 }, reviewDays: ['2026-08-07'] },
      annotations: { bookmarks: { a: [1] }, notes: [{ id: 'n1', bookId: 'a', pageIndex: 1, text: 'قديم', createdAt: 1 }], highlights: [] },
      shelves: [{ id: 's1', name: 'أقرأه الآن', bookIds: ['a'], createdAt: 1 }],
    })
    const incoming = snapshot({
      activity: { lastBookId: 'b', lastOpenedAt: 20, openedBookIds: ['b'], openCounts: { a: 2, b: 1 }, reviewDays: ['2026-08-08'] },
      annotations: { bookmarks: { a: [2], b: [0] }, notes: [{ id: 'n2', bookId: 'b', pageIndex: 0, text: 'جديد', createdAt: 2 }], highlights: [] },
      shelves: [{ id: 'foreign', name: 'أقرأه الآن', bookIds: ['b'], createdAt: 2 }],
    })
    const merged = mergeReadingData(current, incoming)
    expect(merged.activity.lastBookId).toBe('b'); expect(merged.activity.openCounts.a).toBe(4)
    expect(merged.annotations.bookmarks.a).toEqual([1, 2]); expect(merged.annotations.notes.map(note => note.id)).toEqual(['n2', 'n1'])
    expect(merged.shelves).toEqual([{ id: 's1', name: 'أقرأه الآن', bookIds: ['a', 'b'], createdAt: 1 }])
  })

  it('merges the newest plan per book and keeps the furthest reading position', () => {
    const oldPlan = { bookId: 'a', totalPages: 100, minutesPerDay: 10, pagesPerDay: 5, startedAt: '2026-08-01T00:00:00.000Z' }
    const newPlan = { ...oldPlan, minutesPerDay: 20, pagesPerDay: 10, startedAt: '2026-08-08T00:00:00.000Z', pausedAt: '2026-08-09T00:00:00.000Z' }
    const merged = mergeReadingData(snapshot({ readingPlans: [oldPlan], readingPositions: { a: 12 } }), snapshot({ readingPlans: [newPlan], readingPositions: { a: 8, b: 3 } }))
    expect(merged.readingPlans).toEqual([newPlan])
    expect(merged.readingPositions).toEqual({ a: 12, b: 3 })
  })

  it('normalizes and imports plans and positions into the live local stores', () => {
    const incoming = snapshot({
      readingPlans: [{ bookId: 'book-1', totalPages: 80, minutesPerDay: 20, pagesPerDay: 10, startedAt: '2026-08-08T00:00:00.000Z' }],
      readingPositions: { 'book-1': 14 },
    })
    const imported = importReadingData(incoming)
    expect(imported.version).toBe(3)
    expect(getReadingPlan('book-1')?.pagesPerDay).toBe(10)
    expect(readingPosition('book-1')).toBe(14)
  })
})
