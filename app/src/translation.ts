import { h, toast } from './ui'
import { icon } from './icons'
import { uiDictionary } from './ui_dictionary_loader'
import { boundUiText, boundUiAttribute, uiTemplateText, uiLabelParameter } from './ui_template_binding'
import { prepareAuthorDisplayLocale } from './author_locale_display'
import { repaintAuthorDisplayNames } from './author_display_names'
import { prepareBookDisplayLocale, repaintBookDisplayTitles } from './book_locale_display'
import {
  browserLocalTranslationAvailability,
  shouldRetryTranslationRequest,
  translationProviderLabel,
  translationServiceFailureMessage,
  tryBrowserLocalTranslation,
  type TranslationResult,
} from './translation_backend'

export interface TranslationLanguage {
  code: string
  label: string
  native: string
  dir: 'rtl' | 'ltr'
}

const translateUiLabel = (source: string, language: string): string | undefined => uiDictionary.translate(source, language)
let uiTranslationRequest = 0

export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { code: 'en', label: 'الإنجليزية', native: 'English', dir: 'ltr' },
  { code: 'fr', label: 'الفرنسية', native: 'Français', dir: 'ltr' },
  { code: 'ug', label: 'الإيغورية', native: 'ئۇيغۇرچە', dir: 'rtl' },
  { code: 'ckb', label: 'الكردية السورانية', native: 'کوردیی سۆرانی', dir: 'rtl' },
  { code: 'ku', label: 'الكردية الكرمانجية', native: 'Kurdî (Kurmancî)', dir: 'ltr' },
  { code: 'tr', label: 'التركية', native: 'Türkçe', dir: 'ltr' },
  { code: 'ur', label: 'الأوردية', native: 'اردو', dir: 'rtl' },
  { code: 'fa', label: 'الفارسية', native: 'فارسی', dir: 'rtl' },
  { code: 'sw', label: 'السواحلية', native: 'Kiswahili', dir: 'ltr' },
  { code: 'hi', label: 'الهندية', native: 'हिन्दी', dir: 'ltr' },
  { code: 'hu', label: 'الهنغارية', native: 'Magyar', dir: 'ltr' },
  { code: 'id', label: 'الإندونيسية', native: 'Bahasa Indonesia', dir: 'ltr' },
  { code: 'ms', label: 'الملايوية', native: 'Bahasa Melayu', dir: 'ltr' },
  { code: 'bn', label: 'البنغالية', native: 'বাংলা', dir: 'ltr' },
  { code: 'ps', label: 'البشتوية', native: 'پښتو', dir: 'rtl' },
  { code: 'so', label: 'الصومالية', native: 'Soomaali', dir: 'ltr' },
  { code: 'ha', label: 'الهوسا', native: 'Hausa', dir: 'ltr' },
  { code: 'ru', label: 'الروسية', native: 'Русский', dir: 'ltr' },
  { code: 'uk', label: 'الأوكرانية', native: 'Українська', dir: 'ltr' },
  { code: 'de', label: 'الألمانية', native: 'Deutsch', dir: 'ltr' },
  { code: 'es', label: 'الإسبانية', native: 'Español', dir: 'ltr' },
  { code: 'pt', label: 'البرتغالية', native: 'Português', dir: 'ltr' },
  { code: 'it', label: 'الإيطالية', native: 'Italiano', dir: 'ltr' },
  { code: 'nl', label: 'الهولندية', native: 'Nederlands', dir: 'ltr' },
  { code: 'sv', label: 'السويدية', native: 'Svenska', dir: 'ltr' },
  { code: 'no', label: 'النرويجية', native: 'Norsk', dir: 'ltr' },
  { code: 'pl', label: 'البولندية', native: 'Polski', dir: 'ltr' },
  { code: 'ro', label: 'الرومانية', native: 'Română', dir: 'ltr' },
  { code: 'bs', label: 'البوسنية', native: 'Bosanski', dir: 'ltr' },
  { code: 'sq', label: 'الألبانية', native: 'Shqip', dir: 'ltr' },
  { code: 'az', label: 'الأذربيجانية', native: 'Azərbaycanca', dir: 'ltr' },
  { code: 'uz', label: 'الأوزبكية', native: "O‘zbekcha", dir: 'ltr' },
  { code: 'kk', label: 'الكازاخية', native: 'Қазақша', dir: 'ltr' },
  { code: 'zh', label: 'الصينية', native: '中文', dir: 'ltr' },
  { code: 'ja', label: 'اليابانية', native: '日本語', dir: 'ltr' },
  { code: 'ko', label: 'الكورية', native: '한국어', dir: 'ltr' },
] as const

