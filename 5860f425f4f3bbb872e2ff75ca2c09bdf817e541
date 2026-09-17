import { trackLiveResource } from './resource_lifecycle'

/** v6 يضم تمييز VML السطري من العائم؛ يفرض إعادة بناء واحدة للنماذج القديمة
 * كي لا يبقى تراكب الصور محفوظًا في IndexedDB بعد تحديث المحرك. */
export const CURRENT_CONVERSION_ARTIFACT_VERSION = 'word-pagination-2026-08-09-v6'
const RETRY_AFTER_MS = 24 * 60 * 60 * 1000
const IN_PROGRESS_EXPIRES_MS = 10 * 60 * 1000

export interface VersionedBookArtifact {
  id: string
  conversionArtifactVersion?: string
  conversionArtifactAttemptVersion?: string
  conversionArtifactAttemptedAt?: number
  conversionArtifactFailedAt?: number
}

export interface ArtifactRefreshAdapter<T extends VersionedBookArtifact> {
  markAttempt(id: string, version: string, attemptedAt: number): Promise<void>
  rebuild(id: string): Promise<T>
  markCurrent(id: string, version: string): Promise<T>
  markFailure(id: string, version: string, failedAt: number): Promise<void>
}

const activeRefreshes = new Map<string, Promise<VersionedBookArtifact>>()

export function startBookArtifactRefresh<T extends VersionedBookArtifact>(book: T, adapter: ArtifactRefreshAdapter<T>, now = Date.now()): { started: boolean; completion: Promise<T> } {
  if (book.conversionArtifactVersion === CURRENT_CONVERSION_ARTIFACT_VERSION) return { started: false, completion: Promise.resolve(book) }
  const active = activeRefreshes.get(book.id) as Promise<T> | undefined
  if (active) return { started: false, completion: active }
  if (book.conversionArtifactAttemptVersion === CURRENT_CONVERSION_ARTIFACT_VERSION) {
    if (book.conversionArtifactFailedAt && now - book.conversionArtifactFailedAt < RETRY_AFTER_MS) return { started: false, completion: Promise.resolve(book) }
    if (!book.conversionArtifactFailedAt && book.conversionArtifactAttemptedAt && now - book.conversionArtifactAttemptedAt < IN_PROGRESS_EXPIRES_MS) return { started: false, completion: Promise.resolve(book) }
  }
  const releaseJob = trackLiveResource('backgroundJobs')
  const completion = (async (): Promise<T> => {
    await adapter.markAttempt(book.id, CURRENT_CONVERSION_ARTIFACT_VERSION, now)
    try {
      await adapter.rebuild(book.id)
      return await adapter.markCurrent(book.id, CURRENT_CONVERSION_ARTIFACT_VERSION)
    } catch {
      await adapter.markFailure(book.id, CURRENT_CONVERSION_ARTIFACT_VERSION, now)
      return book
    } finally {
      activeRefreshes.delete(book.id)
      releaseJob()
    }
  })()
  activeRefreshes.set(book.id, completion)
  return { started: true, completion }
}

export async function ensureCurrentBookArtifacts<T extends VersionedBookArtifact>(book: T, adapter: ArtifactRefreshAdapter<T>, now = Date.now()): Promise<T> {
  return startBookArtifactRefresh(book, adapter, now).completion
}
