export interface ReaderNote { id: string; bookId: string; pageIndex: number; text: string; createdAt: number }
export type HighlightColor = 'important' | 'evidence' | 'review' | 'correction'
export interface ReaderHighlight { id: string; bookId: string; pageIndex: number; text: string; color: HighlightColor; occurrence?: number; createdAt: number }
export interface ReaderAnnotations { bookmarks: Record<string, number[]>; notes: ReaderNote[]; highlights: ReaderHighlight[] }

const KEY = 'alkhizana:annotations:v1'

export function getAnnotations(): ReaderAnnotations {
  try {
    const value = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<ReaderAnnotations>
    return { bookmarks: value.bookmarks && typeof value.bookmarks === 'object' ? value.bookmarks : {}, notes: Array.isArray(value.notes) ? value.notes : [], highlights: Array.isArray(value.highlights) ? value.highlights : [] }
  } catch { return { bookmarks: {}, notes: [], highlights: [] } }
}

export function toggleBookmark(bookId: string, pageIndex: number): boolean {
  const state = getAnnotations()
  const pages = state.bookmarks[bookId] ?? []
  const exists = pages.includes(pageIndex)
  state.bookmarks[bookId] = exists ? pages.filter((page) => page !== pageIndex) : [...pages, pageIndex].sort((a, b) => a - b)
  save(state)
  return !exists
}

export function addNote(bookId: string, pageIndex: number, text: string): ReaderNote {
  const state = getAnnotations()
  const note = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, bookId, pageIndex, text: text.trim(), createdAt: Date.now() }
  state.notes = [note, ...state.notes]
  save(state)
  return note
}

export function deleteNote(id: string): void {
  const state = getAnnotations(); state.notes = state.notes.filter((note) => note.id !== id); save(state); removeSpacedReview(id); removeAnnotationFromProjects(id)
}

export function addHighlight(bookId: string, pageIndex: number, text: string, color: HighlightColor, occurrence = 0): ReaderHighlight {
  const state = getAnnotations()
  const highlight = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, bookId, pageIndex, text: text.trim(), color, occurrence, createdAt: Date.now() }
  state.highlights = [highlight, ...state.highlights]; save(state); return highlight
}

export function deleteHighlight(id: string): void {
  const state = getAnnotations(); state.highlights = state.highlights.filter((highlight) => highlight.id !== id); save(state); removeSpacedReview(id); removeAnnotationFromProjects(id)
}

function save(state: ReaderAnnotations): void { localStorage.setItem(KEY, JSON.stringify(state)) }

export function saveAnnotations(state: ReaderAnnotations): void { save(state) }
import { removeSpacedReview } from './spaced_review'
import { removeAnnotationFromProjects } from './research_project'