const normalize = (value: string): string => value.normalize('NFKD').toLocaleLowerCase('ar').replace(/[\u064b-\u065f\u0670]/g, '').trim()
async function cacheKey(text: string, language: string, purpose: 'text' | 'ui'): Promise<string> {
  const bytes = new TextEncoder().encode(`v2\0ar\0${language}\0${purpose}\0${text}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `khizana:translation:${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function translateArabicTextDetailed(
  text: string,
  target: TranslationLanguage,
  purpose: 'text' | 'ui' = 'text',
  allowLocalDownload = false,
): Promise<TranslationResult> {
  const source = text.trim()
  if (!source) throw new Error('اكتب نصًا أو حدّد نصًا من الكتاب أولًا.')
  if (source.length > 6000) throw new Error('الحد الأقصى للترجمة الواحدة 6000 محرف؛ حدّد مقطعًا أقصر.')
  const key = await cacheKey(source, target.code, purpose)
  const cached = localStorage.getItem(key)
  if (cached) return { translation: cached, provider: 'cache' }
  const localTranslation = await tryBrowserLocalTranslation(source, target.code, undefined, undefined, allowLocalDownload)
  if (localTranslation) {
    try { localStorage.setItem(key, localTranslation) } catch { /* التخزين المؤقت تحسين اختياري */ }
    return { translation: localTranslation, provider: 'browser-local' }
  }
  const requestBody = JSON.stringify({ text: source, sourceLanguage: 'ar', targetLanguage: target.code, purpose })
  let response: Response | undefined
  let lastConnectionError: unknown
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 12_000)
    try {
      response = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: requestBody,
        signal: controller.signal,
      })
      if (attempt === 0 && shouldRetryTranslationRequest(response.status)) {
        void response.body?.cancel()
        await new Promise(resolve => window.setTimeout(resolve, 250))
        continue
      }
      break
    } catch (error) {
      lastConnectionError = error
      if (attempt === 0) {
        await new Promise(resolve => window.setTimeout(resolve, 250))
        continue
      }
    } finally {
      window.clearTimeout(timeout)
    }
  }
  if (!response) {
    if (lastConnectionError instanceof DOMException && lastConnectionError.name === 'AbortError') {
      throw new Error('انتهت مهلة خدمة الترجمة بعد إعادة المحاولة، ولا يتوفر محرك محلي جاهز لهذه اللغة.')
    }
    throw new Error('تعذّر اتصال النسخة المحلية بخدمة الترجمة بعد إعادة المحاولة، ولا يتوفر محرك محلي جاهز لهذه اللغة.')
  }
  const payload = await response.json().catch(() => ({})) as { translation?: string; error?: string; code?: string }
  if (!response.ok || !payload.translation) throw new Error(translationServiceFailureMessage(response.status, payload.code, payload.error))
  try { localStorage.setItem(key, payload.translation) } catch { /* التخزين المؤقت تحسين اختياري */ }
  return { translation: payload.translation, provider: 'project-service' }
}

export async function translateArabicText(text: string, target: TranslationLanguage, purpose: 'text' | 'ui' = 'text'): Promise<string> {
  return (await translateArabicTextDetailed(text, target, purpose)).translation
}

