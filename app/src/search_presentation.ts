import type { WordPageMap } from './engine/library_store'
import { cleanShamelaPlainText } from './shamela_text_presentation'

export type SearchMode = 'exact' | 'morphological' | 'root'

export interface CleanSearchText { text: string; narratorIds: string[] }

/** ينظف روابط رجال الشاملة الداخلية مع حفظ معرّفاتهم للربط الدلالي. */
export function cleanSearchText(value: string): CleanSearchText {
  const narratorIds: string[] = []
  const decoded = value.replace(/&lt;/giu, '<').replace(/&gt;/giu, '>')
    .replace(/&quot;/giu, '"').replace(/&#39;/giu, "'").replace(/&amp;/giu, '&')
  for (const match of decoded.matchAll(/<?\s*["']?a\s+href\s*=\s*["']?inr:\/\/man-(\d+)/giu)) {
    if (match[1]) narratorIds.push(match[1])
  }
  const text = cleanShamelaPlainText(decoded)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/gu, '')
    // بعض مصادر الشاملة تضع علامة NOT غير المرئية دلاليًا قبل رقم الحاشية.
    // نحذفها من طبقة العرض/النسخ، ونضم الرقم إلى قوسيه دون تغيير النص المخزن.
    .replace(/¬[\u00a0 \t]*(?=[(\[]?[\u00a0 \t]*[0-9٠-٩۰-۹])/gu, '')
    .replace(/([\[(])[\u00a0 \t]*([0-9٠-٩۰-۹]+)[\u00a0 \t]*([\])])/gu, '$1$2$3')
    .replace(/\s+([،؛:.!?؟])/gu, '$1').replace(/[ \t]{2,}/gu, ' ').trim()
  return { text, narratorIds: [...new Set(narratorIds)] }
}


export interface SearchTextSegment { text: string; footnote: boolean; separator?: boolean; start: number; end: number }

const SEARCH_FOOTNOTE_SEPARATOR = /(?:^|\n)\s*[_ـ]{3,}\s*(?:\n|$)/mu
const SEARCH_FOOTNOTE_REFERENCE = /([\[(])[\u00a0 \t]*[0-9٠-٩۰-۹]+[\u00a0 \t]*([\])])/gmu
// بعض نسخ الشاملة تلصق أول حرف من الحاشية بالقوس: «(٣)هذا…» بينما
// الحواشي التالية فيها مسافة. اشتراط المسافة كان يسقط الأولى، فيوضع الفاصل
// قبل (٤). يكفي كون العلامة في أول السطر لتمييز مدخل الحاشية عن إحالة المتن.
const SEARCH_FOOTNOTE_ENTRY = /(?:^|\n)\s*[\[(]([0-9٠-٩۰-۹]+)[\])](?=[\u00a0 \t]*(?:\S|(?:\r?\n)[\u00a0 \t]*\S))/gmu

function searchFootnoteStructure(text:string):{boundary:number;end:number;ids:Set<string>;explicit:boolean}|undefined{
  const explicit=SEARCH_FOOTNOTE_SEPARATOR.exec(text),from=explicit?explicit.index:0,entries=[...text.matchAll(SEARCH_FOOTNOTE_ENTRY)].filter(match=>(match.index??0)>=from)
  const inferred=!explicit&&entries.length>=2?entries[0]:undefined,boundary=explicit?.index??inferred?.index
  if(boundary==null)return undefined
  const end=explicit?explicit.index+explicit[0].length:boundary,ids=new Set(entries.filter(match=>(match.index??0)>=boundary).map(match=>match[1]!).filter(Boolean))
  return ids.size?{boundary,end,ids,explicit:Boolean(explicit)}:undefined
}

function isQuranVerseNumber(text:string,start:number,end:number):boolean{
  const before=text.slice(Math.max(0,start-48),start),after=text.slice(end,Math.min(text.length,end+24))
  return /(?:الآية|الآيات|آية|سورة)\s*$/u.test(before)||/(?:الآية|الآيات|آية)\s*[:：]?\s*$/u.test(before)||/^\s*(?:[-–—]\s*)?[﴿{]/u.test(after)
}

/**
 * نسخة الحافظة خاصة بالمتن: لا تحمل العلامات البصرية ولا النص الواقع بعد
 * فاصل الحاشية. يبقى النص المعروض كاملًا للقراءة والبحث.
 */
export function searchCopyText(value: string): string {
  const structure=searchFootnoteStructure(value),body=structure?value.slice(0,structure.boundary):value
  return body.replace(SEARCH_FOOTNOTE_REFERENCE,(marker,_open,_close,offset:number)=>structure?.ids.has(marker.replace(/[^0-9٠-٩۰-۹]/gu,''))&&!isQuranVerseNumber(body,offset,offset+marker.length)?'':marker).replace(/[ \t]+\n/gu, '\n').replace(/[ \t]{2,}/gu, ' ').trim()
}

/** تقسيم بصري نقي؛ جمع النصوص يعيد النص نفسه حرفيًا ليستقيم النسخ. */
export function searchTextSegments(text: string): SearchTextSegment[] {
  const structure=searchFootnoteStructure(text),segments: SearchTextSegment[] = [], pattern = /([\[(])([0-9٠-٩۰-۹]+)([\])])|(?:^|\n)\s*[_ـ]{3,}\s*(?:\n|$)/gmu
  let cursor = 0,inferredSeparatorAdded=false
  for (const match of text.matchAll(pattern)) {
    const start = match.index ?? 0
    if (start > cursor) segments.push({ text: text.slice(cursor, start), footnote: false, start: cursor, end: start })
    if(structure&&!structure.explicit&&!inferredSeparatorAdded&&start>=structure.boundary){segments.push({text:'',footnote:false,separator:true,start,end:start});inferredSeparatorAdded=true}
    const footnoteMarker=Boolean(match[1]&&structure?.ids.has(match[2]!)&&(start>=structure.boundary||!isQuranVerseNumber(text,start,start+match[0].length)))
    if (footnoteMarker) {
      // القوسان والرقم علامة واحدة؛ رفع الرقم وحده يفصل العلامة بصريًا ويغيّر لون جزء منها.
      segments.push({ text: match[0], footnote: true, start, end: start + match[0].length })
    } else if(!match[1]) {
      segments.push({ text: match[0], footnote: false, separator: true, start, end: start + match[0].length })
    } else segments.push({text:match[0],footnote:false,start,end:start+match[0].length})
    cursor = start + match[0].length
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), footnote: false, start: cursor, end: text.length })
  return segments
}

/**
 * يعالج النص كاملًا قبل تمييز المطابقة. هذا ضروري لأن تقسيمه إلى ما قبل
 * المطابقة/المطابقة/ما بعدها كان يخفي بنية الحاشية عن المحلل، فلا يُنشأ
 * الفاصل المستنتج إلا مصادفةً عندما تقع الحاشية كلها في قطعة واحدة.
 */
export function appendSearchText(target: HTMLElement, text: string, highlightStart = -1, highlightEnd = -1): void {
  appendSearchTextRanges(target, text, highlightStart < highlightEnd ? [{ start: highlightStart, end: highlightEnd }] : [])
}

/** يحلل بنية الحواشي مرة واحدة ثم يطبق جميع المطابقات داخل المتن. */
export function appendSearchTextRanges(target: HTMLElement, text: string, ranges: ReadonlyArray<{ start: number; end: number }>): void {
  const root = target
  for (const segment of searchTextSegments(text)) {
    if (segment.separator) {
      const separator = document.createElement('span')
      separator.className = 'search-footnote-separator'
      separator.setAttribute('aria-hidden', 'true')
      separator.dataset.copyExclude = 'true'
      separator.textContent = segment.text
      root.append(separator)
      const notes = document.createElement('span')
      notes.className = 'search-footnote-body'
      root.append(notes)
      target = notes
      continue
    }
    if (segment.footnote) {
      const number = document.createElement('span')
      number.className = 'search-footnote-ref'
      number.setAttribute('aria-hidden', 'true')
      number.dataset.copyExclude = 'true'
      number.textContent = segment.text
      target.append(number)
      continue
    }
    const overlaps = ranges.map(range => ({ start: Math.max(segment.start, range.start), end: Math.min(segment.end, range.end) }))
      .filter(range => range.start < range.end).sort((a, b) => a.start - b.start)
    if (!overlaps.length) { target.append(document.createTextNode(segment.text)); continue }
    let localCursor = 0
    for (const overlap of overlaps) {
      const localFrom = overlap.start - segment.start, localTo = overlap.end - segment.start
      if (localFrom > localCursor) target.append(document.createTextNode(segment.text.slice(localCursor, localFrom)))
      const mark = document.createElement('mark')
      mark.textContent = segment.text.slice(Math.max(localCursor, localFrom), localTo)
      target.append(mark); localCursor = Math.max(localCursor, localTo)
    }
    if (localCursor < segment.text.length) target.append(document.createTextNode(segment.text.slice(localCursor)))
  }
}

/** يبني رقم الحاشية كعنصر بصري فقط؛ textContent والنسخ يبقيان الرقم نفسه بلا رموز. */
export function appendSearchTextSegment(target: HTMLElement, text: string, highlighted = false): void {
  appendSearchText(target, text, highlighted ? 0 : -1, highlighted ? text.length : -1)
}
const DIACRITICS = /[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED]/g
const FORMAT_CONTROLS = /[\u200C\u200D\u202A-\u202E\u2066-\u2069]/g
const DIGITS: Record<string, string> = { '٠':'0','١':'1','٢':'2','٣':'3','٤':'4','٥':'5','٦':'6','٧':'7','٨':'8','٩':'9','۰':'0','۱':'1','۲':'2','۳':'3','۴':'4','۵':'5','۶':'6','۷':'7','۸':'8','۹':'9' }
const PREFIXES = ['وال', 'بال', 'كال', 'فال', 'لل', 'ال', 'و', 'ف', 'ب', 'ك', 'ل']
const SUFFIXES = ['كما', 'هما', 'كم', 'كن', 'نا', 'ها', 'هم', 'هن', 'ية', 'ات', 'ون', 'ين', 'ان', 'ه', 'ي', 'ة']

/** تطبيع عربي موحد للبحث والعرض، دون تغيير النص المخزن. */
export function normalizeArabic(value: string): string {
  return value.toLocaleLowerCase('ar')
    .replace(FORMAT_CONTROLS, '')
    .replace(DIACRITICS, '')
    .replace(/\u0640/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩۰-۹]/g, digit => DIGITS[digit] ?? digit)
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function stripAffixes(word: string): string {
  let stem = normalizeArabic(word)
  const prefix = PREFIXES.find((part) => stem.startsWith(part) && stem.length - part.length >= 3)
  if (prefix) stem = stem.slice(prefix.length)
  const suffix = SUFFIXES.find((part) => stem.endsWith(part) && stem.length - part.length >= 3)
  if (suffix) stem = stem.slice(0, -suffix.length)
  return stem
}

/**
 * توسيع محلي محافظ قريب من بحث الشاملة: يوحّد الرسم وينزع لاصقة شائعة
 * واحدة من كل طرف. ليس محللًا صرفيًا ولا يخمّن جذورًا، وتُحدّ مدخلاته حتى
 * يبقى زمنه خطيًا صغيرًا مع العبارات الملصقة أو الطويلة.
 */
export function arabicAffixExpansionTerm(query: string, maxWords = 12, maxChars = 256): string {
  const bounded = query.slice(0, Math.max(0, maxChars))
  const words = bounded.trim().split(/\s+/).slice(0, Math.max(0, maxWords))
    .map(stripAffixes).filter(word => word.length >= 2)
  return words.join(' ') || query.trim().slice(0, Math.max(0, maxChars))
}

export function deriveSearchTerm(query: string, mode: SearchMode): string {
  if (mode === 'exact') return query.trim()
  const expanded = arabicAffixExpansionTerm(query)
  if (mode === 'morphological') return expanded
  const words = expanded.split(/\s+/).filter(Boolean)
  const root = words.map((word) => {
    const consonants = word.replace(/[اوي]/g, '')
    return (consonants.length >= 3 ? consonants : word).slice(0, 3)
  }).join(' ')
  return root || query.trim()
}

export function pageForParagraph(map: WordPageMap | undefined, paragraphIndex: number): number | undefined {
  if (!map || paragraphIndex < 0) return undefined
  const exact = map.paragraphs?.find((paragraph) => paragraph.paragraphIndex === paragraphIndex)
  if (exact) return exact.adjustedPage
  let page: number | undefined
  for (const start of map.starts) {
    if (start.paragraphIndex > paragraphIndex) break
    page = start.adjustedPage
  }
  return page
}

export interface VirtualRange { start: number; end: number }

export function virtualRange(offset: number, loaded: number, rowHeight = 174, windowSize = 36, overscan = 8): VirtualRange {
  if (loaded <= 0) return { start: 0, end: 0 }
  const start = Math.max(0, Math.min(loaded - 1, Math.floor(Math.max(0, offset) / rowHeight) - overscan))
  return { start, end: Math.min(loaded, start + windowSize) }
}
