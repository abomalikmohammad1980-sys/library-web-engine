export interface RuntimeCapabilities {
  desktopBridgeAvailable: boolean
  wordPdfEndpointAvailable: boolean
  wordPdfConversionAvailable: boolean
  publicHosted: boolean
  storageScope: 'browser-local'
}

export type CapabilityFetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Pick<Response, 'status' | 'headers'>>

export function hasDesktopBridge(target: unknown): boolean {
  if (!target || typeof target !== 'object') return false
  const value = target as { electronAPI?: unknown; __TAURI__?: unknown; __TAURI_INTERNALS__?: unknown }
  return Boolean(value.electronAPI || value.__TAURI__ || value.__TAURI_INTERNALS__)
}

export async function probeWordPdfEndpoint(fetcher: CapabilityFetch): Promise<boolean> {
  try {
    const response = await fetcher('/api/convert/docx-to-pdf', { method: 'HEAD', cache: 'no-store' })
    if (response.headers.get('x-khizana-word-pdf-capability') === 'available') return true
    // خادم Vite المحلي القديم يعلن المسار بإجابة «POST only» ذات 405.
    return response.status === 405
  } catch {
    return false
  }
}

export async function detectRuntimeCapabilities(
  fetcher: CapabilityFetch,
  target: unknown,
): Promise<RuntimeCapabilities> {
  const desktopBridgeAvailable = hasDesktopBridge(target)
  const wordPdfEndpointAvailable = await probeWordPdfEndpoint(fetcher)
  return {
    desktopBridgeAvailable,
    wordPdfEndpointAvailable,
    // تنفيذ التحويل الحالي يمر عبر endpoint؛ وجود غلاف مكتبي وحده لا يبرر
    // زرًا يعمل ظاهريًا ثم يفشل إذا لم يركّب ذلك endpoint.
    wordPdfConversionAvailable: wordPdfEndpointAvailable,
    publicHosted: !desktopBridgeAvailable && !wordPdfEndpointAvailable,
    storageScope: 'browser-local',
  }
}

let runtimeCapabilitiesPromise: Promise<RuntimeCapabilities> | undefined

export function getRuntimeCapabilities(): Promise<RuntimeCapabilities> {
  runtimeCapabilitiesPromise ??= detectRuntimeCapabilities(fetch.bind(window), window)
  return runtimeCapabilitiesPromise
}

export function publicRuntimeNoticeText(): string {
  return 'نسخة ويب تجريبية: تُحفظ كتبك وملاحظاتك في هذا المتصفح على هذا الجهاز فقط، وقد تُفقد عند مسح بيانات المتصفح. القراءة والاستيراد يعملان هنا، أما إنشاء PDF من Word فيحتاج تشغيل الخِزانة المحلي.'
}

export function canImportWordFileInRuntime(fileName: string, capabilities: Pick<RuntimeCapabilities, 'wordPdfEndpointAvailable'>): boolean {
  return !/\.(?:doc|rtf)$/iu.test(fileName.trim()) || capabilities.wordPdfEndpointAvailable
}