const ORIGINAL_TEXT = new WeakMap<Text, string>()
/** Stable source identity for UI headings; never infer it from a translated label. */
export function sourceUiText(node: Node): string {
  if (node.nodeType === 3) return ORIGINAL_TEXT.get(node as Text) ?? node.textContent ?? ''
  return Array.from(node.childNodes).map(sourceUiText).join('')
}
const ORIGINAL_ATTRIBUTES = new WeakMap<HTMLElement, Map<string, string>>()
const RENDERED_ATTRIBUTES = new WeakMap<HTMLElement, Map<string, string>>()
let originalDocumentTitle = ''
let dynamicTranslationObserver: MutationObserver | undefined
let dynamicTranslationTimer = 0
const SITE_LANGUAGE_KEY = 'khizana:site-language'
const UI_TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,a,button,label,legend,option,dt,dd,th,td,summary,strong,em,small,span,.eyebrow,.chip,.book-card__meta,.book-card__title,.book-card__author,[data-ui-text]'
const UI_TRANSLATABLE_ATTRIBUTES = ['aria-label', 'placeholder', 'title', 'alt', 'data-ui-busy-label', 'data-tooltip'] as const
function writeUiAttribute(element: HTMLElement, name: typeof UI_TRANSLATABLE_ATTRIBUTES[number], value: string): void {
  let rendered = RENDERED_ATTRIBUTES.get(element)
  if (!rendered) { rendered = new Map(); RENDERED_ATTRIBUTES.set(element, rendered) }
  rendered.set(name, value)
  if (element.getAttribute(name) !== value) element.setAttribute(name, value)
}

/** واجهة الخزانة تعتمد الشرطة القصيرة وحدها؛ لا تمس متن الكتب المستثنى. */
export function normalizeInterfaceDashes(value: string): string {
  return value.replace(/[—–]+/gu, '-').replace(/\s*-\s*/gu, ' - ')
}

function normalizeVisibleInterfaceDashes(): void {
  for (const node of translatableUiNodes()) {
    if (node.textContent && /[—–]/u.test(node.textContent)) node.textContent = normalizeInterfaceDashes(node.textContent)
  }
  for (const { element, name } of translatableUiAttributes()) {
    const value = element.getAttribute(name)
    if (value && /[—–]/u.test(value)) writeUiAttribute(element, name, normalizeInterfaceDashes(value))
  }
}

/** لغة الواجهة غير العربية هي هدف النص الافتراضي؛ العربية تتطلب اختيارًا صريحًا. */
export function translationTargetForSiteLanguage(code: string | null): TranslationLanguage | undefined {
  if (!code || code === 'ar') return undefined
  return TRANSLATION_LANGUAGES.find(language => language.code === code)
}

/**
 * يسجل عنوان المسار العربي بوصفه المصدر الحاكم، ثم يعرض ترجمته وفق اللغة
 * المحفوظة. من دون هذا العقد كان الانتقال أثناء بقاء الواجهة مترجمة يعيد
 * استعمال عنوان المسار السابق (مثل Home داخل صفحة القرآن).
 */
export function setSourceDocumentTitle(title: string): void {
  const normalizedTitle = title.replace(/\s*[—–]+\s*/gu, ' - ').replace(/\s+-\s+/gu, ' - ').trim()
  originalDocumentTitle = normalizedTitle
  const code = localStorage.getItem(SITE_LANGUAGE_KEY)
  const language = TRANSLATION_LANGUAGES.find(item => item.code === code)
  document.title = language
    ? normalizedTitle.split(' - ').map(part => translateUiLabel(part.trim(), language.code) ?? part).join(' - ')
    : normalizedTitle
  if (language) void uiDictionary.ready().then(() => {
    if (originalDocumentTitle !== normalizedTitle || localStorage.getItem(SITE_LANGUAGE_KEY) !== language.code) return
    document.title = normalizedTitle.split(' - ').map(part => translateUiLabel(part.trim(), language.code) ?? part).join(' - ')
  }).catch(() => undefined)
}

function translatableUiNodes(): Text[] {
  const nodes: Text[] = []
  for (const element of document.querySelectorAll<HTMLElement>(UI_TEXT_SELECTOR)) {
    if (element.closest('.reading__page-slot,.reader__pdf-viewport,[data-no-translate]')) continue
    for (const child of element.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE || !(child.textContent ?? '').trim()) continue
      const text = child as Text
      if (!ORIGINAL_TEXT.has(text)) ORIGINAL_TEXT.set(text, text.textContent ?? '')
      nodes.push(text)
    }
  }
  return nodes
}

