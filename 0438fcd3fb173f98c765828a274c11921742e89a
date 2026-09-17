/*
 * عرض الكتاب عبر @engine/ooxml-dom: يبني صفحات DOM من النموذج مباشرةً (بلا
 * HarfBuzz ولا شجرة مشهد) ويلائم كل صفحةٍ لعرض العمود. النصّ والتنسيقات من
 * النموذج نفسه، والترسيم النهائي للمتصفح.
 */

import type { DocumentModelV0 } from '@engine/ooxml-model'
import { groupPages, renderDocument, sectionOf, takeRenderedAssetCleanup } from '@engine/ooxml-dom'
import { servedFontFile } from './scene'
import type { BodyParagraph } from '@engine/ooxml-model'
import type { WordPageMap } from './library_store'
import { routeAnimationFrame, routeObserver, trackLiveResource } from '../resource_lifecycle'

export interface DomFontFace {
  family: string
  file: string
  weight: '400' | '700'
  style: 'normal' | 'italic'
}

const renderedPageAssets = new WeakMap<HTMLElement, () => void>()
export function releaseRenderedPageAssets(pages: readonly HTMLElement[]): void {
  const cleanups = new Set<() => void>()
  for (const page of pages) {
    const cleanup = renderedPageAssets.get(page)
    if (cleanup) cleanups.add(cleanup)
    renderedPageAssets.delete(page)
  }
  for (const cleanup of cleanups) cleanup()
}

function ownRenderedAssets(doc: HTMLElement, pages: readonly HTMLElement[]): void {
  const cleanup = takeRenderedAssetCleanup(doc)
  if (cleanup) for (const page of pages) renderedPageAssets.set(page, cleanup)
}

const registeredDomFonts = new Map<string, Promise<void>>()

/** مسار الخطوط يتبع موضع التطبيق؛ فقد يعمل من الجذر أو من مسار نشر فرعي. */
export function runtimeDomFontBase(baseUri?: string): string {
  const uri = baseUri ?? (typeof document === 'undefined' ? undefined : document.baseURI)
  return uri ? new URL('./fonts/', uri).href : '/fonts/'
}

/** وجوه الخطوط التي يطلبها XML ويمكن خدمتها من public/fonts. */
export function domFontFaces(model: DocumentModelV0): DomFontFace[] {
  const roots = [
    ...model.paragraphs,
    ...Array.from(model.footnotes.values()).flat(),
    ...Array.from(model.endnotes.values()).flat(),
    ...Array.from(model.headerFooters.values()).flat(),
  ]
  // مربعات النص في الرؤوس/الرسوم قصص Word مستقلة، وخطوطها لا تظهر ضمن
  // paragraph.runs الأب. اجمعها تكراريًا حتى لا يسقط رأس مثل «من لابن زايد؟»
  // من Aljazeera إلى خط الموقع الافتراضي.
  const paragraphs: typeof roots = []
  const visit = (paragraph: (typeof roots)[number]): void => {
    paragraphs.push(paragraph)
    for (const anchor of paragraph.anchors ?? [])
      for (const nested of anchor.textBox ?? []) visit(nested)
  }
  roots.forEach(visit)
  const faces = new Map<string, DomFontFace>()
  for (const paragraph of paragraphs) {
    for (const run of paragraph.runs) {
      if (!run.family) continue
      const file = servedFontFile(run.family, run.bold, run.italic)
      if (!file) continue
      const face: DomFontFace = {
        family: run.family,
        file,
        weight: run.bold ? '700' : '400',
        style: run.italic ? 'italic' : 'normal',
      }
      faces.set(`${face.family}\u0000${face.weight}\u0000${face.style}`, face)
    }
  }
  return Array.from(faces.values())
}

