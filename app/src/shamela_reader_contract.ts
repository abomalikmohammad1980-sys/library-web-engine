import type { StoredBook } from './engine/library_store'

// v7: يحتفظ أيضًا برقم الحديث الصريح من حقل page.number.
export const CURRENT_SHAMELA_PACK_TEXT_VERSION = 7

// ملفات BOK الأصلية المنشورة تُحلَّل بمحوّل Jet المستقل (إصداره الحالي 4)،
// بينما حزم الشاملة المحوّلة سلفًا تستخدم إصدار النص 6. كلاهما يحمل صفحات
// وفهرسًا جاهزين للقارئ، ولذلك لا يجوز إعادة تحليل BOK الصحيح لمجرد أن رقم
// إصداره يختلف عن إصدار حزم corpus.
const CURRENT_RAW_BOK_TEXT_VERSION = 5
const LEGACY_READY_PACK_TEXT_VERSION = 6

/** الحزم المحوّلة تحمل صفحات جاهزة؛ إعادة parseBok مخصصة لملف BOK الخام القديم فقط. */
export function shouldParseRawBok(book: Pick<StoredBook, 'sourceFormat' | 'bokTextVersion' | 'bokPages' | 'extractedText'>, inferredFormat = book.sourceFormat): boolean {
  const readyVersion = book.bokTextVersion === CURRENT_SHAMELA_PACK_TEXT_VERSION || book.bokTextVersion === LEGACY_READY_PACK_TEXT_VERSION || book.bokTextVersion === CURRENT_RAW_BOK_TEXT_VERSION
  return inferredFormat === 'shamela-bok' && (!readyVersion || !book.bokPages?.length || book.extractedText == null)
}
