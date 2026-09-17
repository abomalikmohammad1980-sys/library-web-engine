export type ReaderFailureStage = 'load' | 'parse' | 'model' | 'preview' | 'layout' | 'dom' | 'font' | 'page-map' | 'unknown'

export interface ReaderFailure {
  stage: ReaderFailureStage
  code: string
  title: string
  description: string
}

const STAGE_DETAILS: Record<ReaderFailureStage, Omit<ReaderFailure, 'stage'>> = {
  load: { code: 'READER-LOAD-001', title: 'تعذّر جلب نسخة الكتاب', description: 'بقي ملف Word محفوظًا. أعد المحاولة أو نزّل الأصل وافتحه في Word.' },
  parse: { code: 'READER-PARSE-001', title: 'تعذّرت قراءة بنية Word', description: 'لم تُحذف النسخة الأصلية. أعد معالجة الملف أو استخدم العرض النصي الاحتياطي.' },
  model: { code: 'READER-MODEL-001', title: 'تعذّر بناء نموذج الكتاب', description: 'بقي ملف Word محفوظًا، ويمكن إعادة بناء مشتقات القراءة من الأصل.' },
  preview: { code: 'READER-PREVIEW-001', title: 'تعذّرت معاينة الصفحة الأولى', description: 'يمكنك إعادة المحاولة أو متابعة النص في عرض احتياطي بلا ادعاء مطابقة الصفحات.' },
  layout: { code: 'READER-LAYOUT-001', title: 'تعذّر تخطيط صفحات الكتاب', description: 'تنسيق معقد أوقف التخطيط؛ بقي Word محفوظًا ويمكن عرض النص احتياطيًا.' },
  dom: { code: 'READER-DOM-001', title: 'تعذّر تركيب صفحات الكتاب', description: 'لم تُفقد بيانات الكتاب. أعد المحاولة أو افتح العرض النصي الاحتياطي.' },
  font: { code: 'READER-FONT-001', title: 'تعذّر تجهيز خط داخل الكتاب', description: 'قد لا يدعم هذا المتصفح الخط المضمّن؛ جرّب مجددًا أو استخدم العرض النصي.' },
  'page-map': { code: 'READER-PAGE-MAP-001', title: 'تعذّرت مطابقة صفحات Word', description: 'لن تُعرض أرقام بديلة بوصفها مطابقة؛ أعد معالجة الأصل أو استخدم عرضًا نصيًا معلّمًا بوضوح.' },
  unknown: { code: 'READER-UNKNOWN-001', title: 'تعذّر عرض الكتاب', description: 'حدث خلل غير متوقع، لكن ملف Word والبيانات الإدارية بقيا محفوظين.' },
}

export function classifyReaderFailure(error: unknown, attemptedStage: ReaderFailureStage, format?: string): ReaderFailure {
  const name = error instanceof Error ? error.name : ''
  const message = error instanceof Error ? error.message.toLocaleLowerCase('en') : ''
  let stage = attemptedStage
  const explicitWordStage = error instanceof Error && error.name === 'WordOpenError'
    ? (error as Error & { stage?: unknown }).stage
    : undefined
  if (explicitWordStage === 'load' || explicitWordStage === 'parse') stage = explicitWordStage
  else if (name === 'WordPageMapMismatchError' || /page.?map|word_page_map/.test(message)) stage = 'page-map'
  else if (/font|fontface|harfbuzz|wasm/.test(`${name} ${message}`.toLocaleLowerCase('en'))) stage = 'font'
  const detail = stage === 'parse' && format === 'shamela-bok'
    ? { code: 'READER-PARSE-001', title: 'تعذّرت قراءة بنية BOK', description: 'لم تُحذف النسخة الأصلية. أعد المحاولة أو نزّل ملف BOK الأصلي.' }
    : STAGE_DETAILS[stage] ?? STAGE_DETAILS.unknown
  return { stage, ...detail }
}

export interface PlainReaderParagraph { text: string; excluded?: boolean | string }

/** بيانات نقية للعرض الاحتياطي؛ لا تدّعي حدود صفحات Word ولا تحفظ عددًا مشتقًا. */
export function plainReaderGroups(paragraphs: readonly PlainReaderParagraph[], groupSize = 28): string[][] {
  const texts = paragraphs.filter(item => !item.excluded).map(item => item.text.trim()).filter(Boolean)
  const safeSize = Number.isInteger(groupSize) && groupSize > 0 ? groupSize : 28
  const groups: string[][] = []
  for (let index = 0; index < texts.length; index += safeSize) groups.push(texts.slice(index, index + safeSize))
  return groups.length ? groups : [['لا يوجد نص قابل للعرض في هذه النسخة.']]
}
