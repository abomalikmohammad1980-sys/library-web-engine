import { describe, expect, it } from 'vitest'
import { libraryCatalogCsv, parseLibraryCatalogCsv, type CatalogCsvBook } from './library_catalog_csv'
import { mergeReadingData, type ReadingDataSnapshot } from './reading_data'
import { createReadingPlan, pauseReadingPlan, planProgress, resumeReadingPlan, updateReadingPlanMinutes } from './reading_plan'
import { restoreLibraryArchive } from './library_archive_restore'
import { restoreBookMetadataSnapshot, snapshotBookMetadata, type StoredBook } from './engine/library_store'

function random(seed = 0x7_101): () => number { let state = seed >>> 0; return () => ((state = (Math.imul(state, 1664525) + 1013904223) >>> 0) / 0x1_0000_0000) }
const baseBook = (id: string): StoredBook => ({ id, title: `كتاب ${id}`, author: 'مؤلف', fileName: `${id}.docx`, data: new Uint8Array([1]), mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', originalSha256: 'x', pdfStatus: 'pending', fileSize: 1, addedAt: 1 })
const snapshot = (overrides: Partial<ReadingDataSnapshot> = {}): ReadingDataSnapshot => ({ format: 'alkhizana-reading-data', version: 3, exportedAt: '2026-08-08T00:00:00.000Z', activity: { openedBookIds: [], openCounts: {}, reviewDays: [] }, annotations: { bookmarks: {}, notes: [], highlights: [] }, settings: { interfaceScale: 100, readerScale: 100, highContrast: false, reduceMotion: false }, shelves: [], quotes: [], readingPlans: [], readingPositions: {}, dismissedRecommendationIds: [], spacedReviews: [], researchProjects: [], ...overrides })

describe('phase 7 deterministic robustness invariants', () => {
  it('round-trips seeded CSV records exactly and rejects duplicate IDs', () => {
    const rnd = random(), books: CatalogCsvBook[] = Array.from({ length: 40 }, (_, i) => ({ id: `b-${i}`, title: `عنوان، ${i} "${Math.floor(rnd() * 1000)}"`, author: `مؤلف\n${i}`, category: i % 3 ? 'العقيدة' : undefined, contemporary: i % 2 === 0, deathYearHijri: i % 2 ? 100 + i : undefined, publisher: `ناشر ${i}`, fileName: `${i}.docx` }))
    const parsed = parseLibraryCatalogCsv(libraryCatalogCsv(books))
    expect(parsed.map(row => row.id)).toEqual([...books].sort((a, b) => a.title.localeCompare(b.title, 'ar')).map(book => book.id))
    expect(new Set(parsed.map(row => row.id)).size).toBe(books.length)
    const duplicate = libraryCatalogCsv([books[0]!, { ...books[0]!, title: 'نسخة أخرى' }])
    expect(() => parseLibraryCatalogCsv(duplicate)).toThrow('مكرر')
  })

  it('merges reading data idempotently without loss and removes orphan references', () => {
    const rnd = random(91), notes = Array.from({ length: 30 }, (_, i) => ({ id: `n-${i}`, bookId: `b-${i % 5}`, pageIndex: Math.floor(rnd() * 80), text: `فائدة ${i}`, createdAt: i }))
    const current = snapshot({ annotations: { bookmarks: { b: [1, 3] }, notes: notes.slice(0, 20), highlights: [] }, shelves: [{ id: 's', name: 'بحث', bookIds: ['b-1'], createdAt: 1 }], dismissedRecommendationIds: ['x'] })
    const incoming = snapshot({ annotations: { bookmarks: { b: [2, 3] }, notes: notes.slice(10), highlights: [] }, shelves: [{ id: 'foreign', name: 'بحث', bookIds: ['b-2', 'b-1'], createdAt: 2 }], dismissedRecommendationIds: ['x', 'y'], spacedReviews: [{ annotationId: 'missing', intervalDays: 1, reviewedAt: 1, dueAt: 2 }], researchProjects: [{ id: 'p', title: 'مشروع', description: '', annotationIds: ['n-1', 'missing'], createdAt: 1, updatedAt: 1 }] })
    const once = mergeReadingData(current, incoming), twice = mergeReadingData(once, incoming)
    expect(once.annotations.notes).toHaveLength(30); expect(new Set(once.annotations.notes.map(note => note.id)).size).toBe(30)
    expect(once.annotations.bookmarks.b).toEqual([1, 2, 3]); expect(once.shelves[0]?.bookIds).toEqual(['b-1', 'b-2'])
    expect(once.spacedReviews).toEqual([]); expect(once.researchProjects[0]?.annotationIds).toEqual(['n-1'])
    expect({ ...twice, exportedAt: once.exportedAt }).toEqual(once)
  })

  it('keeps seeded reading-plan transitions bounded and reversible', () => {
    const rnd = random(17)
    for (let i = 0; i < 50; i++) {
      const total = 1 + Math.floor(rnd() * 900), minutes = -50 + rnd() * 500
      const plan = createReadingPlan(`b-${i}`, total, minutes, new Date('2026-08-01T00:00:00Z'))
      const changed = updateReadingPlanMinutes(plan, minutes), paused = pauseReadingPlan(changed, new Date('2026-08-03T00:00:00Z')), resumed = resumeReadingPlan(paused, new Date('2026-08-05T00:00:00Z')), progress = planProgress(resumed, Math.floor(rnd() * total * 2), new Date('2026-08-06T00:00:00Z'))
      expect(changed.minutesPerDay).toBeGreaterThanOrEqual(5); expect(changed.minutesPerDay).toBeLessThanOrEqual(180)
      expect(progress.currentPage).toBeGreaterThanOrEqual(1); expect(progress.currentPage).toBeLessThanOrEqual(total); expect(progress.percent).toBeGreaterThanOrEqual(0); expect(progress.percent).toBeLessThanOrEqual(100)
      expect(resumed.startedAt).toBe('2026-08-03T00:00:00.000Z')
    }
  })

  it('restores heterogeneous metadata snapshots including absent legacy fields', () => {
    const records = Array.from({ length: 30 }, (_, i) => ({ ...baseBook(`b-${i}`), author: `مؤلف ${i}`, ...(i % 2 ? { category: 'العقيدة', deathYearHijri: 100 + i } : {}), ...(i % 3 ? { contemporary: false } : {}) }))
    const before = records.map(snapshotBookMetadata)
    records.forEach(book => { book.author = 'موحد'; book.category = 'علوم أخرى'; book.contemporary = true; delete book.deathYearHijri })
    records.forEach((book, i) => restoreBookMetadataSnapshot(book, before[i]!))
    expect(records.map(snapshotBookMetadata)).toEqual(before)
  })

  it('never silently overwrites a generated archive ID and repeated skip restore is idempotent', async () => {
    const existing = new Set(['b', '7101-0-restored']), persisted: string[] = []
    const report = await restoreLibraryArchive([baseBook('b')], existing, 'replace-as-new', async book => { if (existing.has(book.id)) throw new Error('overwrite'); persisted.push(book.id); existing.add(book.id) }, 7101)
    expect(report.failed).toEqual([]); expect(persisted).toEqual(['7101-0-restored-1']); expect(new Set(persisted).size).toBe(persisted.length)
    expect(await restoreLibraryArchive([baseBook('b')], existing, 'skip', async () => { throw new Error('must not persist') }, 7101)).toMatchObject({ imported: 0, skipped: 1, failed: [] })
  })
})