/** يسجّل الوجوه تحت أسماء العائلات الفعلية في XML قبل أن يقيس المتصفح النص. */
export async function registerDomFonts(model: DocumentModelV0, base = runtimeDomFontBase()): Promise<void> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return
  const fontSet = document.fonts as FontFaceSet & { add(face: FontFace): FontFaceSet }
  await Promise.all(domFontFaces(model).map(({ family, file, weight, style }) => {
    const key = `${base}${file}\u0000${family}\u0000${weight}\u0000${style}`
    let pending = registeredDomFonts.get(key)
    if (!pending) {
      pending = (async () => {
        const face = new FontFace(family, `url(${base}${file})`, { weight, style })
        await face.load()
        fontSet.add(face)
        // FontFaceSet لا يملك API إزالة موثوقًا عبر المتصفحات؛ هذه قيمة cache
        // دائمة مقصودة، ويجب أن تثبت بعد أول فتح لا أن تتضاعف مع كل route.
        void trackLiveResource('fontRegistrations')
      })().catch((error) => { registeredDomFonts.delete(key); throw error })
      registeredDomFonts.set(key, pending)
    }
    return pending
  }))
}

/** يبني عناصر الصفحات كلها من النموذج (كلٌّ بحجم صفحة Word بالـpx). */
export async function renderBookToPages(model: DocumentModelV0, wordPageMap?: WordPageMap): Promise<HTMLElement[]> {
  await registerDomFonts(model)
  const mapped = wordPageMap ? requireWordPageGroups(model, wordPageMap) : null
  const groups = mapped ?? await paginateByMeasuredOverflow(model)
  const doc = renderDocument(model, groups)
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'))
  ownRenderedAssets(doc, pages)
  pages.forEach(page => { page.dataset.wordPaginationSource = mapped ? 'word-map' : 'browser-estimate' })
  if (mapped && wordPageMap) {
    const audit = auditWordPageMap(model, wordPageMap)
    if (audit.mismatches.length) {
      console.warn('word_page_map_mismatch', audit.mismatches.length)
      throw new WordPageMapMismatchError(audit)
    }
    const adjustedTotal = Math.max(...wordPageMap.starts.map(start => start.adjustedPage), wordPageMap.totalPages)
    pages.forEach((page, index) => {
      page.dataset.wordPhysicalPage = String(index + 1)
      page.dataset.wordPageNumber = String(wordLabelForPhysicalPage(wordPageMap, index + 1))
      page.dataset.wordTotalPages = String(adjustedTotal)
    })
  }
  return pages
}

/** يبني الورقة الأولى وحدها فورًا؛ تحميل الخطوط وبقية الصفحات يستمران في الخلفية. */
export function renderBookPreviewPage(model: DocumentModelV0, wordPageMap?: WordPageMap): HTMLElement | null {
  // لا نؤخر فتح الصفحة الأولى، لكن نبدأ تحميل خطوطها (بما فيها رؤوس مربعات
  // النص) فورًا؛ العرض الكامل سيعيد القياس بعد اكتمالها.
  void registerDomFonts(model)
  const mapped = wordPageMap ? requireWordPageGroups(model, wordPageMap) : null
  const firstGroup = (mapped ?? groupPages(model))[0]
  if (!firstGroup) return null
  const doc = renderDocument(model, [firstGroup])
  const page = doc.querySelector<HTMLElement>('.page')
  if (page) ownRenderedAssets(doc, [page])
  if (page) page.dataset.wordPaginationSource = mapped ? 'word-map' : 'explicit-break-preview'
  if (page && wordPageMap) {
    page.dataset.wordPhysicalPage = '1'
    page.dataset.wordPageNumber = String(wordLabelForPhysicalPage(wordPageMap, 1))
    page.dataset.wordTotalPages = String(Math.max(...wordPageMap.starts.map(start => start.adjustedPage), wordPageMap.totalPages))
  }
  return page
}

/** يحل رقم Word المعدّل لكل ورقة، حتى إن لم تبدأ الورقة بفقرة جديدة. */
export function wordLabelForPhysicalPage(map: WordPageMap, physicalPage: number): number {
  const audited = map.pages?.find(page => page.physicalPage === physicalPage)
  if (audited) return audited.adjustedPage
  const starts = [...map.starts].sort((a, b) => a.physicalPage - b.physicalPage)
  const exact = starts.find(start => start.physicalPage === physicalPage)
  if (exact) return exact.adjustedPage
  const previous = starts.filter(start => start.physicalPage < physicalPage).at(-1)
  return previous ? previous.adjustedPage + physicalPage - previous.physicalPage : physicalPage
}

export interface WordPageAuditResult {
  checked: number
  mismatches: { physicalPage: number; edge: 'first' | 'last'; expected: string; actual: string }[]
}

