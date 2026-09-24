import { describe, expect, it, vi } from 'vitest'
import { canImportWordFileInRuntime, detectRuntimeCapabilities, hasDesktopBridge, probeWordPdfEndpoint, publicRuntimeNoticeText, wordPdfCapabilityText } from './runtime_capabilities'

const response = (status: number, capability?: string) => ({
  status,
  headers: new Headers(capability ? { 'X-Khizana-Word-Pdf-Capability': capability } : {}),
})

describe('runtime capabilities', () => {
  it('recognizes desktop wrappers without claiming they provide the HTTP converter', () => {
    expect(hasDesktopBridge({ electronAPI: {} })).toBe(true)
    expect(hasDesktopBridge({ __TAURI_INTERNALS__: {} })).toBe(true)
    expect(hasDesktopBridge({})).toBe(false)
  })

  it('recognizes the local Word/PDF endpoint by its marker or legacy 405 contract', async () => {
    await expect(probeWordPdfEndpoint(vi.fn(async () => response(200, 'available')))).resolves.toBe(true)
    await expect(probeWordPdfEndpoint(vi.fn(async () => response(405)))).resolves.toBe(true)
  })

  it('rejects a static-host SPA fallback and network failure as conversion endpoints', async () => {
    await expect(probeWordPdfEndpoint(vi.fn(async () => response(200)))).resolves.toBe(false)
    await expect(probeWordPdfEndpoint(vi.fn(async () => { throw new Error('offline') }))).resolves.toBe(false)
  })

  it('classifies a public static runtime honestly while preserving browser-local storage', async () => {
    const capabilities = await detectRuntimeCapabilities(vi.fn(async () => response(404)), {})
    expect(capabilities).toEqual({
      desktopBridgeAvailable: false,
      wordPdfEndpointAvailable: false,
      wordPdfConversionAvailable: false,
      publicHosted: true,
      storageScope: 'browser-local',
    })
    expect(publicRuntimeNoticeText()).toContain('في هذا المتصفح على هذا الجهاز فقط')
    expect(publicRuntimeNoticeText()).toContain('القراءة والاستيراد يعملان هنا')
  })

  it('does not label a desktop wrapper as public, but still disables conversion without its endpoint', async () => {
    const capabilities = await detectRuntimeCapabilities(vi.fn(async () => response(404)), { electronAPI: {} })
    expect(capabilities.publicHosted).toBe(false)
    expect(capabilities.desktopBridgeAvailable).toBe(true)
    expect(capabilities.wordPdfConversionAvailable).toBe(false)
  })

  it('يصف تحويل المتصفح متاحًا ولا يدعي وجود Microsoft Word في الموقع الحي', () => {
    const text = wordPdfCapabilityText({ wordPdfConversionAvailable: false })
    expect(text.browser).toContain('متاح على هذا الجهاز')
    expect(text.browser).toContain('لا يستخدم Microsoft Word')
    expect(text.office).toContain('غير متاح في الموقع الحي')
    expect(text.office).toContain('المساعد المحلي المتصل')
  })

  it('يعلن مسار Office فقط بعد نجاح اكتشاف endpoint المحلي', () => {
    const text = wordPdfCapabilityText({ wordPdfConversionAvailable: true })
    expect(text.office).toContain('متاح الآن')
    expect(text.office).toContain('المساعد المحلي')
    expect(text.browser).not.toContain('غير متاح')
  })

  it('keeps DOCX import available publicly but requires the local normalizer for legacy DOC/RTF', () => {
    const publicRuntime = { wordPdfEndpointAvailable: false }
    expect(canImportWordFileInRuntime('كتاب.docx', publicRuntime)).toBe(true)
    expect(canImportWordFileInRuntime('كتاب.doc', publicRuntime)).toBe(false)
    expect(canImportWordFileInRuntime('كتاب.RTF', publicRuntime)).toBe(false)
    expect(canImportWordFileInRuntime('كتاب.doc', { wordPdfEndpointAvailable: true })).toBe(true)
  })
})