function translatableUiAttributes(): Array<{ element: HTMLElement; name: typeof UI_TRANSLATABLE_ATTRIBUTES[number]; original: string }> {
  const attributes: Array<{ element: HTMLElement; name: typeof UI_TRANSLATABLE_ATTRIBUTES[number]; original: string }> = []
  for (const element of document.querySelectorAll<HTMLElement>(UI_TRANSLATABLE_ATTRIBUTES.map(name => `[${name}]`).join(','))) {
    const protectedElement=element.closest('.reading__page-slot,.reader__pdf-viewport,[data-no-translate]')
    let originals = ORIGINAL_ATTRIBUTES.get(element)
    if (!originals) { originals = new Map(); ORIGINAL_ATTRIBUTES.set(element, originals) }
    for (const name of UI_TRANSLATABLE_ATTRIBUTES) {
      const bound=boundUiAttribute(element,name,'ar')
      if(protectedElement&&bound===undefined)continue
      if (name === 'alt' && !element.hasAttribute('data-ui-text')&&bound===undefined) continue
      const value = element.getAttribute(name)
      if (!value?.trim()) continue
      const lastRendered = RENDERED_ATTRIBUTES.get(element)?.get(name)
      // A widget may change an existing label (e.g. Sign in -> Create account).
      // Only our last rendered value is a translation; a new external value is source.
      if (!originals.has(name) || (lastRendered !== undefined && value !== lastRendered)) originals.set(name, value)
      attributes.push({ element, name, original: originals.get(name)! })
    }
  }
  return attributes
}

function translateKnownUiAttributes(target: TranslationLanguage): void {
  for (const { element, name, original } of translatableUiAttributes()) {
    const translated = boundUiAttribute(element,name,target.code) ?? translateUiLabel(original.trim(), target.code)
    writeUiAttribute(element, name, translated ?? original)
  }
}

function restoreOriginalUiAttributes(): void {
  for (const { element, name, original } of translatableUiAttributes()) writeUiAttribute(element, name, original)
}

function translateKnownUiNodes(target: TranslationLanguage): void {
  for (const node of translatableUiNodes()) {
    const original = ORIGINAL_TEXT.get(node) ?? node.textContent ?? ''
    const bound=boundUiText(node,target.code)
    if(bound!==undefined){node.textContent=bound;continue}
    const translated = translateUiLabel(original.trim(), target.code)
    if (!translated) continue
    const leading = original.match(/^\s*/)?.[0] ?? ''
    const trailing = original.match(/\s*$/)?.[0] ?? ''
    node.textContent = `${leading}${translated}${trailing}`
  }
  translateKnownUiAttributes(target)
}