export class WordPageMapMismatchError extends Error {
  readonly code = 'word_page_map_mismatch'
  constructor(readonly audit: WordPageAuditResult, message = 'خريطة صفحات Word لا تطابق محتوى الكتاب') {
    super(message)
    this.name = 'WordPageMapMismatchError'
  }
}

/**
 * خريطة Word artifact موثوق وليست تلميحًا للتصفيح. عند فساد عدد الصفحات أو
 * حدودها لا يجوز الرجوع صامتًا إلى قياس المتصفح، لأن ذلك يعرض أرقام Word على
 * أوراق أخرى. يفشل العقد صراحةً، ويترك للقارئ عرض حالة إعادة المعالجة.
 */
export function requireWordPageGroups(model: DocumentModelV0, map: WordPageMap): BodyParagraph[][] {
  const structural = auditWordPageMapStructure(map)
  if (structural.mismatches.length) {
    console.warn('word_page_map_mismatch', structural.mismatches.length)
    throw new WordPageMapMismatchError(structural, 'خريطة صفحات Word ناقصة أو غير متسقة')
  }
  const groups = groupsFromWordPageMap(model, map)
  if (!groups || groups.length !== map.totalPages) {
    console.warn('word_page_map_mismatch', 1)
    throw new WordPageMapMismatchError({ checked: 0, mismatches: [] }, 'تعذّر مطابقة فقرات الكتاب بصفحات Word')
  }
  return groups
}

/** يثبت وجود سجل واحد لكل ورقة وتسميتها، بلا صفحات مكررة أو مفقودة. */
export function auditWordPageMapStructure(map: WordPageMap): WordPageAuditResult {
  const mismatches: WordPageAuditResult['mismatches'] = []
  const expectedTotal = Number.isInteger(map.totalPages) && map.totalPages > 0 ? map.totalPages : 0
  if (!expectedTotal) mismatches.push({ physicalPage: 0, edge: 'first', expected: 'عدد صفحات موجب', actual: String(map.totalPages) })
  if (map.pages?.length) {
    const byPhysical = new Map<number, number[]>()
    for (const page of map.pages) {
      const labels = byPhysical.get(page.physicalPage) ?? []
      labels.push(page.adjustedPage)
      byPhysical.set(page.physicalPage, labels)
    }
    for (let physicalPage = 1; physicalPage <= expectedTotal; physicalPage++) {
      const labels = byPhysical.get(physicalPage) ?? []
      if (labels.length !== 1 || !Number.isInteger(labels[0]))
        mismatches.push({ physicalPage, edge: 'first', expected: 'سجل صفحة واحد بتسمية صحيحة', actual: labels.length ? labels.join(',') : 'مفقود' })
    }
    for (const physicalPage of byPhysical.keys()) if (physicalPage < 1 || physicalPage > expectedTotal)
      mismatches.push({ physicalPage, edge: 'first', expected: `1..${expectedTotal}`, actual: String(physicalPage) })
  }
  const checked = map.pages?.length ? expectedTotal : 0
  return { checked, mismatches }
}

// U+000E يظهر من Word COM كعلامة بنيوية لبداية بعض فقرات الحقول/الفهارس؛
// ليس محرفًا مؤلفًا ولا يظهر في OOXML المرئي.
const normalizeWordPageText = (value: string): string => value.replace(/[\r\u0007\u000e]/g, ' ').replace(/\s+/g, ' ').trim()

/** U+0002 هي علامة إحالة الحاشية في Word COM، لا حرفًا مؤلفًا. */
function matchesWordPageText(wordValue: string, modelValue: string): boolean {
  if (wordValue === modelValue) return true
  if (!wordValue.includes('\u0002')) return false
  const escaped = wordValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u0002/g, '[0-9٠-٩]+')
  return new RegExp(`^${escaped}$`, 'u').test(modelValue)
}

