export type TranslationProvider = 'cache' | 'browser-local' | 'project-service'

export interface TranslationResult {
  translation: string
  provider: TranslationProvider
}

interface BrowserTranslator {
  translate(text: string): Promise<string>
  destroy?(): void
}

export interface BrowserTranslatorFactory {
  availability?(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  create(options: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>
}

interface LegacyBrowserTranslation {
  canTranslate(options: { sourceLanguage: string; targetLanguage: string }): Promise<string>
  createTranslator(options: { sourceLanguage: string; targetLanguage: string }): Promise<BrowserTranslator>
}

function currentBrowserTranslator(): BrowserTranslatorFactory | undefined {
  const candidate = (globalThis as typeof globalThis & { Translator?: BrowserTranslatorFactory }).Translator
  return candidate?.create ? candidate : undefined
}

function currentLegacyBrowserTranslation(): LegacyBrowserTranslation | undefined {
  const candidate = (globalThis as typeof globalThis & { translation?: Partial<LegacyBrowserTranslation> }).translation
  return typeof candidate?.canTranslate === 'function' && typeof candidate.createTranslator === 'function'
    ? candidate as LegacyBrowserTranslation
    : undefined
}

const isReadyWithoutDownload = (status: string): boolean => status === 'available' || status === 'readily'
const requiresDownload = (status: string): boolean => status === 'downloadable' || status === 'after-download'

export type BrowserTranslationAvailability = 'ready' | 'downloadable' | 'unavailable'

export async function browserLocalTranslationAvailability(
  targetLanguage: string,
  factory: BrowserTranslatorFactory | undefined = currentBrowserTranslator(),
  legacy: LegacyBrowserTranslation | undefined = currentLegacyBrowserTranslation(),
): Promise<BrowserTranslationAvailability> {
  const options = { sourceLanguage: 'ar', targetLanguage }
  try {
    const value = factory?.availability
      ? await factory.availability(options)
      : legacy
        ? await legacy.canTranslate(options)
        : 'unavailable'
    if (isReadyWithoutDownload(value)) return 'ready'
    if (requiresDownload(value)) return 'downloadable'
  } catch { /* غياب واجهة المتصفح أو عدم دعم زوج اللغات أمر متوقع */ }
  return 'unavailable'
}

/**
 * يستعمل محرك الترجمة المدمج في المتصفح فقط عندما يكون النموذج موجودًا فعلًا
 * على الجهاز. لا يطلب تنزيل حزمة لغوية كبيرة ضمنيًا ولا يدّعي دعم زوج لغات
 * لا يعلن المتصفح جاهزيته له.
 */
export async function tryBrowserLocalTranslation(
  text: string,
  targetLanguage: string,
  factory: BrowserTranslatorFactory | undefined = currentBrowserTranslator(),
  legacy: LegacyBrowserTranslation | undefined = currentLegacyBrowserTranslation(),
  allowDownload = false,
): Promise<string | undefined> {
  const options = { sourceLanguage: 'ar', targetLanguage }
  let translator: BrowserTranslator | undefined
  try {
    if (factory?.availability) {
      const availability = await factory.availability(options)
      if (!isReadyWithoutDownload(availability) && !(allowDownload && requiresDownload(availability))) return undefined
      translator = await factory.create(options)
    } else if (legacy) {
      const availability = await legacy.canTranslate(options)
      if (!isReadyWithoutDownload(availability) && !(allowDownload && requiresDownload(availability))) return undefined
      translator = await legacy.createTranslator(options)
    } else {
      return undefined
    }
    const translated = (await translator.translate(text)).trim()
    return translated || undefined
  } catch {
    // فشل المحرك الاختياري لا يمنع الانتقال إلى خدمة المشروع.
    return undefined
  } finally {
    translator?.destroy?.()
  }
}

export function translationServiceFailureMessage(status: number, code?: string, serverMessage?: string): string {
  if (status === 429 || code === 'translation_quota_exhausted') {
    return 'نفدت حصة خدمة الترجمة المتصلة مؤقتًا، ولا يتوفر على هذا الجهاز محرك محلي جاهز لهذه اللغة.'
  }
  if (status === 503 || code === 'translation_not_configured') {
    return 'خدمة الترجمة غير مفعّلة في هذا الإصدار، ولا يتوفر محرك محلي جاهز لهذه اللغة.'
  }
  if (status >= 500) {
    return 'تعذّرت خدمة الترجمة المتصلة، ولا يتوفر محرك محلي جاهز لهذه اللغة.'
  }
  return serverMessage || 'تعذرت الترجمة الآن؛ حاول مرة أخرى.'
}

/** الأخطاء العابرة وحدها تستحق محاولة ثانية؛ نفاد الحصة/سوء الطلب لا يتحسن بالتكرار. */
export function shouldRetryTranslationRequest(status: number): boolean {
  return status === 408 || status === 425 || status === 502 || status === 504
}

export const translationProviderLabel = (provider: TranslationProvider): string => ({
  cache: 'نسخة محفوظة على هذا الجهاز',
  'browser-local': 'محرك الترجمة المحلي على هذا الجهاز',
  'project-service': 'خدمة الترجمة المتصلة',
}[provider])
