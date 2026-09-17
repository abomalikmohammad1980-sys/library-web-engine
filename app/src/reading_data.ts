import { getAnnotations, saveAnnotations, type ReaderAnnotations, type ReaderHighlight, type ReaderNote } from './annotation_store'
import { getReadingActivity, saveReadingActivity, type ReadingActivity } from './activity_store'
import { getReaderQuotes, saveReaderQuotes, type ReaderQuote } from './quote_store'
import { getSettings, saveSettings, type AppSettings } from './settings_store'
import { listShelves, saveShelves, type Shelf } from './shelf_store'
import { listReadingPlans, readingPosition, saveReadingPlan, saveReadingPosition, type ReadingPlan } from './reading_plan'
import { dismissedRecommendationIds, saveDismissedRecommendationIds } from './recommendation_preferences'
import { listSpacedReviews, saveSpacedReviews, type SpacedReviewRecord } from './spaced_review'
import { listResearchProjects, saveResearchProjects, type ResearchProject } from './research_project'
import { captureReadingIdentity } from './reading_identity_scope'

export interface ReadingDataSnapshot {
  format: 'alkhizana-reading-data'
  version: 3
  exportedAt: string
  activity: ReadingActivity
  annotations: ReaderAnnotations
  settings: AppSettings
  shelves: Shelf[]
  quotes: ReaderQuote[]
  readingPlans: ReadingPlan[]
  readingPositions: Record<string, number>
  dismissedRecommendationIds: string[]
  spacedReviews: SpacedReviewRecord[]
  researchProjects: ResearchProject[]
}

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter(item => typeof item === 'string') : []
const finite = (value: unknown, fallback = 0): number => Number.isFinite(Number(value)) ? Number(value) : fallback

export function currentReadingData(now = new Date()): ReadingDataSnapshot {
  const readingPlans = listReadingPlans()
  return { format: 'alkhizana-reading-data', version: 3, exportedAt: now.toISOString(), activity: getReadingActivity(), annotations: getAnnotations(), settings: getSettings(), shelves: listShelves(), quotes: getReaderQuotes(), readingPlans, readingPositions: Object.fromEntries(readingPlans.map(plan => [plan.bookId, readingPosition(plan.bookId)])), dismissedRecommendationIds: dismissedRecommendationIds(), spacedReviews: listSpacedReviews(), researchProjects: listResearchProjects() }
}