/** فروق تمثيل موثقة لا تعني اختلاف الفقرة أو ملكية الصفحة. */
function matchesWordPageParagraph(wordValue: string, paragraph: BodyParagraph): boolean {
  const word = normalizeWordPageText(wordValue), model = normalizeWordPageText(paragraph.text)
  if (matchesWordPageText(word, model)) return true
  // Word COM يحدث رقم صفحة TOC قبل استخراج الحقيقة، بينما DOCX الأصلي يبقي
  // نتيجة الحقل السابقة. وجود tab قبل الرقم يقيد القاعدة بصف فهرس حقيقي.
  if (/\t[0-9٠-٩]+\s*$/u.test(paragraph.text)) {
    const withoutPage = (value: string): string => value.replace(/\s+[0-9٠-٩]+\s*$/u, '').trim()
    const compact = (value: string): string => withoutPage(value).replace(/\s+/g, '')
    if (compact(word) === compact(model)) return true
  }
  // بعض الفهارس القديمة ترسم قائد النقاط يدويًا، ويعكس Word ترتيب 73.0 في
  // قصة RTL إلى 0.73 داخل OOXML. المحتوى قبل القائد والرقم نفسه يظلان ثابتين.
  if (/\.{10,}/.test(model) && /\.{10,}/.test(word)) {
    const leader = (value: string): [string, string] => {
      const [prefix = '', suffix = ''] = value.split(/\.{10,}/, 2)
      return [prefix.replace(/\s+/g, ''), suffix.replace(/\D/g, '').replace(/^0+/, '')]
    }
    const [wordPrefix, wordNumber] = leader(word), [modelPrefix, modelNumber] = leader(model)
    if (wordPrefix === modelPrefix && wordNumber === modelNumber && wordNumber.length > 0) return true
  }
  // خطوط dingbat قد تعيد Word COM محارف ASCII بحسب charset بينما OOXML يحفظ
  // PUA. نقبلها للمحاذاة فقط إذا كانت الفقرة كلها من عائلة زخرفية وبلا حروف.
  const decorative = paragraph.runs.length > 0
    && paragraph.runs.every(run => /(?:arabesque|wingdings|webdings|symbol)/i.test(run.family ?? ''))
    && !/[\p{L}\p{N}]/u.test(word) && !/[\p{L}\p{N}]/u.test(model)
  return decorative
}

/** يقارن أول وآخر فقرة في كل صفحة بالنص الذي قرأه Word نفسه عند الاستيراد. */
export function auditWordPageMap(model: DocumentModelV0, map: WordPageMap): WordPageAuditResult {
  const mismatches: WordPageAuditResult['mismatches'] = []
  const groups = groupsFromWordPageMap(model, map)
  for (const page of map.pages ?? []) {
    // Word COM يمثل فقرة الصورة السطرية الخالصة بعلامة `/`، بينما OOXML
    // الصحيح لا يحمل نصًا بل anchor. إبقاء العلامة في audit ضروري لتدقيق حواف
    // صفحات الصور، ولا يجوز تعميم حذف `/` من النص authored.
    const visible = (groups?.[page.physicalPage - 1] ?? []).map((p) => {
      const text = normalizeWordPageText(p.text)
      return { paragraph: p, text: text || (p.anchors?.some(anchor => anchor.inlineFlow) ? '/' : ''), imageOnly: !text && Boolean(p.anchors?.some(anchor => anchor.inlineFlow)) }
    }).filter(item => item.text)
    const edgeValue = (edge: 'first' | 'last', expected: string): string => {
      const candidates = expected === '/' ? visible : visible.filter(item => !item.imageOnly)
      return (edge === 'first' ? candidates[0] : candidates.at(-1))?.text ?? ''
    }
    const expectedFirst = normalizeWordPageText(page.firstText), expectedLast = normalizeWordPageText(page.lastText)
    const pairs = [
      ['first', expectedFirst, edgeValue('first', expectedFirst)],
      ['last', expectedLast, edgeValue('last', expectedLast)],
    ] as const
    for (const [edge, expected, actual] of pairs) {
      const candidate = (edge === 'first' ? visible : [...visible].reverse())
        .find(item => expected === '/' || !item.imageOnly)
      // firstText/lastText الفارغ يعني أن فقرة حافة Word نفسها بلا نص؛ لا يعني
      // أن الورقة كلها فارغة، فقد يليها عنوان مرئي في المجموعة نفسها.
      const edgeMatches = expected === '' ? true
        : Boolean(candidate && ((expected === '/' && candidate.imageOnly)
          || matchesWordPageParagraph(expected, candidate.paragraph)))
      // Word.Paragraphs قد يستبعد فقرة بنيوية/عنوان فهرس يعدّها OOXML فقرة
      // مرئية. عندئذ تختلف الحافة فقط؛ لا نقبلها إلا إذا وجد النص المرجعي نفسه
      // داخل الصفحة المالكة، فلا تتحول صفحة خاطئة إلى نجاح.
      const ownedByPage = expected !== '' && visible.some(item =>
        (expected === '/' && item.imageOnly) || matchesWordPageParagraph(expected, item.paragraph))
      if (!edgeMatches && !ownedByPage)
        mismatches.push({ physicalPage: page.physicalPage, edge, expected, actual })
    }
  }
  return { checked: (map.pages?.length ?? 0) * 2, mismatches }
}

