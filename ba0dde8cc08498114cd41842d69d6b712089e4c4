import { Buffer } from 'buffer'
import MDBReader from 'mdb-reader'

export interface BokPage { id: number; text: string; part: number; page: number }
export interface BokTocEntry { id: number; title: string; level: number; parent: number }
export interface BokBetakaMetadata { publisher?: string; edition?: string; investigator?: string; publicationYearHijri?: number; category?: string; deathYearHijri?: number; volumeCount?: number; description: string; rawBetaka: string }
export interface ParsedBok extends BokBetakaMetadata { title: string; author: string; pages: BokPage[]; toc: BokTocEntry[]; extractedText: string }
export const CURRENT_BOK_TEXT_VERSION = 3

const MAX_BOK_BYTES = 200 * 1024 * 1024

type BrowserProcessShim = {
  browser: true
  env: Record<string, string | undefined>
  version: string
  nextTick: (callback: (...args: unknown[]) => void, ...args: unknown[]) => void
  stdout?: undefined
  stderr?: undefined
}

function ensureNodeBrowserShims(): void {
  const scope = globalThis as typeof globalThis & {
    Buffer?: typeof Buffer
    process?: BrowserProcessShim
  }
  scope.Buffer ??= Buffer
  scope.process ??= {
    browser: true,
    env: {},
    version: '',
    nextTick: (callback, ...args) => queueMicrotask(() => callback(...args)),
  }
}

export function decodeShamelaJetText(value: unknown): string {
  if (typeof value !== 'string') return value == null ? '' : String(value)
  const repaired = value.replace(/[\x20-\xFF]{4,}/g, segment => {
    if (!/[ÃÇáãäÊÏÑÓæíåÉ]/.test(segment)) return segment
    const bytes = Uint8Array.from([...segment], char => char.charCodeAt(0))
    const decoded = new TextDecoder('windows-1256').decode(bytes)
    const arabicBefore = (segment.match(/[\u0600-\u06FF]/g) ?? []).length
    const arabicAfter = (decoded.match(/[\u0600-\u06FF]/g) ?? []).length
    return !decoded.includes('�') && arabicAfter >= arabicBefore + 2 ? decoded : segment
  })
  return repaired.trim()
}

export function parseBokBetaka(raw: string): BokBetakaMetadata {
  const output: BokBetakaMetadata = { description: '', rawBetaka: raw }
  const unknown: string[] = []
  for (const rawLine of raw.replace(/\r\n?/g, '\n').split('\n')) {
    const line = rawLine.trim()
    if (!line) continue
    const labelled = line.match(/^([^:：]{2,24})\s*[:：]\s*(.+)$/u)
    if (!labelled) { unknown.push(line); continue }
    const label = labelled[1]!.replace(/\s+/g, ' ').trim()
    const value = labelled[2]!.trim()
    if (/^(?:الناشر|دار النشر)$/u.test(label)) output.publisher ??= value
    else if (/^(?:الطبعة|رقم الطبعة)$/u.test(label)) {
      output.edition ??= value
      const hijri = value.match(/(?:^|\D)(1[234]\d{2})\s*هـ/u)?.[1]
      if (hijri) output.publicationYearHijri ??= Number(hijri)
    } else if (/^(?:المحقق|تحقيق|المراجع)$/u.test(label)) output.investigator ??= value
    else if (/^(?:سنة النشر|تاريخ النشر)$/u.test(label)) {
      const hijri = value.match(/(?:^|\D)(1[234]\d{2})\s*هـ?/u)?.[1]
      if (hijri) output.publicationYearHijri ??= Number(hijri)
      else unknown.push(line)
    } else if (/^(?:التصنيف|القسم)$/u.test(label)) output.category ??= value
    else if (/^(?:الأجزاء|عدد الأجزاء)$/u.test(label)) { const count = Number(value.match(/\d+/u)?.[0]); if (count > 0) output.volumeCount ??= count }
    else if (/^(?:الوفاة|وفاة المؤلف)$/u.test(label)) { const death = Number(value.match(/\d+/u)?.[0]); if (death > 0) output.deathYearHijri ??= death }
    else if (!/^(?:الكتاب|اسم الكتاب|المؤلف|اسم المؤلف)$/u.test(label)) unknown.push(line)
  }
  output.description = unknown.join('\n')
  return output
}

