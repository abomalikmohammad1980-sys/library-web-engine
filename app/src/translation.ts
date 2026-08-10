import { h, toast } from './ui'
import { icon } from './icons'
import { translateUiLabel } from './ui_translations'

export interface TranslationLanguage {
  code: string
  label: string
  native: string
  dir: 'rtl' | 'ltr'
}

export const TRANSLATION_LANGUAGES: readonly TranslationLanguage[] = [
  { code: 'en', label: 'الإنجليزية', native: 'English', dir: 'ltr' },
  { code: 'fr', label: 'الفرنسية', native: 'Français', dir: 'ltr' },
  { code: 'ug', label: 'الإيغورية', native: 'ئۇيغۇرچە', dir: 'rtl' },
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
const DAILY_REQUEST_LIMIT = 80

function freeDailyUsage(): { key: string; day: string; count: number } {
  const today = new Date().toISOString().slice(0, 10)
  const key = 'khizana:translation-free-usage'
  let state: { day: string; count: number } = { day: today, count: 0 }
  try { state = JSON.parse(localStorage.getItem(key) || JSON.stringify(state)) as typeof state } catch { /* قيمة تالفة تبدأ من الصفر */ }
  if (state.day !== today) state = { day: today, count: 0 }
  if (state.count >= DAILY_REQUEST_LIMIT) throw new Error('انتهى الحد المجاني للترجمة اليوم. الترجمات المحفوظة تبقى متاحة، ويعود الحد غدًا.')
  return { key, ...state }
}

async function cacheKey(text: string, language: string, purpose: 'text' | 'ui'): Promise<string> {
  const bytes = new TextEncoder().encode(`v2\0ar\0${language}\0${purpose}\0${text}`)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return `khizana:translation:${Array.from(new Uint8Array(digest)).map(byte => byte.toString(16).padStart(2, '0')).join('')}`
}

export async function translateArabicText(text: string, target: TranslationLanguage, purpose: 'text' | 'ui' = 'text'): Promise<string> {
  const source = text.trim()
  if (!source) throw new Error('اكتب نصًا أو حدّد نصًا من الكتاب أولًا.')
  if (source.length > 6000) throw new Error('الحد الأقصى للترجمة الواحدة 6000 محرف؛ حدّد مقطعًا أقصر.')
  const key = await cacheKey(source, target.code, purpose)
  const cached = localStorage.getItem(key)
  if (cached) return cached
  const usage = freeDailyUsage()
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 20_000)
  const response = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: source, sourceLanguage: 'ar', targetLanguage: target.code, purpose }),
    signal: controller.signal,
  }).finally(() => window.clearTimeout(timeout))
  const payload = await response.json().catch(() => ({})) as { translation?: string; error?: string }
  if (!response.ok || !payload.translation) throw new Error(payload.error || 'تعذرت الترجمة الآن؛ حاول مرة أخرى.')
  localStorage.setItem(usage.key, JSON.stringify({ day: usage.day, count: usage.count + 1 }))
  try { localStorage.setItem(key, payload.translation) } catch { /* التخزين المؤقت تحسين اختياري */ }
  return payload.translation
}

const ORIGINAL_TEXT = new WeakMap<Text, string>()
const ORIGINAL_ATTRIBUTES = new WeakMap<HTMLElement, Map<string, string>>()
let originalDocumentTitle = ''
let dynamicTranslationObserver: MutationObserver | undefined
let dynamicTranslationTimer = 0
const SITE_LANGUAGE_KEY = 'khizana:site-language'
const UI_TEXT_SELECTOR = 'h1,h2,h3,h4,h5,h6,p,a,button,label,legend,option,dt,dd,th,td,summary,strong,em,small,span,.eyebrow,.chip,.book-card__meta,.book-card__title,.book-card__author'
const UI_TRANSLATABLE_ATTRIBUTES = ['aria-label', 'placeholder', 'title'] as const

/**
 * يسجل عنوان المسار العربي بوصفه المصدر الحاكم، ثم يعرض ترجمته وفق اللغة
 * المحفوظة. من دون هذا العقد كان الانتقال أثناء بقاء الواجهة مترجمة يعيد
 * استعمال عنوان المسار السابق (مثل Home داخل صفحة القرآن).
 */
export function setSourceDocumentTitle(title: string): void {
  originalDocumentTitle = title
  const code = localStorage.getItem(SITE_LANGUAGE_KEY)
  const language = TRANSLATION_LANGUAGES.find(item => item.code === code)
  document.title = language
    ? title.split(' — ').map(part => translateUiLabel(part.trim(), language.code) ?? part).join(' — ')
    : title
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
    if (element.closest('.reading__page-slot,.reader__pdf-viewport,[data-no-translate]')) continue
    let originals = ORIGINAL_ATTRIBUTES.get(element)
    if (!originals) { originals = new Map(); ORIGINAL_ATTRIBUTES.set(element, originals) }
    for (const name of UI_TRANSLATABLE_ATTRIBUTES) {
      const value = element.getAttribute(name)
      if (!value?.trim()) continue
      if (!originals.has(name)) originals.set(name, value)
      attributes.push({ element, name, original: originals.get(name)! })
    }
  }
  return attributes
}