async function translateUi(target: TranslationLanguage): Promise<void> {
  const request = ++uiTranslationRequest
  if (target.code === 'ar') {
    const nodes = translatableUiNodes()
    for (const node of nodes) node.textContent = ORIGINAL_TEXT.get(node) ?? node.textContent
    restoreOriginalUiAttributes()
    document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl'
    delete document.documentElement.dataset.siteLanguage
    if (originalDocumentTitle) document.title = originalDocumentTitle
    localStorage.removeItem(SITE_LANGUAGE_KEY)
    repaintAuthorDisplayNames()
    repaintBookDisplayTitles()
    return
  }
  // Name/title dictionaries are optional presentation enrichment. A missing
  // chunk keeps canonical names; it must not prevent the core UI language.
  await Promise.all([uiDictionary.ready(), Promise.allSettled([prepareAuthorDisplayLocale(target.code), prepareBookDisplayLocale(target.code)])])
  if (request !== uiTranslationRequest) return
  const nodes = translatableUiNodes()
  const prepared = nodes.map(node => {
    const original = ORIGINAL_TEXT.get(node) ?? node.textContent ?? ''
    const bound=boundUiText(node,target.code)
    const translated = bound ?? translateUiLabel(original.trim(), target.code)
    return { node, original, translated, bound }
  })
  // اعرض القاموس المحلي فورًا؛ أسماء الكتب/المؤلفين المتغيرة لا يجوز أن
  // تعطل ترجمة القشرة كلها أو تعيدها إلى مزيج غير مستقر.
  for (const { node, original, translated, bound } of prepared) {
    if(bound!==undefined){node.textContent=bound;continue}
    if (!translated) continue
    const leading = original.match(/^\s*/)?.[0] ?? ''
    const trailing = original.match(/\s*$/)?.[0] ?? ''
    node.textContent = `${leading}${translated}${trailing}`
  }
  translateKnownUiAttributes(target)
  if (!originalDocumentTitle || document.documentElement.lang === 'ar') originalDocumentTitle = document.title
  for (const { node, original, translated, bound } of prepared) {
    if(bound!==undefined){node.textContent=bound;continue}
    // واجهة الموقع محلية بالكامل: المفتاح غير المترجم يرجع إلى العربية
    // فورًا ولا يطلق طلب شبكة أو يعرض رسالة انتظار.
    const resolved = translated
    if (!resolved) { node.textContent = original; continue }
    const leading = original.match(/^\s*/)?.[0] ?? ''
    const trailing = original.match(/\s*$/)?.[0] ?? ''
    node.textContent = `${leading}${resolved}${trailing}`
  }
  document.documentElement.lang = target.code
  document.documentElement.dir = target.dir
  document.documentElement.dataset.siteLanguage = target.code
  document.title = originalDocumentTitle.split(' - ').map(part => translateUiLabel(part.trim(), target.code) ?? part).join(' - ')
  localStorage.setItem(SITE_LANGUAGE_KEY, target.code)
  repaintAuthorDisplayNames()
  repaintBookDisplayTitles()
}

function languageList(onChoose: (language: TranslationLanguage) => void, includeArabic = false): HTMLElement {
  const filter = h('input', { type: 'search', class: 'translation-dialog__filter', placeholder: 'صفِّ اللغات…', 'aria-label': 'تصفية اللغات' }) as HTMLInputElement
  const list = h('div', { class: 'translation-dialog__languages', role: 'listbox', 'aria-label': 'لغات الترجمة' })
  const languages: TranslationLanguage[] = includeArabic
    ? [{ code: 'ar', label: 'العربية — اللغة الأصلية', native: 'العربية', dir: 'rtl' }, ...TRANSLATION_LANGUAGES]
    : [...TRANSLATION_LANGUAGES]
  const render = (): void => {
    const query = normalize(filter.value)
    const selectedCode = localStorage.getItem(SITE_LANGUAGE_KEY) || 'ar'
    list.replaceChildren(...languages.filter(language => normalize(`${language.label} ${language.native} ${language.code} ${translateUiLabel(language.label,selectedCode)??''}`).includes(query)).map(language => {
      const selected = language.code === selectedCode
      const button = h('button', { type: 'button', role: 'option', class: `translation-language${selected ? ' is-selected' : ''}`, 'aria-selected': selected ? 'true' : 'false' }, h('span', null, language.label), nativeLanguageName(language))
      button.addEventListener('click', () => onChoose(language))
      return button
    }))
  }
  filter.addEventListener('input', render); render()
  if(localStorage.getItem(SITE_LANGUAGE_KEY))void uiDictionary.ready().then(render).catch(()=>undefined)
  return h('div', { class: 'translation-dialog__picker' }, filter, list)
}

function nativeLanguageName(language: TranslationLanguage): HTMLElement {
  const native = h('small', { dir: language.dir, dataset: { noTranslate: 'true' } }, language.native)
  native.setAttribute('lang', language.code)
  return native
}

