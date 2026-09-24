const SHAMELA_SYMBOL_LABELS: Readonly<Record<string, string>> = {
  'ﷺ': 'صلى الله عليه وسلم',
  '﵀': 'رحمه الله',
  '﵁': 'رضي الله عنه',
  '﵂': 'رضي الله عنها',
  '﵃': 'رضي الله عنهم',
  '﵄': 'رضي الله عنهما',
  '﵅': 'رضي الله عنهن',
  '﵆': 'صلى الله عليه وآله',
  '﵇': 'عليه السلام',
  '﵈': 'عليهم السلام',
  '﵉': 'عليهما السلام',
  '﵊': 'عليه الصلاة والسلام',
  '﵌': 'صلى الله عليه وآله وسلم',
  '﵍': 'عليها السلام',
  '﵎': 'تبارك وتعالى',
  '﵏': 'رحمهم الله',
  '﷿': 'جل جلاله',
  'ﷻ': 'جل جلاله',
  '﷾': 'سبحانه وتعالى',
}

const SHAMELA_SYMBOL_PATTERN = /[ﷺ﵀-﵊﵌-﵏ﷻ﷾﷿]/gu
const SHAMELA_PUNCTUATION_FALLBACKS: Readonly<Record<string, string>> = {
  '﹐': '،',
  '﹑': '،',
  '，': '،',
}

/** رموز الشاملة تبقى زخرفية بصريًا، لكن معناها يصير متاحًا لقارئ الشاشة. */
export function shamelaSymbolParts(value: string): Array<{ text: string; label?: string }> {
  value = [...value].map(char => SHAMELA_PUNCTUATION_FALLBACKS[char] ?? char).join('')
  const parts: Array<{ text: string; label?: string }> = []
  let cursor = 0
  for (const match of value.matchAll(SHAMELA_SYMBOL_PATTERN)) {
    const start = match.index ?? 0
    if (start > cursor) parts.push({ text: value.slice(cursor, start) })
    const symbol = match[0]
    const label = SHAMELA_SYMBOL_LABELS[symbol] ?? symbol
    // لا نعتمد على وجود غليف presentation-form في خط الجهاز؛ النص الكامل
    // ظاهر وقابل للنسخ والبحث، مع بقاء المعنى الدلالي نفسه لقارئ الشاشة.
    parts.push({ text: label, label })
    cursor = start + symbol.length
  }
  if (cursor < value.length) parts.push({ text: value.slice(cursor) })
  return parts
}

/** علامة ¬ أثر ترميز داخلي وليست جزءًا من رقم الحاشية. */
export function cleanShamelaFootnoteMarks(value: string): string {
  return value.replace(/¬(?=\s*[\d٠-٩۰-۹])/gu, '')
}

export function isShamelaBasmalah(value: string): boolean {
  const compact = value.replace(/[\sـ]+/gu, '').replace(/[﴾﴿()]/gu, '')
  return compact === '﷽' || compact === 'بسماللهالرحمنالرحيم'
}

const TEXTUAL_NOTE_MARKER = /^\s*(?:\(\s*([\d٠-٩۰-۹]+|[*⁎∗]{1,4})\s*\)|\[\s*([\d٠-٩۰-۹]+|[*⁎∗]{1,4})\s*\]|([\d٠-٩۰-۹]+)[.):-])\s*/u
// التقسيم الداخلي يقتصر على العلامات المحاطة؛ صيغ مثل «١/ ٢٤)» داخل
// المراجع الببليوغرافية ليست بداية حاشية جديدة.
const TEXTUAL_NOTE_MARKER_GLOBAL = /(?:\(\s*(?:[\d٠-٩۰-۹]+|[*⁎∗]{1,4})\s*\)|\[\s*(?:[\d٠-٩۰-۹]+|[*⁎∗]{1,4})\s*\])\s*/gu

export interface TextualFootnoteLine {
  marker?: string
  body: string
  continuation: boolean
}