/** حدود صفحات Microsoft Word المحفوظة عند الاستيراد؛ لا يُسمح للمتصفح بتبديلها. */
export function groupsFromWordPageMap(
  model: DocumentModelV0, map: WordPageMap,
): BodyParagraph[][] | null {
  if (map.totalPages < 1 || !map.starts.length) return null
  if (map.paragraphs?.length) {
    const pages = alignWordParagraphPages(model, map)
    if (!pages) return null
    const groups = Array.from({ length: map.totalPages }, () => [] as BodyParagraph[])
    for (let i = 0; i < model.paragraphs.length; i++) {
      const physical = pages[i]!
      if (!Number.isInteger(physical) || physical < 1 || physical > map.totalPages) return null
      groups[physical - 1]!.push(model.paragraphs[i]!)
    }
    return groups
  }
  if (map.paragraphCount !== model.paragraphs.length) return null
  const starts = [...map.starts].sort((a, b) => a.paragraphIndex - b.paragraphIndex)
  if (starts[0]?.paragraphIndex !== 0) return null
  const groups = Array.from({ length: map.totalPages }, () => [] as BodyParagraph[])
  let run = 0
  for (let i = 0; i < model.paragraphs.length; i++) {
    while (run + 1 < starts.length && starts[run + 1]!.paragraphIndex <= i) run++
    const physical = starts[run]!.physicalPage
    if (!Number.isInteger(physical) || physical < 1 || physical > map.totalPages) return null
    groups[physical - 1]!.push(model.paragraphs[i]!)
  }
  return groups
}

/** يطابق فقرات OOXML بفقرات Word النصية؛ Word يضيف فقرات خلايا فارغة إلى
 * Document.Paragraphs لا تظهر دائمًا كعقد جسم مستقلة في OOXML. */
export function alignWordParagraphPages(model: DocumentModelV0, map: WordPageMap): number[] | null {
  const word = map.paragraphs ?? []
  if (!word.length) return null
  const modelText = model.paragraphs.map((p) => normalizeWordPageText(p.text))
  const wordText = word.map((p) => normalizeWordPageText(p.text))
  // المسار الأقوى: Word.Paragraphs وBodyParagraph متساويان عددًا وترتيبًا.
  // لا نسقط فقرات الرسم من التسلسل؛ نفسر sentinel الخاص بـCOM فقط عند إثبات
  // أن فقرة OOXML المقابلة خالية وتحمل صورة inline.
  if (word.length === model.paragraphs.length) {
    const directWordText = wordText.map((text, index) =>
      text === '/' && !modelText[index]
        && model.paragraphs[index]?.anchors?.some(anchor => anchor.inlineFlow) ? '' : text)
    if (directWordText.every((text, index) => matchesWordPageParagraph(text, model.paragraphs[index]!))) {
      const direct = word.map(paragraph => paragraph.physicalPage)
      if (direct.every(page => Number.isInteger(page) && page >= 1 && page <= map.totalPages)) return direct
    }
  }
  const modelNonEmpty = modelText.map((text, index) => ({ text, index })).filter((x) => x.text)
  const wordNonEmpty = wordText.map((text, index) => ({ text, index })).filter((x) => x.text)
  if (modelNonEmpty.length !== wordNonEmpty.length
      || modelNonEmpty.some((item, i) => !matchesWordPageParagraph(wordNonEmpty[i]!.text, model.paragraphs[item.index]!))) return null

  const assigned = Array<number>(model.paragraphs.length)
  const pairs = [
    { model: -1, word: -1 },
    ...modelNonEmpty.map((item, i) => ({ model: item.index, word: wordNonEmpty[i]!.index })),
    { model: model.paragraphs.length, word: word.length },
  ]
  for (let p = 1; p + 1 < pairs.length; p++)
    assigned[pairs[p]!.model] = word[pairs[p]!.word]!.physicalPage
  for (let p = 0; p + 1 < pairs.length; p++) {
    const a = pairs[p]!, b = pairs[p + 1]!
    const modelCount = b.model - a.model - 1, wordCount = b.word - a.word - 1
    for (let offset = 0; offset < modelCount; offset++) {
      let wordIndex: number
      if (wordCount > 0)
        wordIndex = a.word + 1 + Math.min(wordCount - 1, Math.floor((offset + 0.5) * wordCount / modelCount))
      else wordIndex = a.word >= 0 ? a.word : b.word
      const fallback = a.word >= 0 ? word[a.word]?.physicalPage : word[b.word]?.physicalPage
      assigned[a.model + 1 + offset] = word[wordIndex]?.physicalPage ?? fallback ?? 1
    }
  }
  return assigned.every(Number.isInteger) ? assigned : null
}