export function normalizeReadingData(value: unknown): ReadingDataSnapshot {
  const root = record(value)
  if (root.format !== 'alkhizana-reading-data') throw new Error('هذا الملف ليس نسخة بيانات من الخِزانة')
  const version = finite(root.version)
  if (version < 1 || version > 3) throw new Error('إصدار نسخة البيانات غير مدعوم')
  const activity = record(root.activity)
  const annotations = record(root.annotations)
  const bookmarks = record(annotations.bookmarks)
  const normalizedBookmarks: Record<string, number[]> = {}
  for (const [bookId, pages] of Object.entries(bookmarks)) normalizedBookmarks[bookId] = [...new Set((Array.isArray(pages) ? pages : []).map(page => finite(page, -1)).filter(page => Number.isInteger(page) && page >= 0))].sort((a, b) => a - b)
  const notes = (Array.isArray(annotations.notes) ? annotations.notes : []).map(normalizeNote).filter((item): item is ReaderNote => Boolean(item))
  const highlights = (Array.isArray(annotations.highlights) ? annotations.highlights : []).map(normalizeHighlight).filter((item): item is ReaderHighlight => Boolean(item))
  const settings = record(root.settings)
  const shelves = (Array.isArray(root.shelves) ? root.shelves : []).map(normalizeShelf).filter((item): item is Shelf => Boolean(item))
  const quotes = (Array.isArray(root.quotes) ? root.quotes : []).map(normalizeQuote).filter((item): item is ReaderQuote => Boolean(item))
  const readingPlans = (Array.isArray(root.readingPlans) ? root.readingPlans : []).map(normalizeReadingPlan).filter((item): item is ReadingPlan => Boolean(item))
  const readingPositions = Object.fromEntries(Object.entries(record(root.readingPositions)).map(([bookId, page]) => [bookId, Math.max(0, Math.floor(finite(page))) ]))
  const spacedReviews = (Array.isArray(root.spacedReviews) ? root.spacedReviews : []).map(normalizeSpacedReview).filter((item): item is SpacedReviewRecord => Boolean(item))
  const researchProjects = (Array.isArray(root.researchProjects) ? root.researchProjects : []).map(normalizeResearchProject).filter((item): item is ResearchProject => Boolean(item))
  return {
    format: 'alkhizana-reading-data', version: 3,
    exportedAt: typeof root.exportedAt === 'string' ? root.exportedAt : new Date(0).toISOString(),
    activity: {
      ...(typeof activity.lastBookId === 'string' ? { lastBookId: activity.lastBookId } : {}),
      ...(finite(activity.lastOpenedAt) > 0 ? { lastOpenedAt: finite(activity.lastOpenedAt) } : {}),
      openedBookIds: strings(activity.openedBookIds),
      openCounts: Object.fromEntries(Object.entries(record(activity.openCounts)).map(([key, count]) => [key, Math.max(0, finite(count))])),
      reviewDays: strings(activity.reviewDays),
    },
    annotations: { bookmarks: normalizedBookmarks, notes, highlights },
    settings: {
      interfaceScale: Math.min(200, Math.max(85, finite(settings.interfaceScale, 100))),
      readerScale: Math.min(200, Math.max(80, finite(settings.readerScale, 100))),
      highContrast: Boolean(settings.highContrast), reduceMotion: Boolean(settings.reduceMotion),
      theme: settings.theme === 'light' || settings.theme === 'dark' || settings.theme === 'sepia' ? settings.theme : 'original',
    }, shelves, quotes, readingPlans, readingPositions, dismissedRecommendationIds: [...new Set(strings(root.dismissedRecommendationIds))], spacedReviews, researchProjects,
  }
}

export function mergeReadingData(current: ReadingDataSnapshot, incoming: ReadingDataSnapshot): ReadingDataSnapshot {
  const newest = (incoming.activity.lastOpenedAt ?? 0) >= (current.activity.lastOpenedAt ?? 0) ? incoming.activity : current.activity
  const bookmarks: Record<string, number[]> = { ...current.annotations.bookmarks }
  for (const [bookId, pages] of Object.entries(incoming.annotations.bookmarks)) bookmarks[bookId] = [...new Set([...(bookmarks[bookId] ?? []), ...pages])].sort((a, b) => a - b)
  const unique = <T extends { id: string }>(left: T[], right: T[]): T[] => [...new Map([...left, ...right].map(item => [item.id, item])).values()]
  const shelvesByName = new Map(current.shelves.map(shelf => [shelf.name, shelf]))
  for (const shelf of incoming.shelves) {
    const previous = shelvesByName.get(shelf.name)
    shelvesByName.set(shelf.name, previous ? { ...previous, bookIds: [...new Set([...previous.bookIds, ...shelf.bookIds])] } : shelf)
  }
  const countKeys = new Set([...Object.keys(current.activity.openCounts), ...Object.keys(incoming.activity.openCounts)])
  const mergedNotes = unique(current.annotations.notes, incoming.annotations.notes).sort((a, b) => b.createdAt - a.createdAt)
  const mergedHighlights = unique(current.annotations.highlights, incoming.annotations.highlights).sort((a, b) => b.createdAt - a.createdAt)
  const liveAnnotationIds = new Set([...mergedNotes.map(item => item.id), ...mergedHighlights.map(item => item.id)])
  return {
    format: 'alkhizana-reading-data', version: 3, exportedAt: new Date().toISOString(),
    activity: {
      ...(newest.lastBookId ? { lastBookId: newest.lastBookId } : {}),
      ...(newest.lastOpenedAt ? { lastOpenedAt: newest.lastOpenedAt } : {}),
      openedBookIds: [...new Set([...incoming.activity.openedBookIds, ...current.activity.openedBookIds])].slice(0, 50),
      openCounts: Object.fromEntries([...countKeys].map(key => [key, Math.max(current.activity.openCounts[key] ?? 0, incoming.activity.openCounts[key] ?? 0)])),
      reviewDays: [...new Set([...current.activity.reviewDays, ...incoming.activity.reviewDays])].sort().slice(-366),
    },
    annotations: { bookmarks, notes: mergedNotes, highlights: mergedHighlights },
    settings: incoming.settings,
    shelves: [...shelvesByName.values()], quotes: unique(current.quotes, incoming.quotes).sort((a, b) => b.createdAt - a.createdAt).slice(0, 500),
    readingPlans: mergeReadingPlans(current.readingPlans, incoming.readingPlans),
    readingPositions: Object.fromEntries([...new Set([...Object.keys(current.readingPositions), ...Object.keys(incoming.readingPositions)])].map(bookId => [bookId, Math.max(current.readingPositions[bookId] ?? 0, incoming.readingPositions[bookId] ?? 0)])),
    dismissedRecommendationIds: [...new Set([...current.dismissedRecommendationIds, ...incoming.dismissedRecommendationIds])],
    spacedReviews: mergeSpacedReviews(current.spacedReviews, incoming.spacedReviews).filter(item => liveAnnotationIds.has(item.annotationId)),
    researchProjects: mergeResearchProjects(current.researchProjects, incoming.researchProjects).map(project => ({ ...project, annotationIds: project.annotationIds.filter(id => liveAnnotationIds.has(id)) })),
  }
}