/** يفصل رقم الحاشية عن متنها دلاليًا؛ يرسمهما القارئ متجاورين في السطر نفسه. */
export function parseTextualFootnoteLine(value: string, insideFootnotes = false): TextualFootnoteLine | undefined {
  const clean = value.replace(/¬/gu, '').trim()
  const match = clean.match(TEXTUAL_NOTE_MARKER)
  if (!match && !insideFootnotes) return undefined
  const marker = match?.slice(1).find(Boolean)
  return { ...(marker ? { marker } : {}), body: match ? clean.slice(match[0].length) : clean, continuation: !marker }
}

/** يفصل حواشي الشاملة الملصقة في سطر واحد من غير شطر أرقام المتن العادية. */
export function splitTextualFootnoteEntries(value: string, insideFootnotes = false): string[] {
  const clean = value.replace(/¬/gu, '').trim()
  if (!insideFootnotes && !TEXTUAL_NOTE_MARKER.test(clean)) return [clean]
  const starts = [...clean.matchAll(TEXTUAL_NOTE_MARKER_GLOBAL)].map(match => match.index ?? 0)
  if (!starts.length || starts[0] !== 0) return [clean]
  return starts.map((start, index) => clean.slice(start, starts[index + 1] ?? clean.length).trim()).filter(Boolean)
}

/**
 * يطبّق الدلالات الطباعية المشتركة على DOM مستورد (EPUB خصوصًا)، من دون
 * المساس ببسملة واردة داخل جملة أو تحويل كل رقم علوي إلى حاشية.
 */
export function decorateImportedTextualDom(root: ParentNode): void {
  for (const node of root.querySelectorAll<HTMLElement>('p, div, h1, h2, h3, h4, h5, h6')) {
    if (isShamelaBasmalah(node.textContent ?? '')) node.classList.add('reader__text-basmalah')
  }
  for (const node of root.querySelectorAll<HTMLElement>('[epub\\:type~="noteref"], [type~="noteref"], [role="doc-noteref"], .noteref, a[href*="#fn"], a[href*="#note"]')) {
    const marker = node.closest('sup') ?? node
    marker.classList.add('reader__text-note-ref')
    // Preserve the noteref anchor and nested formatting: replacing a parent
    // sup's textContent destroys navigation to the note.
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT)
    const texts: Text[] = []
    while (walker.nextNode()) texts.push(walker.currentNode as Text)
    for (const text of texts) text.data = text.data.replace(/¬/gu, '')
    if (/^\s*[\d٠-٩۰-۹]+\s*$/u.test(node.textContent ?? '') && texts.length) {
      texts[0]!.data = '(' + texts[0]!.data.trimStart()
      texts[texts.length - 1]!.data = texts[texts.length - 1]!.data.trimEnd() + ')'
    }
  }
  for (const note of root.querySelectorAll<HTMLElement>('[epub\\:type~="footnote"], [type~="footnote"], [role="doc-footnote"], .footnote, aside.footnote, li[id*="footnote"], li[id^="fn"]')) {
    note.classList.add('reader__text-imported-note')
    decorateImportedFootnoteInline(note)
    for (const text of [...note.childNodes]) if (text.nodeType === Node.TEXT_NODE) text.textContent = (text.textContent ?? '').replace(/¬/gu, '')
  }
}

/** Normalize only a numeric label at the start of an explicitly marked note.
 * Keep backlink elements and every body node intact; never touch Word DOM. */
export function decorateImportedFootnoteInline(note: HTMLElement): void {
  const term=note.tagName==='DL'?note.querySelector<HTMLElement>(':scope > dt'):null
  const leading=term??note.querySelector<HTMLElement>('sup, a')
  const marker=leading?.querySelector<HTMLElement>('a')??leading
  if(!marker)return
  if(!term&&!(note.textContent??'').trimStart().startsWith((marker.textContent??'').trim()))return
  const raw=(term??marker).textContent??'',number=raw.replace(/[\s()[\]←↩¬.:-]/gu,'')
  if(!/^[\d٠-٩۰-۹]+$/u.test(number))return
  marker.textContent=`(${number}) `
  marker.classList.add('reader__text-note-number')
  marker.closest('sup')?.classList.add('reader__text-note-number')
  if(term){term.replaceChildren(marker===term?document.createTextNode(`(${number}) `):marker);note.classList.add('reader__text-note-inline')}
}

/** 99999 وأمثالها قيم sentinel في master وليست سنة قابلة للعرض. */
export function displayableHijriPublicationYear(value: number | null | undefined): number | undefined {
  return Number.isInteger(value) && value! >= 1 && value! <= 2000 ? value! : undefined
}