export function openSiteLanguageDialog(anchor?: HTMLElement): void {
  document.querySelector<HTMLDialogElement>('.translation-dialog')?.close()
  const dialog = h('dialog', { class: 'translation-dialog translation-dialog--languages translation-dialog--anchored', 'aria-labelledby': 'site-language-title' }) as HTMLDialogElement
  const close = h('button', { class: 'translation-dialog__close', type: 'button', 'aria-label': 'إغلاق قائمة اللغات' }, icon('close', 20))
  const status = h('p', { class: 'translation-dialog__notice', role: 'status', 'aria-live': 'polite' }, 'اختر لغة واجهة الخِزانة. تبقى نصوص الكتب بلغتها الأصلية حتى تطلب ترجمتها.')
  const picker = languageList(language => {
    dialog.close()
    // احفظ اختيار المستخدم فورًا؛ فإذا انقطع طلب ترجمة واجهة نادر، يعاد
    // تطبيق الاختيار تلقائيًا في الانتقال/إعادة التحميل التالية.
    if (language.code === 'ar') localStorage.removeItem(SITE_LANGUAGE_KEY)
    else localStorage.setItem(SITE_LANGUAGE_KEY, language.code)
    void translateUi(language).then(() => toast(`تم تطبيق لغة الواجهة: ${language.label}`))
      .catch(error => toast(error instanceof Error ? error.message : 'تعذرت ترجمة الواجهة.'))
  }, true)
  close.addEventListener('click', () => dialog.close())
  const closeFromOutside = (event: PointerEvent): void => { if (!dialog.contains(event.target as Node) && event.target !== anchor) dialog.close() }
  dialog.addEventListener('close', () => { document.removeEventListener('pointerdown', closeFromOutside, true); dialog.remove() })
  dialog.append(h('div', { class: 'translation-dialog__panel' }, h('header', null, h('h2', { id: 'site-language-title' }, icon('globe', 22), 'لغة الموقع'), close), status, picker))
  document.body.appendChild(dialog)
  if (anchor) {
    const rect = anchor.getBoundingClientRect(), width = Math.min(440, window.innerWidth - 16)
    const left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width))
    dialog.style.setProperty('--translation-popover-top', `${Math.min(window.innerHeight - 90, rect.bottom + 8)}px`)
    dialog.style.setProperty('--translation-popover-left', `${left}px`)
    dialog.style.setProperty('--translation-popover-width', `${width}px`)
  }
  dialog.show()
  // القائمة عقدة جديدة بعد آخر route؛ أعد تطبيق اللغة المحفوظة عليها أيضًا.
  restoreSelectedSiteLanguage()
  queueMicrotask(() => document.addEventListener('pointerdown', closeFromOutside, true))
  dialog.querySelector<HTMLInputElement>('.translation-dialog__filter')?.focus()
}

