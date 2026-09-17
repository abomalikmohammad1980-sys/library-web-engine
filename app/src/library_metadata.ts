import { unzipSync } from 'fflate'
import { extractFromDocx } from '@engine/ooxml-model'

export {SUBJECT_CATEGORY_NAMES as BOOK_CATEGORIES} from './subject_categories'

export function approximateGregorianYear(hijri: number): number {
  return Math.round(hijri - hijri / 33 + 622)
}

export function isDocxFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.docx$/i.test(file.name) || file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
}

export function isWordFile(file: Pick<File, 'name' | 'type'>): boolean {
  return /\.(docx|doc|rtf)$/i.test(file.name) || isDocxFile(file)
}

export function fileNameTitle(fileName: string): string {
  return fileName.replace(/\.(docx|doc|rtf|pdf|epub|bok|txt|md)$/i, '').trim() || 'كتاب بدون عنوان'
}

export interface ProposedBookMetadata { title: string; author?: string }

/** اسم مجلد الجذر في webkitRelativePath هو صاحب مجموعة الكتب، لا المجلدات الفرعية. */
export function folderAuthorFromRelativePath(relativePath?: string): string | undefined {
  const parts = relativePath?.split(/[\\/]+/u).map(part => part.trim()).filter(Boolean) ?? []
  return parts.length > 1 ? parts[0] : undefined
}

/** المؤلف الصريح في اسم الملف مقدم دائمًا على مؤلف مجلد المجموعة. */
export function applyFolderAuthor(metadata: ProposedBookMetadata, folderAuthor?: string): ProposedBookMetadata {
  if (metadata.author?.trim()) return metadata
  const author = folderAuthor?.trim()
  return author ? { ...metadata, author } : metadata
}

const AUTHOR_PREFIX = /^(?:تأليف|للمؤلف|المؤلف|للشيخ|للإمام|للأستاذ|للدكتور|الشيخ|الإمام|الدكتور)\s*[:：]?\s*/u
const TITLE_LIKE_AUTHOR_SUFFIX = /^(?:دراسة|بحث|رسالة|شرح|تحقيق|تعليق|اختصار|مختصر|حاشية|طبعة|نسخة|الجزء|المجلد)(?:\s|$)/u
const ARABIC_PERSON_CONNECTOR = /^(?:بن|ابن|بنت|أبو|أبي|أم|عبد|آل)$/u

function likelyAuthorSuffix(raw: string, separator: string): string | undefined {
  const author = raw.replace(AUTHOR_PREFIX, '').trim()
  const words = author.split(/\s+/u).filter(Boolean)
  if (author.length < 2 || author.length > 100 || words.length > 8 || TITLE_LIKE_AUTHOR_SUFFIX.test(author)) return undefined
  if (!/^[\p{L}\p{M}.،'’\-\s]+$/u.test(author)) return undefined
  // الكشيدة الفاصلة مقصودة عادةً لهذا القالب، أما الشرطات العامة فنقبلها
  // فقط إذا بدا الطرف الأخير اسم شخص لا تتمةً لعنوان مركب.
  if (/^ـ+$/u.test(separator)) return author
  if (AUTHOR_PREFIX.test(raw.trim())) return author
  if (words.some(word => ARABIC_PERSON_CONNECTOR.test(word))) return author
  if (words.length >= 2 && words.length <= 5 && (/^ال/u.test(words.at(-1) ?? '') || /^(?:محمد|أحمد|محمود|إبراهيم|إسماعيل|يوسف|علي|حسن|حسين|خالد|عبدالله|عبدالرحمن|مصطفى|عمر|عثمان|سليمان|صالح|سعيد)$/u.test(words[0] ?? ''))) return author
  return undefined
}

/** يفصل اسم ملف من قالب «العنوان ـ المؤلف» دون تفكيك العناوين ذات الشرطات العامة. */
export function parseBookFileName(fileName: string): ProposedBookMetadata {
  const base = fileNameTitle(fileName).replace(/\s+/gu, ' ').trim()
  const separators = [...base.matchAll(/\s+(ـ+|[-–—])\s+/gu)]
  if (separators.length !== 1) return { title: base }
  const match = separators[0]!
  const left = base.slice(0, match.index).trim()
  const right = base.slice((match.index ?? 0) + match[0].length).trim()
  const author = likelyAuthorSuffix(right, match[1] ?? '')
  if (!isUsefulTitle(left) || !author) return { title: base }
  return { title: left, author }
}

function isGenericFileTitle(title: string): boolean {
  return /^(?:(?:document|doc|book|file|كتاب|مستند|ملف)\s*\d*|\d+)$/iu.test(title.trim())
}

/** اسم الملف هو المصدر الأول للملف المفرد؛ عنوان Word لا يستخدم إلا للّقب العام/غير المفيد. */
export function extractSingleFileMetadata(data: Uint8Array, fileName: string): ProposedBookMetadata {
  const proposed = parseBookFileName(fileName)
  if (!isGenericFileTitle(proposed.title)) return proposed
  return { title: extractProposedTitle(data, fileName), ...(proposed.author ? { author: proposed.author } : {}) }
}

export function shouldShowMultiFileImportControls(fileCount: number): boolean {
  return Number.isInteger(fileCount) && fileCount > 1
}

export function extractProposedTitle(data: Uint8Array, fileName: string): string {
  try {
    const files = unzipSync(data)
    const core = files['docProps/core.xml']
    if (core) {
      const xml = new DOMParser().parseFromString(new TextDecoder().decode(core), 'application/xml')
      const title = xml.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim()
      if (isUsefulTitle(title)) return title
    }
    const model = extractFromDocx(data)
    const heading = model.paragraphs.find((paragraph) => {
      const style = paragraph.styleId ?? ''
      return !paragraph.excluded && isUsefulTitle(paragraph.text) && /^(title|heading|subtitle|العنوان|عنوان)/i.test(style)
    })?.text.trim()
    if (isUsefulTitle(heading)) return heading
  } catch {
    // الملف سيُبلغ عنه لاحقًا عند الحفظ/الفتح؛ يبقى اسم الملف fallback آمنًا للمراجعة.
  }
  return fileNameTitle(fileName)
}

function isUsefulTitle(value: string | null | undefined): value is string {
  if (!value) return false
  const text = value.trim()
  return text.length >= 2 && text.length <= 180 && /[\p{L}\p{N}]/u.test(text)
}