/** Capture before file IO; never apply a pending import to a different account. */
export async function importReadingDataFile(file: Pick<Blob, 'text'>, confirmImport: () => boolean): Promise<ReadingDataSnapshot | undefined> {
  const identity = captureReadingIdentity()
  const text = await file.text()
  const assertCurrent = () => { if (!identity.isCurrent()) throw new Error('تغيّر الحساب أثناء قراءة الملف. أعد الاستيراد ضمن الحساب المطلوب.') }
  assertCurrent()
  const parsed: unknown = JSON.parse(text)
  if (!confirmImport()) return undefined
  assertCurrent()
  // No await between this guard and the synchronous import writes.
  return importReadingData(parsed)
}

export function importReadingData(value: unknown): ReadingDataSnapshot {
  const merged = mergeReadingData(currentReadingData(), normalizeReadingData(value))
  saveReadingActivity(merged.activity); saveAnnotations(merged.annotations); saveSettings(merged.settings); saveShelves(merged.shelves); saveReaderQuotes(merged.quotes)
  merged.readingPlans.forEach(saveReadingPlan); Object.entries(merged.readingPositions).forEach(([bookId, page]) => saveReadingPosition(bookId, page))
  saveDismissedRecommendationIds(merged.dismissedRecommendationIds)
  saveSpacedReviews(merged.spacedReviews)
  saveResearchProjects(merged.researchProjects)
  return merged
}

function normalizeNote(value: unknown): ReaderNote | undefined {
  const item = record(value); if (typeof item.id !== 'string' || typeof item.bookId !== 'string' || typeof item.text !== 'string') return undefined
  return { id: item.id, bookId: item.bookId, pageIndex: Math.max(0, finite(item.pageIndex)), text: item.text, createdAt: Math.max(0, finite(item.createdAt)) }
}
function normalizeHighlight(value: unknown): ReaderHighlight | undefined {
  const item = record(value); const color = item.color
  if (typeof item.id !== 'string' || typeof item.bookId !== 'string' || typeof item.text !== 'string' || !['important', 'evidence', 'review', 'correction'].includes(String(color))) return undefined
  return { id: item.id, bookId: item.bookId, pageIndex: Math.max(0, finite(item.pageIndex)), text: item.text, color: color as ReaderHighlight['color'], ...(typeof item.comment==='string'&&item.comment.trim()?{comment:item.comment.trim().slice(0,2000)}:{}), ...(finite(item.occurrence, -1) >= 0 ? { occurrence: finite(item.occurrence) } : {}), createdAt: Math.max(0, finite(item.createdAt)) }
}
function normalizeShelf(value: unknown): Shelf | undefined { const item = record(value); return typeof item.id === 'string' && typeof item.name === 'string' ? { id: item.id, name: item.name, bookIds: strings(item.bookIds), createdAt: Math.max(0, finite(item.createdAt)) } : undefined }
function normalizeQuote(value: unknown): ReaderQuote | undefined { const item = record(value); return typeof item.id === 'string' && typeof item.text === 'string' && typeof item.bookId === 'string' ? { id: item.id, text: item.text, bookId: item.bookId, createdAt: Math.max(0, finite(item.createdAt)) } : undefined }