export function openTranslationDialog(initialText = ''): void {
  document.querySelector<HTMLDialogElement>('.translation-dialog')?.close()
  const dialog = h('dialog', { class: 'translation-dialog', 'aria-labelledby': 'translation-dialog-title' }) as HTMLDialogElement
  const translationNotice = 'ترجمة آلية غير مدققة؛ ينبغي مراجعة المصطلحات والأسماء والنصوص الشرعية قبل النشر'
  const info = h('button', {
    class: 'translation-dialog__info', type: 'button',
    'aria-label': translationNotice, title: translationNotice,
    dataset: { tooltip: translationNotice },
  }, icon('info', 18))
  const title = h('div', { class: 'translation-dialog__title' }, h('h2', { id: 'translation-dialog-title' }, icon('globe', 22), 'ترجمة النص'), info)
  const close = h('button', { class: 'translation-dialog__close', type: 'button', 'aria-label': 'إغلاق الترجمة' }, icon('close', 20))
  const source = h('textarea', { class: 'translation-dialog__source', dir: 'rtl', placeholder: 'الصق نصًا عربيًا أو حدّد نصًا داخل الكتاب…', 'aria-label': 'النص العربي المراد ترجمته' }) as HTMLTextAreaElement
  source.value = initialText
  const filter = h('input', {
    type: 'search', class: 'translation-dialog__filter', placeholder: 'اختر لغة الترجمة أو ابحث…',
    role: 'combobox', 'aria-label': 'لغة الترجمة', 'aria-expanded': 'false',
  }) as HTMLInputElement
  filter.setAttribute('aria-autocomplete', 'list')
  filter.setAttribute('aria-controls', 'translation-language-options')
  const toggleLanguages = h('button', {
    type: 'button', class: 'translation-dialog__combobox-toggle',
    'aria-label': 'عرض لغات الترجمة', 'aria-expanded': 'false',
  }, icon('chevron-left', 18)) as HTMLButtonElement
  toggleLanguages.setAttribute('aria-controls', 'translation-language-options')
  const list = h('div', {
    id: 'translation-language-options', class: 'translation-dialog__languages translation-dialog__languages--combobox',
    role: 'listbox', 'aria-label': 'لغات الترجمة',
  })
  let target = translationTargetForSiteLanguage(localStorage.getItem(SITE_LANGUAGE_KEY))
  const displayLanguageLabel=(language:TranslationLanguage):string=>translateUiLabel(language.label,localStorage.getItem(SITE_LANGUAGE_KEY)||'ar')??language.label
  filter.value = target ? displayLanguageLabel(target) : ''
  if(target&&localStorage.getItem(SITE_LANGUAGE_KEY)){
    const initialTarget=target,initialLabel=filter.value
    void uiDictionary.ready().then(()=>{if(!dialog.isConnected)return;if(target===initialTarget&&filter.value===initialLabel)filter.value=displayLanguageLabel(initialTarget);renderLanguages()}).catch(()=>undefined)
  }
  const result = h('div', { class: 'translation-dialog__result', role: 'status', 'aria-live': 'polite' }, h('span',null,target ? `لغة الواجهة (${target.label}) هي هدف الترجمة الافتراضي.` : 'اختر لغة الهدف أولًا، ثم اضغط «ترجم».'))
  const setResultStatus=(text:string|Text):void=>result.replaceChildren(h('span',null,text))
  const providerStatus = h('small', { class: 'translation-dialog__provider', 'aria-live': 'polite' })
  const prepareLocal = h('button', {
    class: 'button translation-dialog__prepare-local', type: 'button', hidden: true,
  }, 'تجهيز الترجمة المحلية على هذا الجهاز') as HTMLButtonElement
  const translate = h('button', { class: 'button translation-dialog__translate', type: 'button' }, 'ترجم') as HTMLButtonElement
  translate.disabled = !target
  const setLanguagesOpen = (open: boolean): void => {
    list.hidden = !open
    filter.setAttribute('aria-expanded', String(open))
    toggleLanguages.setAttribute('aria-expanded', String(open))
    toggleLanguages.classList.toggle('is-open', open)
  }
  const renderLanguages = (): void => {
    const query = normalize(filter.value)
    const matches = TRANSLATION_LANGUAGES.filter(language => normalize(`${language.label} ${language.native} ${language.code} ${displayLanguageLabel(language)}`).includes(query))
    list.replaceChildren(...matches.map((language, index) => {
      const button = h('button', {
        id: `translation-language-option-${index}`, type: 'button', role: 'option',
        class: `translation-language${language.code === target?.code ? ' is-selected' : ''}`,
        'aria-selected': language.code === target?.code ? 'true' : 'false',
      }, h('span', null, language.label), nativeLanguageName(language))
      button.addEventListener('click', () => {
        target = language
        filter.value = displayLanguageLabel(language)
        translate.disabled = false
        result.dir = 'rtl'
        setResultStatus(uiTemplateText('e87f74debd4ce675',{p1:uiLabelParameter(language.label)}))
        renderLanguages()
        setLanguagesOpen(false)
        translate.focus()
      })
      return button
    }))
  }
  filter.addEventListener('input', () => { renderLanguages(); setLanguagesOpen(true) })
  filter.addEventListener('focus', () => setLanguagesOpen(true))
  filter.addEventListener('keydown', event => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setLanguagesOpen(true)
      list.querySelector<HTMLButtonElement>('[role="option"]')?.focus()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      setLanguagesOpen(false)
    }
  })
  toggleLanguages.addEventListener('click', () => {
    const open = list.hidden !== false
    setLanguagesOpen(open)
    if (open) filter.focus()
  })
  // القائمة محلية وثابتة؛ يجب أن تكون جاهزة قبل إظهار النافذة بلا انتظار.
  renderLanguages()
  setLanguagesOpen(!target)
  const runTranslation = async (allowLocalDownload = false): Promise<void> => {
    if (!target) {
      result.dir = 'rtl'
      setResultStatus('اختر لغة الهدف أولًا.')
      return
    }
    const requestTarget = target
    translate.disabled = true
    prepareLocal.hidden = true
    result.classList.add('is-loading')
    setResultStatus(`جارٍ الترجمة إلى ${requestTarget.label}…`)
    try {
      const translated = await translateArabicTextDetailed(source.value, requestTarget, 'text', allowLocalDownload)
      result.dir = requestTarget.dir
      result.replaceChildren(h('span',{dataset:{noTranslate:''}},translated.translation))
      providerStatus.replaceChildren(uiTemplateText('101ff196ab924127',{p1:uiLabelParameter(translationProviderLabel(translated.provider))}))
    } catch (error) {
      result.dir = 'rtl'
      setResultStatus(error instanceof Error ? error.message : 'تعذرت الترجمة.')
      providerStatus.textContent = ''
      if (await browserLocalTranslationAvailability(requestTarget.code) === 'downloadable') {
        prepareLocal.hidden = false
        providerStatus.textContent = 'يمكنك تجهيز محرك هذه اللغة على جهازك بنقرة صريحة؛ لن يبدأ التنزيل تلقائيًا.'
      }
    } finally { translate.disabled = false; result.classList.remove('is-loading') }
  }
  translate.addEventListener('click', () => { void runTranslation() })
  prepareLocal.addEventListener('click', () => { void runTranslation(true) })
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => dialog.remove())
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.append(
    h('div', { class: 'translation-dialog__panel' },
      h('header', null, title, close),
      source,
      h('div', { class: 'translation-dialog__picker' }, h('div', { class: 'translation-dialog__combobox' }, filter, toggleLanguages), list),
      h('div', { class: 'translation-dialog__actions' }, translate),
      result,
      providerStatus,
      prepareLocal,
    ),
  )
  document.body.appendChild(dialog)
  dialog.showModal()
  if (initialText && target) void runTranslation()
  if (!initialText) source.focus(); else if (!target) filter.focus()
}