/**
 * Word ينشئ كسور صفحات تلقائية عند امتلاء المتن حتى إن لم يُخزّن w:br.
 * نقيس بلوكات DOM بخطوطها وصورها الفعلية، ثم ننقل أول بلوك متجاوز مع فقراته
 * ومراسيه إلى الصفحة التالية. هذا يمنع تمديد صفحة لتبتلع الصفحة اللاحقة.
 */
async function paginateByMeasuredOverflow(model: DocumentModelV0): Promise<BodyParagraph[][]> {
  if (typeof document === 'undefined' || !document.body) return groupPages(model)
  let groups = groupPages(model)
  for (let pass = 0; pass < 24; pass++) {
    const probe = renderDocument(model, groups)
    const releaseProbeAssets = takeRenderedAssetCleanup(probe)
    probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none'
    document.body.appendChild(probe)
    await settleProbe(probe)
    const pages = Array.from(probe.querySelectorAll<HTMLElement>(':scope > .page'))
    const next: BodyParagraph[][] = []
    let changed = false
    for (let i = 0; i < groups.length; i++) {
      const group = groups[i]!
      const page = pages[i]
      if (!page || group.length < 2) { next.push(group); continue }
      const body = page.querySelector<HTMLElement>('.page-body')
      if (!body) { next.push(group); continue }
      const section = sectionOf(model, group)
      const available = (section.pageHTwips - section.marTopTwips - section.marBottomTwips) / 15
      const bodyTop = body.getBoundingClientRect().top
      const limit = bodyTop + available + 0.75
      const blocks = Array.from(body.children) as HTMLElement[]
      let splitAt = -1
      for (const block of blocks) {
        if (block.classList.contains('page-footnotes')) continue
        if (block.getBoundingClientRect().bottom <= limit) continue
        const indices = paragraphIndices(block)
        splitAt = group.findIndex((p) => indices.has(p.index))
        if (splitAt <= 0) {
          // لا يمكن شطر فقرة/جدول منفرد ضخم هنا؛ أبقه وانقل ما بعده إن وُجد.
          const last = Math.max(...Array.from(indices).map((idx) => group.findIndex((p) => p.index === idx)))
          splitAt = last >= 0 && last + 1 < group.length ? last + 1 : -1
        }
        break
      }
      if (splitAt > 0 && splitAt < group.length) {
        next.push(group.slice(0, splitAt), group.slice(splitAt))
        changed = true
      } else next.push(group)
    }
    probe.remove()
    releaseProbeAssets?.()
    groups = next
    if (!changed) break
  }
  return groups
}

function paragraphIndices(block: HTMLElement): Set<number> {
  const values = new Set<number>()
  const add = (node: Element): void => {
    const raw = (node as HTMLElement).dataset.idx
    if (raw != null && raw !== '') values.add(Number(raw))
  }
  add(block)
  for (const node of Array.from(block.querySelectorAll<HTMLElement>('[data-idx]'))) add(node)
  return values
}

