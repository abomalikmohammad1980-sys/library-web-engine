const RELOAD_KEY = 'alkhizana:reader-chunk-reload:v1'
export interface SessionStorageLike { getItem(key: string): string | null; setItem(key: string, value: string): void; removeItem(key: string): void }

/** يعالج مرة واحدة صفحة بقيت ممسكة باسم reader chunk حُذف بعد بناء/نشر جديد. */
export function shouldReloadReaderChunk(error: unknown, storage: SessionStorageLike): boolean {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  const isChunkFailure = /dynamically imported module|dynamic import|module script|mime type|importing a module script/i.test(message)
  if (!isChunkFailure || storage.getItem(RELOAD_KEY) === '1') return false
  storage.setItem(RELOAD_KEY, '1')
  return true
}
export function markReaderChunkLoaded(storage: SessionStorageLike): void { storage.removeItem(RELOAD_KEY) }