function translateKnownUiAttributes(target: TranslationLanguage): void {
  for (const { element, name, original } of translatableUiAttributes()) {
    const translated = translateUiLabel(original.trim(), target.code)
    if (translated) element.setAttribute(name, translated)
  }
}

function restoreOriginalUiAttributes(): void {
  for (const { element, name, original } of translatableUiAttributes()) element.setAttribute(name, original)
}

function translateKnownUiNodes(target: TranslationLanguage): void {
  for (const node of translatableUiNodes()) {
    const original = ORIGINAL_TEXT.get(node) ?? node.textContent ?? ''
    const translated = translateUiLabel(original.trim(), target.code)
    if (!translated) continue
    const leading = original.match(/^\s*/)?.[0] ?? ''
    const trailing = original.match(/\s*$/)?.[0] ?? ''
    node.textContent = `${leading}${translated}${trailing}`
  }
  translateKnownUiAttributes(target)
}

async function translateUi(target: TranslationLanguage): Promise<void> {
  const nodes = translatableUiNodes()
  if (target.code === 'ar') {
    for (const node of nodes) node.textContent = ORIGINAL_TEXT.get(node) ?? node.textContent
    restoreOriginalUiAttributes()
    document.documentElement.lang = 'ar'; document.documentElement.dir = 'rtl'
    if (originalDocumentTitle) document.title = originalDocumentTitle
    localStorage.removeItem(SITE_LANGUAGE_KEY)
    return
  }
  const prepared = nodes.map(node => {
    const original = ORIGINAL_TEXT.get(node) ?? node.textContent ?? ''
    const translated = translateUiLabel(original.trim(), target.code)
    return { node, original, translated }
  })
  // اعرض القاموس المحلي فورًا؛ أسماء الكتب/المؤلفين المتغيرة لا يجوز أن
  // تعطل ترجمة القشرة كلها أو تعيدها إلى مزيج غير مستقر.
  for (const { node, original, translated } of prepared) {
    if (!translated) continue
    const leading = original.match(/^\s*/)?.[0] ?? ''
    const trailing = original.match(/\s*$/)?.[0] ?? ''
    node.textContent = `${leading}${translated}${trailing}`
  }
  translateKnownUiAttributes(target)
  const missing = [...new Set(prepared.filter(item => !item.translated).map(item => item.original.trim()).filter(Boolean))]
  let live = new Map<string, string>()
  if (missing.length) {
    try { live = await translateMissingUiLabels(missing, target) }
    catch { /* تبقى البيانات المتغيرة بأصلها، ولا تتراجع ترجمة القشرة المحلية */ }
  }
  if (!originalDocumentTitle || document.documentElement.lang === 'ar') originalDocumentTitle = document.title
  for (const { node, original, translated } of prepared) {
    const resolved = translated ?? live.get(original.trim())
    if (!resolved) { node.textContent = original; continue }
    const leading = original.match(/^\s*/)?.[0] ?? ''
    const trailing = original.match(/\s*$/)?.[0] ?? ''
    node.textContent = `${leading}${resolved}${trailing}`
  }
  document.documentElement.lang = target.code
  document.documentElement.dir = target.dir
  document.title = originalDocumentTitle.split(' — ').map(part => translateUiLabel(part.trim(), target.code) ?? live.get(part.trim()) ?? part).join(' — ')
  localStorage.setItem(SITE_LANGUAGE_KEY, target.code)
}

