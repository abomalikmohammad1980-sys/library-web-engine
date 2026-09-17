const RELOAD_KEY = 'alkhizana:module-chunk-reload:v1'

export interface SessionStorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
}

function errorText(error: unknown): string {
  if (error instanceof Error) return `${error.name}: ${error.message}`
  return String(error)
}

/**
 * يعالج تفاوت النسخ بعد النشر: قد تبقى صفحة مفتوحة تشير إلى chunk حُذف اسمه
 * من الإصدار الجديد. نسمح بتحديث كامل واحد فقط، ولا نخفي أخطاء التطبيق العادية.
 */
export function shouldReloadStaleModule(error: unknown, storage: SessionStorageLike): boolean {
  const staleModule = /failed to fetch dynamically imported module|error loading dynamically imported module|loading chunk [\w-]+ failed|chunkloaderror|module script|mime type|importing a module script/i.test(errorText(error))
  if (!staleModule || storage.getItem(RELOAD_KEY) === '1') return false
  storage.setItem(RELOAD_KEY, '1')
  return true
}

export function markModuleLoaded(storage: SessionStorageLike): void {
  storage.removeItem(RELOAD_KEY)
}