function decodeShamelaEntity(match: string, raw: string): string {
  const value = raw[0]?.toLowerCase() === 'x'
    ? Number.parseInt(raw.slice(1), 16)
    : Number.parseInt(raw, 10)
  return Number.isInteger(value) && value >= 0 && value <= 0x10ffff
    ? String.fromCodePoint(value)
    : match
}

function decodeShamelaMarkupEntities(value: string): string {
  return value
    .replace(/&(?:nbsp|#160);/giu, ' ')
    .replace(/&lt;/giu, '<').replace(/&gt;/giu, '>').replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'").replace(/&amp;/giu, '&')
    .replace(/&#(x[0-9a-f]+|\d+);/giu, decodeShamelaEntity)
}

export interface ShamelaStructuralControl {
  kind: 'separator' | 'style'
  offset: number
  level?: number
}

/**
 * يحفظ دلالة فواصل الشاملة القديمة حتى لو كانت الحزمة سابقة للتطبيع البنيوي.
 * المواضع هنا في النص النظيف نفسه، لذلك لا تظهر الوسوم ولا تنكسر الإزاحات.
 */
export function parseShamelaStructuralText(value: string): { text: string; controls: ShamelaStructuralControl[] } {
  const decoded = decodeShamelaMarkupEntities(value.replace(/\r\n?|\u2028|\u2029/gu, '\n'))
  const controls: ShamelaStructuralControl[] = []
  for (const match of decoded.matchAll(/<\s*(hr\b[^>]*|s(\d+)\s*)\/?>/giu)) {
    const offset = cleanShamelaPlainText(decoded.slice(0, match.index ?? 0)).length
    if (match[2] == null) controls.push({ kind: 'separator', offset })
    else controls.push({ kind: 'style', level: Number(match[2]), offset })
  }
  return { text: cleanShamelaPlainText(decoded), controls }
}

/**
 * يحوّل ترميز الشاملة الداخلي إلى نص دلالي آمن للعرض والفهرسة.
 *
 * نحل الكيانات أولًا كي لا ينجو HTML مهرب من التنظيف، ونحوّل فواصل
 * `<hr>` و`<sN>` إلى أسطر بدل حذفها ولصق طرفي النص. أما روابط `inr`
 * فيبقى عنوانها العربي هنا، وتستخرج طبقة البحث معرّفات الرجال قبل التنظيف.
 */
export function cleanShamelaPlainText(value: string): string {
  return decodeShamelaMarkupEntities(value.replace(/\r\n?|\u2028|\u2029/gu, '\n'))
    .replace(/<\s*(?:script|style)\b[^>]*>[\s\S]*?<\s*\/\s*(?:script|style)\s*>/giu, '')
    // قد تتجاور علامة الفصل مع علامة المستوى؛ دلالتهما حدٌّ بنيوي واحد
    // لا سطران فارغان متتاليان في النص المعروض.
    .replace(/(?:\n*<\s*(?:hr\b[^>]*|s\d+\s*)\/?>\n*)+/giu, '\n')
    .replace(/<\s*br\b[^>]*\/?>/giu, '\n')
    .replace(/<\s*\/\s*(?:p|div|li|h[1-6])\s*>/giu, '\n')
    // يشمل الشكل الصحيح والشكل المكسور المرصود: <"a href="inr://...>
    .replace(/<\s*["']?a\b[^>]*\bhref\s*=\s*["']?inr:\/\/[^>]*>/giu, '')
    .replace(/<\s*\/?\s*["']?a\s*\/?\s*>/giu, '')
    .replace(/<[^>]+>/gu, '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '')
    .replace(/[ \t]+\n/gu, '\n').replace(/\n[ \t]+/gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
}

/** يعيد موضعًا من النص الخام إلى موضعه بعد التنظيف؛ تستعمله روابط التخريج والأنماط. */
export function remapShamelaPlainTextOffset(value: string, rawOffset: number): number {
  const safeOffset = Math.max(0, Math.min(value.length, Math.trunc(rawOffset)))
  return cleanShamelaPlainText(value.slice(0, safeOffset)).length
}