async function translateMissingUiLabels(labels: string[], target: TranslationLanguage): Promise<Map<string, string>> {
  const result = new Map<string, string>(), chunks: string[][] = []
  let chunk: string[] = [], size = 0
  for (const label of labels) {
    const next = label.length + 24
    if (chunk.length && (size + next > 5200 || chunk.length >= 45)) { chunks.push(chunk); chunk = []; size = 0 }
    chunk.push(label); size += next
  }
  if (chunk.length) chunks.push(chunk)
  for (const group of chunks) {
    const source = group.map((label, index) => `[[KHZ_${index + 1}]] ${label}`).join('\n')
    const translated = await translateArabicText(source, target, 'ui')
    const markers = [...translated.matchAll(/\[\[KHZ_(\d+)\]\]\s*/g)]
    if (markers.length !== group.length) throw new Error('تعذر تثبيت حدود عبارات الواجهة المترجمة؛ بقيت الشاشة عربية كاملة.')
    for (let index = 0; index < markers.length; index += 1) {
      const start = (markers[index]!.index ?? 0) + markers[index]![0].length
      const end = markers[index + 1]?.index ?? translated.length
      const value = translated.slice(start, end).trim()
      if (!value) throw new Error('وصلت ترجمة واجهة ناقصة؛ بقيت الشاشة عربية كاملة.')
      result.set(group[Number(markers[index]![1]) - 1]!, value)
    }
  }
  return result
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
    list.replaceChildren(...languages.filter(language => normalize(`${language.label} ${language.native} ${language.code}`).includes(query)).map(language => {
      const selected = language.code === selectedCode
      const button = h('button', { type: 'button', role: 'option', class: `translation-language${selected ? ' is-selected' : ''}`, 'aria-selected': selected ? 'true' : 'false' }, h('span', null, language.label), nativeLanguageName(language))
      button.addEventListener('click', () => onChoose(language))
      return button
    }))
  }
  filter.addEventListener('input', render); render()
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
    toast(`بدأت ترجمة واجهة الخِزانة إلى ${language.label}؛ ستظهر العبارات تباعًا.`)
    void translateUi(language).catch(error => toast(error instanceof Error ? error.message : 'تعذرت ترجمة الواجهة.'))
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
  const title = h('h2', { id: 'translation-dialog-title' }, icon('globe', 22), 'ترجمة النص')
  const close = h('button', { class: 'translation-dialog__close', type: 'button', 'aria-label': 'إغلاق الترجمة' }, icon('close', 20))
  const source = h('textarea', { class: 'translation-dialog__source', dir: 'rtl', placeholder: 'الصق نصًا عربيًا أو حدّد نصًا داخل الكتاب…', 'aria-label': 'النص العربي المراد ترجمته' }) as HTMLTextAreaElement
  source.value = initialText
  const filter = h('input', { type: 'search', class: 'translation-dialog__filter', placeholder: 'صفِّ اللغات…', 'aria-label': 'تصفية اللغات' }) as HTMLInputElement
  const list = h('div', { class: 'translation-dialog__languages', role: 'listbox', 'aria-label': 'لغات الترجمة' })
  const result = h('div', { class: 'translation-dialog__result', role: 'status', 'aria-live': 'polite' }, 'اختر اللغة ثم اضغط «ترجم».')
  const translate = h('button', { class: 'button button--primary', type: 'button' }, 'ترجم') as HTMLButtonElement
  let target = TRANSLATION_LANGUAGES[0]!
  const renderLanguages = (): void => {
    const query = normalize(filter.value)
    const matches = TRANSLATION_LANGUAGES.filter(language => normalize(`${language.label} ${language.native} ${language.code}`).includes(query))
    list.replaceChildren(...matches.map(language => {
      const button = h('button', {
        type: 'button', role: 'option', class: `translation-language${language.code === target.code ? ' is-selected' : ''}`,
        'aria-current': language.code === target.code ? 'true' : undefined,
      }, h('span', null, language.label), nativeLanguageName(language))
      button.addEventListener('click', () => { target = language; renderLanguages() })
      return button
    }))
  }
  filter.addEventListener('input', renderLanguages)
  translate.addEventListener('click', async () => {
    translate.disabled = true
    result.classList.add('is-loading')
    result.textContent = `جارٍ الترجمة إلى ${target.label}…`
    try {
      const translated = await translateArabicText(source.value, target)
      result.dir = target.dir
      result.textContent = translated
    } catch (error) {
      result.dir = 'rtl'
      result.textContent = error instanceof Error ? error.message : 'تعذرت الترجمة.'
    } finally { translate.disabled = false; result.classList.remove('is-loading') }
  })
  close.addEventListener('click', () => dialog.close())
  dialog.addEventListener('close', () => dialog.remove())
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close() })
  dialog.append(
    h('div', { class: 'translation-dialog__panel' },
      h('header', null, title, close),
      h('p', { class: 'translation-dialog__notice' }, 'ترجمة آلية للمراجعة؛ راجع أسماء الأعلام والنصوص الشرعية قبل الاعتماد أو النشر.'),
      source,
      h('div', { class: 'translation-dialog__picker' }, filter, list),
      h('div', { class: 'translation-dialog__actions' }, translate),
      result,
    ),
  )
  document.body.appendChild(dialog)
  dialog.showModal()
  if (!initialText) source.focus(); else filter.focus()
}

export function translationButton(className = ''): HTMLButtonElement {
  const button = h('button', { type: 'button', class: `translation-launch ${className}`.trim(), 'aria-label': 'اختيار لغة الموقع', title: 'ترجمة الموقع' }, icon('globe', 20)) as HTMLButtonElement
  button.addEventListener('click', () => openSiteLanguageDialog(button))
  return button
}

function ensureDynamicTranslationObserver(): void {
  if (dynamicTranslationObserver || typeof MutationObserver === 'undefined') return
  dynamicTranslationObserver = new MutationObserver(records => {
    if (!records.some(record => record.addedNodes.length > 0)) return
    window.clearTimeout(dynamicTranslationTimer)
    dynamicTranslationTimer = window.setTimeout(() => {
      const code = localStorage.getItem(SITE_LANGUAGE_KEY)
      const language = TRANSLATION_LANGUAGES.find(item => item.code === code)
      if (language) translateKnownUiNodes(language)
    }, 60)
  })
  dynamicTranslationObserver.observe(document.body ?? document.documentElement, { childList: true, subtree: true })
}

export function restoreSelectedSiteLanguage(): void {
  ensureDynamicTranslationObserver()
  const code = localStorage.getItem(SITE_LANGUAGE_KEY)
  const language = TRANSLATION_LANGUAGES.find(item => item.code === code)
  if (language) queueMicrotask(() => { void translateUi(language).catch(() => undefined) })
}