export function parseBok(data: Uint8Array, fileName: string): ParsedBok {
  if (!/\.bok$/i.test(fileName)) throw new Error('امتداد ملف الشاملة يجب أن يكون BOK')
  if (!data.byteLength || data.byteLength > MAX_BOK_BYTES) throw new Error('حجم BOK غير صالح أو يتجاوز 200 ميغابايت')
  const signature = new TextDecoder('latin1').decode(data.subarray(4, 19))
  if (signature !== 'Standard Jet DB') throw new Error('الملف ليس قاعدة BOK من Microsoft Jet')
  ensureNodeBrowserShims()
  const reader = new MDBReader(Buffer.from(data))
  const names = reader.getTableNames()
  if (!names.includes('Main')) throw new Error('جدول بيانات الكتاب Main مفقود')
  const main = reader.getTable('Main').getData<Record<string, unknown>>({ rowLimit: 1 })[0]
  if (!main) throw new Error('بيانات الكتاب فارغة')
  const bookId = Number(main.BkId)
  const bodyName = names.find(name => name.toLocaleLowerCase() === `b${bookId}`.toLocaleLowerCase())
  const tocName = names.find(name => name.toLocaleLowerCase() === `t${bookId}`.toLocaleLowerCase())
  if (!bodyName) throw new Error('جدول صفحات الكتاب مفقود')
  const pages = reader.getTable(bodyName).getData<Record<string, unknown>>().map((row, index) => ({
    id: Number(row.id) || index + 1,
    text: decodeShamelaJetText(row.nass),
    part: Math.max(1, Number(row.part) || 1),
    page: Math.max(1, Number(row.page) || index + 1),
  })).filter(page => page.text)
  if (!pages.length) throw new Error('لا يحتوي BOK صفحات نصية قابلة للقراءة')
  const rawToc = tocName ? reader.getTable(tocName).getData<Record<string, unknown>>().map(row => ({
    id: Number(row.id) || 1,
    title: decodeShamelaJetText(row.tit),
    level: Math.max(1, Number(row.lvl) || 1),
    parent: Math.max(0, Number(row.sub) || 0),
  })).filter(entry => entry.title) : []
  // بعض قواعد الشاملة تضع في جدول الفهرس معرّف الصفحة التالية/السابقة.
  // إذا ظهر عنوان الفهرس في صفحة واحدة فقط فالنص نفسه هو المرساة الأوثق.
  const compact = (value: string): string => value.replace(/\s+/g, ' ').trim()
  const indexedPages = pages.map(page => ({ page, text: compact(page.text) }))
  const toc = rawToc.map(entry => {
    const title = compact(entry.title)
    if (title.length < 8) return entry
    // الانزياح المعروف في قواعد BOK محلي (غالبًا 1–3 صفحات). حصر
    // المطابقة في نافذة صغيرة يجعل استيراد الكتب الضخمة خطيًا تقريبًا.
    const nearby = indexedPages.filter(item => Math.abs(item.page.id - entry.id) <= 4)
    const matches = nearby.filter(item => item.text.includes(title))
    return matches.length === 1 ? { ...entry, id: matches[0]!.page.id } : entry
  })
  const betaka = parseBokBetaka(decodeShamelaJetText(main.Betaka))
  return {
    title: decodeShamelaJetText(main.Bk) || fileName.replace(/\.bok$/i, ''),
    author: decodeShamelaJetText(main.Auth) || 'غير معروف',
    ...betaka,
    pages,
    toc,
    extractedText: pages.map(page => page.text).join('\n\n'),
  }
}
