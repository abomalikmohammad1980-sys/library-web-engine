export function initialPdfCompanionIndex(
  standalone: boolean,
  savedPdfIndex: number,
  activeReaderIndex: number,
  pdfIndexForReader: (index: number) => number,
): number {
  return standalone ? savedPdfIndex : pdfIndexForReader(activeReaderIndex)
}

/**
 * PDF المستقل لا يملك سطح Word مقابلًا؛ إعادة تمريره عبر واجهة التنقل
 * النشطة (وهي واجهته نفسها) كانت تحوّل الصفحة إلى الصفر.
 */
export function pdfTextSyncIndex(
  standalone: boolean,
  pdfIndex: number,
  readerIndexForPdf: (index: number) => number,
): number | undefined {
  return standalone ? undefined : readerIndexForPdf(pdfIndex)
}

/**
 * موضع القراءة المحفوظ يخص الكتاب النصي عند العرض المقارن، لا رقم صفحة PDF.
 * قد تختلف خريطتا الصفحات، وحفظ فهرس PDF مباشرة يعيد Word إلى صفحة خاطئة
 * بعد إغلاق المقارنة أو إعادة فتح الكتاب.
 */
export function pdfPersistedReaderIndex(
  standalone: boolean,
  pdfIndex: number,
  readerIndexForPdf: (index: number) => number,
): number {
  const mapped = standalone ? pdfIndex : readerIndexForPdf(pdfIndex)
  return Math.max(0, Number.isFinite(mapped) ? Math.floor(mapped) : 0)
}

/**
 * يقتصر حدث صفحة القارئ على مزامنة سطح PDF المرافق لسطح نصي آخر.
 * في PDF المستقل يكون الحدث صادرًا من السطح نفسه؛ إعادته إلى محوّل صفحات
 * كتاب سابق قد تقفز بالقارئ إلى الصفحة الأولى عند التمرير ذهابًا أو إيابًا.
 */
export function pdfReaderEventSyncTarget(
  standalone: boolean,
  currentPdfIndex: number,
  readerIndex: number,
  pdfIndexForReader: (index: number) => number,
  source: 'text' | 'pdf' = 'text',
): number | undefined {
  if (standalone || source === 'pdf') return undefined
  const target = pdfIndexForReader(readerIndex)
  return target === currentPdfIndex ? undefined : target
}