function normalizeReadingPlan(value: unknown): ReadingPlan | undefined {
  const item = record(value)
  if (typeof item.bookId !== 'string' || !item.bookId.trim() || finite(item.totalPages) < 1 || finite(item.pagesPerDay) < 1 || typeof item.startedAt !== 'string' || Number.isNaN(new Date(item.startedAt).getTime())) return undefined
  const pausedAt = typeof item.pausedAt === 'string' && !Number.isNaN(new Date(item.pausedAt).getTime()) ? item.pausedAt : undefined
  return { bookId: item.bookId, totalPages: Math.round(finite(item.totalPages)), minutesPerDay: Math.min(180, Math.max(5, Math.round(finite(item.minutesPerDay, 15)))), pagesPerDay: Math.max(1, Math.round(finite(item.pagesPerDay))), startedAt: item.startedAt, ...(pausedAt ? { pausedAt } : {}) }
}

function normalizeSpacedReview(value: unknown): SpacedReviewRecord | undefined {
  const item = record(value)
  if (typeof item.annotationId !== 'string' || !item.annotationId.trim() || finite(item.intervalDays) <= 0 || finite(item.reviewedAt, -1) < 0 || finite(item.dueAt, -1) < 0) return undefined
  return { annotationId: item.annotationId, intervalDays: Math.max(1, Math.round(finite(item.intervalDays))), reviewedAt: finite(item.reviewedAt), dueAt: finite(item.dueAt) }
}

function normalizeResearchProject(value: unknown): ResearchProject | undefined {
  const item = record(value)
  if (typeof item.id !== 'string' || typeof item.title !== 'string' || !item.title.trim()) return undefined
  return { id: item.id, title: item.title.trim(), description: typeof item.description === 'string' ? item.description : '', annotationIds: [...new Set(strings(item.annotationIds))], createdAt: Math.max(0, finite(item.createdAt)), updatedAt: Math.max(0, finite(item.updatedAt)) }
}

function mergeResearchProjects(current: ResearchProject[], incoming: ResearchProject[]): ResearchProject[] {
  const byId = new Map(current.map(project => [project.id, project]))
  for (const project of incoming) { const previous = byId.get(project.id); if (!previous || project.updatedAt >= previous.updatedAt) byId.set(project.id, project) }
  return [...byId.values()].sort((a, b) => b.updatedAt - a.updatedAt)
}

function mergeSpacedReviews(current: SpacedReviewRecord[], incoming: SpacedReviewRecord[]): SpacedReviewRecord[] {
  const byId = new Map(current.map(item => [item.annotationId, item]))
  for (const item of incoming) if (!byId.has(item.annotationId) || item.reviewedAt >= byId.get(item.annotationId)!.reviewedAt) byId.set(item.annotationId, item)
  return [...byId.values()]
}

function mergeReadingPlans(current: ReadingPlan[], incoming: ReadingPlan[]): ReadingPlan[] {
  const byBook = new Map(current.map(plan => [plan.bookId, plan]))
  for (const plan of incoming) {
    const previous = byBook.get(plan.bookId)
    if (!previous || new Date(plan.startedAt).getTime() >= new Date(previous.startedAt).getTime()) byBook.set(plan.bookId, plan)
  }
  return [...byBook.values()]
}