export function translationButton(className = ''): HTMLButtonElement {
  const button = h('button', {
    type: 'button', class: `translation-launch ${className}`.trim(),
    'aria-label': 'اختيار لغة الموقع', title: 'اختيار لغة الموقع',
    dataset: { languageControl: 'true' },
  }, icon('globe', 20)) as HTMLButtonElement
  button.setAttribute('aria-haspopup', 'dialog')
  button.addEventListener('click', () => openSiteLanguageDialog(button))
  return button
}

function ensureDynamicTranslationObserver(): void {
  if (dynamicTranslationObserver || typeof MutationObserver === 'undefined') return
  dynamicTranslationObserver = new MutationObserver(records => {
    if (!records.some(record => record.addedNodes.length > 0 || (record.type === 'attributes' && record.target instanceof HTMLElement && record.attributeName && record.target.getAttribute(record.attributeName) !== RENDERED_ATTRIBUTES.get(record.target)?.get(record.attributeName)))) return
    window.clearTimeout(dynamicTranslationTimer)
    dynamicTranslationTimer = window.setTimeout(() => {
      normalizeVisibleInterfaceDashes()
      const code = localStorage.getItem(SITE_LANGUAGE_KEY)
      const language = TRANSLATION_LANGUAGES.find(item => item.code === code)
      // A stored preference is a request, not a completed language switch.
      // Pending/failed dictionary loading must not partially translate new UI.
      if (language && document.documentElement.lang === language.code) translateKnownUiNodes(language)
    }, 60)
  })
  dynamicTranslationObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true, attributes: true, attributeFilter: [...UI_TRANSLATABLE_ATTRIBUTES] })
}

export function restoreSelectedSiteLanguage(): void {
  ensureDynamicTranslationObserver()
  const code = localStorage.getItem(SITE_LANGUAGE_KEY)
  const language = TRANSLATION_LANGUAGES.find(item => item.code === code)
  queueMicrotask(() => {
    normalizeVisibleInterfaceDashes()
    if (language && localStorage.getItem(SITE_LANGUAGE_KEY) === language.code) void translateUi(language).catch(() => undefined)
    else if (!localStorage.getItem(SITE_LANGUAGE_KEY)) void translateUi({ code: 'ar', label: 'العربية', native: 'العربية', dir: 'rtl' })
  })
}
