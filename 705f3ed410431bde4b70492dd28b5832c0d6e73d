import { beforeEach, describe, expect, it, vi } from 'vitest'
import { applyBookWordReplacement, normalizeLegacyStoredBook, type StoredBook } from './engine/library_store'
import { listReadingPlans, saveReadingPlan } from './reading_plan'
import { listResearchProjects, updateResearchProject } from './research_project'

describe('phase 7 local storage resilience', () => {
  let values: Map<string, string>
  beforeEach(() => { values = new Map(); vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) }) })
  it('hydrates legacy book records without inventing ready artifacts', () => {
    const legacy = normalizeLegacyStoredBook({ id: 'b', title: 'ك', author: 'م', data: new Uint8Array([1, 2]) } as StoredBook)
    expect(legacy).toMatchObject({ fileName: 'book.docx', fileSize: 2, addedAt: 0, pdfStatus: 'pending' })
  })
  it('hydrates legacy plans and projects with deterministic defaults', () => {
    values.set('alkhizana:reading-plans:v1', JSON.stringify([{ bookId: 'b', totalPages: 10, pagesPerDay: 3, startedAt: '2026-01-01T00:00:00Z' }]))
    values.set('alkhizana:research-projects:v1', JSON.stringify([{ id: 'p', title: 'بحث', annotationIds: ['n', 'n'], createdAt: 1, updatedAt: 1 }]))
    expect(listReadingPlans()[0]?.minutesPerDay).toBe(6); expect(listResearchProjects()[0]).toMatchObject({ description: '', annotationIds: ['n'] })
  })
  it('leaves the previous local value intact on quota-style write failure', () => {
    const old = JSON.stringify([{ bookId: 'old', totalPages: 10, minutesPerDay: 10, pagesPerDay: 5, startedAt: '2026-01-01T00:00:00Z' }]); values.set('alkhizana:reading-plans:v1', old)
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError') }, removeItem: vi.fn() })
    expect(() => saveReadingPlan({ bookId: 'new', totalPages: 10, minutesPerDay: 10, pagesPerDay: 5, startedAt: '2026-01-01T00:00:00Z' })).toThrow(); expect(values.get('alkhizana:reading-plans:v1')).toBe(old)
  })
  it('does not report a project update after an aborted write', () => {
    const old = JSON.stringify([{ id: 'p', title: 'بحث', description: '', annotationIds: [], createdAt: 1, updatedAt: 1 }]); values.set('alkhizana:research-projects:v1', old)
    vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: () => { throw new DOMException('quota', 'QuotaExceededError') }, removeItem: vi.fn() })
    expect(() => updateResearchProject('p', ['n'], 2)).toThrow(); expect(values.get('alkhizana:research-projects:v1')).toBe(old)
  })
  it('prepares replacement on a detached clone so aborted persistence keeps the original', () => {
    const original = normalizeLegacyStoredBook({ id: 'b', title: 'ك', author: 'م', fileName: 'old.docx', data: new Uint8Array([1]), mimeType: 'x', originalSha256: 'old', pdfStatus: 'ready', fileSize: 1, addedAt: 1 } as StoredBook), clone = structuredClone(original)
    applyBookWordReplacement(clone, { fileName: 'new.docx', data: new Uint8Array([2]), mimeType: 'x' }, 'new')
    expect(original.fileName).toBe('old.docx'); expect(original.originalSha256).toBe('old'); expect(clone.pdfStatus).toBe('pending')
  })
})
