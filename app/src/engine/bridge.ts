/*
 * جسرُ العرض — المرحلة 1 (عقد SPEC): يربط قشرة app بمحرّك ooxml-model.
 *
 * الاتجاه: app ⟵ ooxml-model فقط (لا العكس). مسؤولياته:
 *  1) فتح ملف docx (بايت) ← DocumentModelV0 عبر extractFromDocx
 *  2) تقسيم فقرات المتن إلى صفحات (pageBreakBefore + حدود الفقرات)
 *
 * هذا الجزء نقّيٌ (لا DOM) — يُختبر في node مباشرةً. تحويل الفقرة إلى DOM
 *  في `render.ts` (يتطلب متصفّحًا).
 *
 * وحدات القياس: النموذج يعمل بالـ twips (شبكة Word)؛ التحويل إلى px عند
 *  الرسم فقط بمقياس 96dpi: بكسل = twip × 20/96.
 */

import { extractFromDocx, type BodyParagraph, type DocumentModelV0 } from '@engine/ooxml-model'

export type WordOpenFailureStage = 'load' | 'parse'

/** يحفظ المرحلة الحقيقية لفشل فتح Word كي لا يُنسب فشل الشبكة إلى محلل OOXML. */
export class WordOpenError extends Error {
  constructor(readonly stage: WordOpenFailureStage, message: string, cause?: unknown) {
    super(message, { cause })
    this.name = 'WordOpenError'
  }
}

/** فقرةٌ مُقسَّمة — الصفحةُ مجموعةُ فقرات تبدأ بعد علامةِ كسر. */
export interface BookPage {
  paragraphs: BodyParagraph[]
}

export interface LoadedBook {
  model: DocumentModelV0
  pages: BookPage[]
}

/** يجلب ملف docx عامّ ويحلّله بالنموذج. المسارُ نسبيٌّ إلى جذر public. */
export async function loadBook(url: string): Promise<LoadedBook> {
  let res: Response
  try { res = await fetch(url) }
  catch (error) { throw new WordOpenError('load', 'تعذّر جلب ملف Word', error) }
  if (!res.ok) throw new WordOpenError('load', `تعذّر جلب ملف Word: ${res.status}`)
  let bytes: Uint8Array
  try { bytes = new Uint8Array(await res.arrayBuffer()) }
  catch (error) { throw new WordOpenError('load', 'تعذّرت قراءة استجابة ملف Word', error) }
  return loadBookFromBuffer(bytes)
}

/** يحلّل بايتات docx إلى نموذج + صفحات (بدون جلب URL). */
export function loadBookFromBuffer(buf: Uint8Array): LoadedBook {
  try {
    const model = extractFromDocx(buf)
    return { model, pages: splitPages(model) }
  } catch (error) {
    if (error instanceof WordOpenError) throw error
    throw new WordOpenError('parse', 'تعذّرت قراءة بنية ملف Word', error)
  }
}

/** تقسيم الفقرات: كلُّ فقرةٍ بـpageBreakBefore تفتح صفحةً جديدة.
 *  فقراتُ المتن فقط (غيرُ مستثناة، بلا حدودُ جدولٍ) — الجداولُ خارج نطاق المرحلة 1. */
export function splitPages(model: DocumentModelV0): BookPage[] {
  const pages: BookPage[] = []
  let current: BodyParagraph[] = []
  for (const p of model.paragraphs) {
    if (p.excluded || p.tableCell) continue
    if (p.pageBreakBefore && current.length > 0) {
      pages.push({ paragraphs: current })
      current = []
    }
    if (!p.text.trim()) continue
    current.push(p)
  }
  if (current.length > 0) pages.push({ paragraphs: current })
  return pages
}