async function settleProbe(probe: HTMLElement): Promise<void> {
  const images = Array.from(probe.querySelectorAll<HTMLImageElement>('img'))
  await Promise.all(images.map(async (img) => {
    if (img.complete) return
    try { await img.decode() } catch { /* الصورة المكسورة لا توقف ترقيم النص */ }
  }))
  await document.fonts?.ready
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
}

/** ارتفاع الإطار: حجم Word حدٌّ أدنى، والمحتوى الأطول يمدّد الورقة كما في فلاتر. */
export function effectivePageHeight(wordHeight: number, contentHeight: number): number {
  return Math.max(wordHeight, contentHeight)
}

/** يلائم صفحةً (عرضها الثابت بحجم Word) لعرضٍ متاح، معولًا بنسبةٍ موحّدة. */
export function fitPageToWidth(page: HTMLElement, maxWidth: number, registerCleanup?: (cleanup: () => void) => void): HTMLElement {
  const w = parseFloat(page.style.width)
  const wordHeight = parseFloat(page.style.minHeight)
  // قياس scrollHeight بعد تحميل الخطوط هو نظير Container(minHeight) في فلاتر:
  // لا نغيّر فواصل Word، لكننا لا نقصّ محتوى الصفحة الأولى إذا زاد عن الورقة.
  const k = w > 0 && maxWidth > 0 ? Math.min(1, maxWidth / w) : 1
  const wrap = document.createElement('div')
  wrap.className = 'reading__page'
  wrap.style.cssText = [
    'width:100%',
    `height:${Math.round(wordHeight * k)}px`,
    'overflow:visible',
    'position:relative',
    'background:#fff',
    'border-radius:8px',
    'box-shadow:0 2px 10px rgba(0,0,0,0.12)',
    'margin:0 auto 16px',
  ].join(';')
  if (k < 1) {
    page.style.transform = `scale(${k})`
    page.style.transformOrigin = 'top center'
  }
  // الورقة ذات عرض Word ثابت؛ لا نسمح لـ flex في الغلاف أن يصغّرها قبل transform
  // وإلا تُصغّر مرتين وتخرج الجداول والصور عن متنٍ أصبح نصف عرضه.
  page.style.flex = 'none'
  wrap.appendChild(page)

  const syncFrameHeight = () => {
    // يعيد موضعة wp:anchor relativeFrom="paragraph" بعد أن أصبحت الصفحة
    // المتصلة قابلة للقياس؛ الصفحات الأخرى تظل محفوظة خارج DOM حتى فتحها.
    if (typeof Event !== 'undefined') page.dispatchEvent(new Event('word-layout'))
    const h = effectivePageHeight(wordHeight, page.scrollHeight)
    wrap.style.height = `${Math.round(h * k)}px`
  }
  // أول قياس يفيد حين تكون الصفحة متصلة أصلًا؛ والثاني ضروري للصفحات التي
  // بُنيت خارج DOM ثم أُدرجت في القارئ (حينها scrollHeight لا يُعرف قبل الرسم).
  syncFrameHeight()
  let disposed = false
  const animationFrames: number[] = []
  if (typeof requestAnimationFrame === 'function') animationFrames.push(routeAnimationFrame(() => {
    if (disposed) return
    syncFrameHeight()
    animationFrames.push(routeAnimationFrame(() => { if (!disposed) syncFrameHeight() }))
  }))
  // الصور والخطوط والرسوم قد تغيّر القياس بعد أول رسم. المراقب يبقي خلفية
  // الصفحة وإطارها مساويين للمحتوى بدل قصّ آخر سطر عند الارتفاع القديم.
  let observer: ResizeObserver | undefined
  if (typeof ResizeObserver !== 'undefined') {
    observer = routeObserver(new ResizeObserver(() => { if (!disposed) syncFrameHeight() }))
    observer.observe(page)
    const body = page.querySelector<HTMLElement>('.page-body')
    if (body) observer.observe(body)
  }
  void document.fonts?.ready.then(() => { if (!disposed) syncFrameHeight() })
  registerCleanup?.(() => {
    disposed = true
    observer?.disconnect()
    for (const id of animationFrames) cancelAnimationFrame(id)
  })
  return wrap
}
