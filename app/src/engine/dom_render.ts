/*
 * عرض الكتاب عبر @engine/ooxml-dom: يبني صفحات DOM من النموذج مباشرةً (بلا
 * HarfBuzz ولا شجرة مشهد) ويلائم كل صفحةٍ لعرض العمود. النصّ والتنسيقات من
 * النموذج نفسه، والترسيم النهائي للمتصفح.
 */

import type { DocumentModelV0 } from '@engine/ooxml-model'
import { groupPages, renderDocument, sectionOf, takeRenderedAssetCleanup, registerFontLineMetrics } from '@engine/ooxml-dom'
import { trySingleLineSmartShrink } from './word_single_line_layout'
import { tryWordTailLineLayout } from './word_tail_line_layout'
import { containWordBodyMargins } from './word_body_margin_layout'
import { servedFontFile } from './scene'
import type { BodyParagraph } from '@engine/ooxml-model'
import type { WordPageMap } from './library_store'
import { routeAnimationFrame, routeObserver, trackLiveResource } from '../resource_lifecycle'
import { calculateWordPageSurfaceHeight, wordPageStoryOverlap } from '../word_page_surface'
import { effectiveMeasuredContentLimit, keepNextAwareSplitIndex, measuredOverflowSplitIndex, redistributeMeasuredOverflowWithinWordPages, repairMappedKeepNextBoundaries } from '../word_measured_pagination'

export interface DomFontFace {
  family: string
  file: string
  weight: '400' | '700'
  style: 'normal' | 'italic'
}

const renderedPageAssets = new WeakMap<HTMLElement, () => void>()
const pendingSingleLineLayout = new WeakMap<HTMLElement, { paragraphs: readonly BodyParagraph[]; compatibilityMode: number; originals: Map<number,BodyParagraph> }>()
const originalTextLayoutParagraphs = new WeakMap<DocumentModelV0,Map<number,BodyParagraph>>()

function rememberMappedTextLayout(page: HTMLElement, paragraphs: readonly BodyParagraph[], model: DocumentModelV0): void {
  const compatibilityMode=model.compatibilityMode
  let originals=originalTextLayoutParagraphs.get(model)
  if(!originals){originals=new Map(model.paragraphs.map(p=>[p.index,p]));originalTextLayoutParagraphs.set(model,originals)}
  // Floating body content needs per-line geometry, not this bounded plain-text rule.
  if (compatibilityMode >= 15 && !paragraphs.some(p => p.anchors?.length))
    pendingSingleLineLayout.set(page, { paragraphs, compatibilityMode, originals })
}

function fitMappedSingleLineText(page: HTMLElement): void {
  const pending = pendingSingleLineLayout.get(page)
  if (!pending || !page.isConnected) return
  // Word pages retain their physical width across responsive scaling. Fonts were
  // awaited before these pages were prepared; attempt once, without an observer loop.
  pendingSingleLineLayout.delete(page)
  const byIndex = new Map(pending.paragraphs.map(p => [p.index, p]))
  for (const element of page.querySelectorAll<HTMLElement>('.page-body .p[data-idx]')) {
    if (element.closest('.page-footnotes, .page-endnotes, [data-word-story]')) continue
    const paragraph = byIndex.get(Number(element.dataset.idx))
    if (paragraph) {
      trySingleLineSmartShrink(element, paragraph, pending.compatibilityMode)
      const original=pending.originals.get(paragraph.index)
      // Narrow rollout: full table-cell paragraphs only. A Word page fragment
      // is not the final line of its original paragraph and must never be packed.
      if(element.closest('td')&&original&&paragraph.runs.map(r=>r.text).join('')===original.runs.map(r=>r.text).join(''))
        tryWordTailLineLayout(element,original,pending.compatibilityMode)
    }
  }
}
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
const leadingPaginationCache = new WeakMap<DocumentModelV0, {
  ready: BodyParagraph[][]
  pending: BodyParagraph[][]
}>()

/** مسار الخطوط يتبع موضع التطبيق؛ فقد يعمل من الجذر أو من مسار نشر فرعي. */
export function runtimeDomFontBase(baseUri?: string): string {
  const uri = baseUri ?? (typeof document === 'undefined' ? undefined : document.baseURI)
  return uri ? new URL('./fonts/', uri).href : '/fonts/'
}

function domFontParagraphs(model: DocumentModelV0): BodyParagraph[] {
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
  return paragraphs
}

/** وجوه الخطوط التي يطلبها XML ويمكن خدمتها من public/fonts. */
export function domFontFaces(model: DocumentModelV0): DomFontFace[] {
  const paragraphs = domFontParagraphs(model)
  const faces = new Map<string, DomFontFace>()
  for (const paragraph of paragraphs) {
    for (const run of [...paragraph.runs, ...(!paragraph.runs.some(run => run.text && !run.hidden) && paragraph.paragraphMark ? [paragraph.paragraphMark] : [])]) {
      if (!run.family) continue
      let file = servedFontFile(run.family, run.bold, run.italic)
      if (!file) continue
      const regularFile = servedFontFile(run.family, false, false)
      const uprightFile = servedFontFile(run.family, run.bold, false)
      // If a combined bold-italic face is absent, retain the real bold face.
      // Never register a regular binary as bold/italic: doing so disables the
      // browser's synthesis and makes authored emphasis render as plain text.
      if (run.bold && file === regularFile && uprightFile) file = uprightFile
      const face: DomFontFace = {
        family: run.family,
        file,
        weight: run.bold && file !== servedFontFile(run.family, false, run.italic) ? '700' : '400',
        style: run.italic && file !== uprightFile ? 'italic' : 'normal',
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
  const faces = domFontFaces(model)
  await Promise.all(faces.map(({ family, file, weight, style }) => {
    const key = `${base}${file}\u0000${family}\u0000${weight}\u0000${style}`
    let pending = registeredDomFonts.get(key)
    if (!pending) {
      pending = (async () => {
        const bytes = await loadDomFontBytes(`${base}${file}`)
        const face = new FontFace(family, bytes, { weight, style })
        await face.load()
        fontSet.add(face)
        registerFontLineMetrics(family, weight === '700', style === 'italic', new Uint8Array(bytes))
        // FontFaceSet لا يملك API إزالة موثوقًا عبر المتصفحات؛ هذه قيمة cache
        // دائمة مقصودة، ويجب أن تثبت بعد أول فتح لا أن تتضاعف مع كل route.
        void trackLiveResource('fontRegistrations')
      })().catch((error) => { registeredDomFonts.delete(key); throw error })
      registeredDomFonts.set(key, pending)
    }
    return pending
  }))
  // Synthetic emphasis uses the same font's vertical metrics, without falsely
  // registering that regular binary as a genuine bold/italic FontFace.
  const syntheticMetrics = new Set<string>()
  for (const paragraph of domFontParagraphs(model)) for (const run of [...paragraph.runs, ...(!paragraph.runs.some(run => run.text && !run.hidden) && paragraph.paragraphMark ? [paragraph.paragraphMark] : [])]) {
    if (!run.family) continue
    const requestKey = `${run.family}\u0000${Boolean(run.bold)}\u0000${Boolean(run.italic)}`
    if (syntheticMetrics.has(requestKey)) continue
    syntheticMetrics.add(requestKey)
    const familyFaces = faces.filter(face => face.family === run.family)
    const weight = run.bold ? '700' : '400', style = run.italic ? 'italic' : 'normal'
    const face = familyFaces.find(face => face.weight === weight && face.style === style)
      ?? familyFaces.find(face => face.weight === weight && face.style === 'normal')
      ?? familyFaces.find(face => face.weight === '400' && face.style === style)
      ?? familyFaces.find(face => face.weight === '400' && face.style === 'normal')
    if (face && (face.weight !== weight || face.style !== style)) {
      const bytes = await loadDomFontBytes(`${base}${face.file}`)
      registerFontLineMetrics(run.family, Boolean(run.bold), Boolean(run.italic), new Uint8Array(bytes))
    }
  }
}

const domFontBytes = new Map<string, Promise<ArrayBuffer>>()
function loadDomFontBytes(url: string): Promise<ArrayBuffer> {
  let bytes = domFontBytes.get(url)
  if (!bytes) {
    bytes = fetch(url).then(response => {
      if (!response.ok) throw new Error(`تعذر تحميل خط المستند (${response.status})`)
      return response.arrayBuffer()
    }).catch(error => { domFontBytes.delete(url); throw error })
    domFontBytes.set(url, bytes)
  }
  return bytes
}

/** يبني عناصر الصفحات كلها من النموذج (كلٌّ بحجم صفحة Word بالـpx). */
export async function renderBookToPages(model: DocumentModelV0, wordPageMap?: WordPageMap, signal?: AbortSignal): Promise<HTMLElement[]> {
  throwIfCancelled(signal)
  await registerDomFonts(model)
  throwIfCancelled(signal)
  const mappedSource = wordPageMap ? requireWordPageGroups(model, wordPageMap) : null
  const mapped = mappedSource ? repairMappedKeepNextBoundaries(mappedSource) : null
  // خريطة Word هي سلطة حدود الصفحات. إعادة قياس مجموعاتها في المتصفح ثم
  // دفع overflow إلى الورقة التالية كان يُراكم الانزياح حتى تصبح الصفحات
  // المتأخرة سطرًا أو سطرين فقط. القياس يعوّض غياب الخريطة فحسب؛ أما الكتاب
  // الموثق فيُرسم وفق مجموعاته نفسها، ويُدقَّق تداخله بعد الرسم دون إعادة
  // تصفيحه إلى حدود مختلفة عن الأصل.
  const groups = mapped ?? await paginateByMeasuredOverflow(model, signal)
  throwIfCancelled(signal)
  const doc = renderDocument(model, groups, mapped ? { fullPageGroups: mapped } : {})
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'))
  ownRenderedAssets(doc, pages)
  if (mapped) pages.forEach((page, index) => rememberMappedTextLayout(page, groups[index]!, model))
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

/**
 * يرسم نافذة البداية فقط. في غياب page-map يقيس مجموعةً واحدة في كل مرة
 * ويقف بعد العدد المطلوب، لذلك لا يبني DOM للكتاب كله كي تصبح الصفحة 2 متاحة.
 */
export async function renderBookLeadingPages(
  model: DocumentModelV0,
  count = 3,
  wordPageMap?: WordPageMap,
  signal?: AbortSignal,
): Promise<HTMLElement[]> {
  throwIfCancelled(signal)
  await registerDomFonts(model)
  throwIfCancelled(signal)
  const mappedSource = wordPageMap ? requireWordPageGroups(model, wordPageMap) : null
  const mapped = mappedSource ? repairMappedKeepNextBoundaries(mappedSource) : null
  const groups = mapped
    ? mapped.slice(0, count).map(group => [...group])
    : await paginateLeadingMeasured(model, count, signal)
  throwIfCancelled(signal)
  const doc = renderDocument(model, groups, mapped ? { fullPageGroups: mapped } : {})
  const pages = Array.from(doc.querySelectorAll<HTMLElement>('.page'))
  ownRenderedAssets(doc, pages)
  if (mapped) pages.forEach((page, index) => rememberMappedTextLayout(page, groups[index]!, model))
  pages.forEach((page, index) => {
    page.dataset.wordPaginationSource = mapped ? 'word-map' : 'browser-estimate-progressive'
    if (wordPageMap) {
      page.dataset.wordPhysicalPage = String(index + 1)
      page.dataset.wordPageNumber = String(wordLabelForPhysicalPage(wordPageMap, index + 1))
      page.dataset.wordTotalPages = String(wordPageMap.totalPages)
    }
  })
  return pages
}

/** ينتج صفحات Word واحدةً واحدة؛ لا ينتظر مصفوفة الكتاب الكاملة. */
export async function* streamBookPages(
  model: DocumentModelV0,
  wordPageMap?: WordPageMap,
  skip = 0,
  signal?: AbortSignal,
): AsyncGenerator<HTMLElement> {
  await registerDomFonts(model)
  throwIfCancelled(signal)
  const mappedSource = wordPageMap ? requireWordPageGroups(model, wordPageMap) : null
  const mapped = mappedSource ? repairMappedKeepNextBoundaries(mappedSource) : null
  const cached = !mapped ? leadingPaginationCache.get(model) : undefined
  const resumeCached = Boolean(cached && skip === cached.ready.length)
  const pending = (mapped ?? (resumeCached ? cached!.pending : groupPages(model))).map(group => [...group])
  // renderDocument needs the physical page's position in the complete flow in
  // order to resolve section titlePg/even/default header and footer references.
  // A streamed browser-estimated book used to render every yielded group as
  // physical page zero, suppressing title-page headers/footers on every page.
  const emitted = (!mapped && resumeCached ? cached!.ready : []).map(group => [...group])
  let physical = resumeCached ? cached!.ready.length : 0
  while (pending.length) {
    throwIfCancelled(signal)
    const group = pending.shift()!
    if (!mapped && typeof document !== 'undefined' && document.body) {
      const splitAt = await measuredGroupSplit(model, group, signal)
      if (splitAt > 0 && splitAt < group.length) {
        const overflow = group.splice(splitAt)
        if (pending.length) pending[0] = [...overflow, ...pending[0]!]
        else pending.push(overflow)
      }
    }
    physical++
    if (!mapped) emitted.push(group)
    if (physical <= skip) continue
    const fullPageGroups = mapped ?? [...emitted, ...pending]
    const doc = renderDocument(model, [group], {
      fullPageGroups,
      physicalPageOffset: physical - 1,
    })
    const page = doc.querySelector<HTMLElement>('.page')
    if (!page) continue
    ownRenderedAssets(doc, [page])
    if (mapped) rememberMappedTextLayout(page, group, model)
    page.dataset.wordPaginationSource = mapped ? 'word-map-stream' : 'browser-estimate-stream'
    page.dataset.wordPhysicalPage = String(physical)
    if (wordPageMap) {
      page.dataset.wordPageNumber = String(wordLabelForPhysicalPage(wordPageMap, physical))
      page.dataset.wordTotalPages = String(wordPageMap.totalPages)
    }
    yield page
    await paginationIdleTurn(signal)
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) throw new DOMException('Word pagination cancelled', 'AbortError')
}

/** يبني الورقة الأولى وحدها فورًا؛ تحميل الخطوط وبقية الصفحات يستمران في الخلفية. */
export function renderBookPreviewPage(model: DocumentModelV0, wordPageMap?: WordPageMap): HTMLElement | null {
  // لا نؤخر فتح الصفحة الأولى، لكن نبدأ تحميل خطوطها (بما فيها رؤوس مربعات
  // النص) فورًا؛ العرض الكامل سيعيد القياس بعد اكتمالها.
  void registerDomFonts(model)
  const mappedSource = wordPageMap ? requireWordPageGroups(model, wordPageMap) : null
  const mapped = mappedSource ? repairMappedKeepNextBoundaries(mappedSource) : null
  const firstGroup = (mapped ?? groupPages(model))[0]
  if (!firstGroup) return null
  const doc = renderDocument(model, [firstGroup], mapped ? { fullPageGroups: mapped } : {})
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

// خريطة Word ثابتة والنموذج ثابتان طوال جلسة القارئ. كانت المعاينة والصفحات
// الثلاث الأولى والبث الكامل تعيد جميعها تدقيق الخريطة وبناء المجموعات نفسها.
// WeakMap يمنع تكرار العمل البارد، ولا يحتجز الكتاب بعد مغادرة القارئ.
const wordPageGroupCache = new WeakMap<DocumentModelV0, WeakMap<WordPageMap, BodyParagraph[][]>>()

/**
 * خريطة Word artifact موثوق وليست تلميحًا للتصفيح. عند فساد عدد الصفحات أو
 * حدودها لا يجوز الرجوع صامتًا إلى قياس المتصفح، لأن ذلك يعرض أرقام Word على
 * أوراق أخرى. يفشل العقد صراحةً، ويترك للقارئ عرض حالة إعادة المعالجة.
 */
export function requireWordPageGroups(model: DocumentModelV0, map: WordPageMap): BodyParagraph[][] {
  const cached = wordPageGroupCache.get(model)?.get(map)
  if (cached) return cached
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
  let byMap = wordPageGroupCache.get(model)
  if (!byMap) { byMap = new WeakMap(); wordPageGroupCache.set(model, byMap) }
  byMap.set(map, groups)
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

// U+000E يظهر من Word COM كعلامة بنيوية لبداية بعض فقرات الحقول/الفهارس،
// وU+0001 قد يظهر كفقرة Range بنيوية قرب نهاية المستند. كلاهما لا يمثل
// محرفًا مؤلفًا ولا يظهر في OOXML المرئي.
export const normalizeWordPageText = (value: string): string => value.replace(/[\r\u0001\u0007\u000e]/g, ' ').replace(/\s+/g, ' ').trim()

/** U+0002 هي علامة إحالة الحاشية في Word COM، لا حرفًا مؤلفًا. */
function matchesWordPageText(wordValue: string, modelValue: string): boolean {
  if (wordValue === modelValue) return true
  if (!wordValue.includes('\u0002')) return false
  const escaped = wordValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\u0002/g, '[0-9٠-٩]+')
  return new RegExp(`^${escaped}$`, 'u').test(modelValue)
}

/** فروق تمثيل موثقة لا تعني اختلاف الفقرة أو ملكية الصفحة. */
export function matchesWordPageParagraph(wordValue: string, paragraph: BodyParagraph): boolean {
  const word = normalizeWordPageText(wordValue), model = normalizeWordPageText(paragraph.text)
  if (matchesWordPageText(word, model)) return true
  // COM Range.Text exports the verified symbol-font slots as '(' even when a
  // paragraph also contains ordinary Arabic. Only slots proved by font-bearing
  // runs participate; neither the source text nor fragment offsets are changed.
  const provedSymbolRun = (run: BodyParagraph['runs'][number]): boolean =>
    /^(?:AGA Arabesque|KFGQPC Arabic Symbols 01)$/iu.test(run.family ?? '')
    || (/^Symbol$/iu.test(run.family ?? '') && run.text === '\uf0d2'
      && run.noteRef?.custom === true && run.noteRef.customMark === '\uf0d2')
  const symbols = new Set(paragraph.runs.filter(provedSymbolRun)
    .flatMap(run => [...run.text].filter(char => /[\uF000-\uF0FF]/u.test(char))))
  for (const char of symbols) {
    const unproved = paragraph.runs.some(run => run.text.includes(char)
      && !provedSymbolRun(run))
    if (unproved) symbols.delete(char)
  }
  const comparableModel = normalizeWordPageText([...paragraph.text].map(char => symbols.has(char) ? '(' : char).join(''))
  if (symbols.size && matchesWordPageText(word, comparableModel)) return true
  // A single inline drawing separated from text by a boundary line break has
  // a COM '/' sentinel. Requiring both structures avoids stripping authored '/'.
  if (paragraph.anchors?.filter(anchor => anchor.inlineFlow).length === 1) {
    if (/^\s*\n/u.test(paragraph.text) && word.startsWith('/ ')
      && matchesWordPageText(word.slice(2), comparableModel)) return true
    if (/\n\s*$/u.test(paragraph.text) && word.endsWith(' /')
      && matchesWordPageText(word.slice(0, -2), comparableModel)) return true
  }
  // بعض إصدارات Word COM تعيد موضع إحالة الحاشية داخل القوسين فراغًا
  // `( )` بدل الرقم الذي يحفظه OOXML. لا نقبل هذا الفرق إلا إذا أثبت نموذج
  // الفقرة نفسه وجود w:footnoteReference/w:endnoteReference، وبعدد المواضع
  // نفسه؛ وهكذا لا تتحول الأقواس الفارغة المؤلَّفة إلى wildcard عام.
  if (paragraph.runs.some(run => run.noteRef) && /\(\s*\)/u.test(word)) {
    const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\\\(\s*\\\)/g, '\\([0-9٠-٩]+\\)')
    if (new RegExp(`^${escaped}$`, 'u').test(model)) return true
  }
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
  // خرائط الكسور تقيس الحافة بإزاحة Range الخام من Word. نص Range المعروض
  // ليس مرجعًا صالحًا للمقارنة الحرفية: تحديث أرقام الحواشي قد يحوّل محرف
  // w:footnoteReference الواحد إلى رقم من خانتين، مع بقاء إزاحة القصة حرفًا
  // واحدًا. لذلك ندققها بعدم فقد أي محرف من نموذج OOXML، لا بمقارنة النص
  // التشخيصي المقطوع الذي قد ينتهي في منتصف رقم حاشية.
  if (map.fragments?.length && groups) {
    const reconstructed = new Map<number, string>()
    const aligned = alignWordParagraphIndices(model, map)
    for (const group of groups) for (const paragraph of group)
      reconstructed.set(paragraph.index, (reconstructed.get(paragraph.index) ?? '') + paragraph.text)
    for (const paragraph of model.paragraphs) {
      const actual = reconstructed.get(paragraph.index) ?? ''
      if (actual !== paragraph.text) mismatches.push({
        physicalPage: map.paragraphs?.[aligned?.[paragraph.index] ?? -1]?.physicalPage ?? 1,
        edge: 'last', expected: normalizeWordPageText(paragraph.text), actual: normalizeWordPageText(actual),
      })
    }
    return { checked: (map.pages?.length ?? map.totalPages) * 2, mismatches }
  }
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
    const alignedIndices = alignWordParagraphIndices(model, map)
    if (!alignedIndices) return null
    if (map.fragments?.length) {
      const byWord = new Map<number, typeof map.fragments>()
      for (const fragment of map.fragments) {
        const list = byWord.get(fragment.paragraphIndex) ?? []
        list.push(fragment)
        byWord.set(fragment.paragraphIndex, list)
      }
      const groups = Array.from({ length: map.totalPages }, () => [] as BodyParagraph[])
      for (let modelIndex = 0; modelIndex < model.paragraphs.length; modelIndex++) {
        const paragraph = model.paragraphs[modelIndex]!, wordIndex = alignedIndices[modelIndex]!
        const fragments = [...(byWord.get(wordIndex) ?? [])].sort((a, b) => a.startOffset - b.startOffset)
        if (!fragments.length) {
          const physical = map.paragraphs[wordIndex]?.physicalPage
          if (!physical || physical > map.totalPages) return null
          groups[physical - 1]!.push(paragraph)
          continue
        }
        // الفقرة غير الممتدة لا تحتاج قطعًا. endOffset هنا يقيس قصة Word
        // الخام، وقد تختلف عن طول النص المعروض بسبب نتائج حقول TOC وأرقام
        // الحواشي؛ قطعها بهذه الإزاحة كان يحذف آخر كلمات من آلاف الفقرات.
        if (fragments.length === 1 && fragments[0]!.startOffset === 0) {
          groups[fragments[0]!.physicalPage - 1]!.push(paragraph)
          continue
        }
        // pageBreakBefore/section break لا يملك محرفًا مرئيًا، لكن Word قد
        // يعيده كجزء كسري مستقل (مثل \u000e) في الورقة السابقة. إذا لم يوجد
        // إلا كسر مرئي واحد فهذه ليست فقرة ممتدة؛ انقل الفقرة كاملة إلى ورقة
        // النص المرئي كي لا تُقص أرقام الحواشي أو القوس الأخير من العنوان.
        const visibleFragments = fragments.filter(fragment => normalizeWordPageText(fragment.text))
        if (visibleFragments.length === 1) {
          groups[visibleFragments[0]!.physicalPage - 1]!.push(paragraph)
          continue
        }
        const sourceLength = paragraph.runs.reduce((sum, run) => sum + (run.sourceText ?? run.text).length, 0)
        fragments.forEach((fragment, fragmentIndex) => {
          // نهاية Range الخام تستبعد علامة ¶ لكنها قد تقصر عن النص المعروض
          // بعدد خانات نتيجة الحاشية. الكسر الأخير يملك بقية الفقرة قطعًا،
          // لذا أغلقه عند نهاية sourceText بدل إسقاط القوس/الكلمة الأخيرة.
          const endOffset = fragmentIndex + 1 === fragments.length ? sourceLength : fragment.endOffset
          const sliced = sliceWordParagraphFragment(paragraph, fragment.startOffset, endOffset,
            fragmentIndex > 0, fragmentIndex + 1 < fragments.length)
          if (sliced) groups[fragment.physicalPage - 1]!.push(sliced)
        })
      }
      return groups
    }
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

/** يقتطع جزءًا متصلًا من فقرة مع إبقاء خصائص الرُّنات. الإزاحة مبنية على
 * sourceText لأن Word COM يقيس قصة Word الخام؛ عند عدم اختلافه عن نص العرض
 * يكون القطع حرفيًا، وفي الرن البنيوي المختلف يبقى الرن ذريًا بدل فقده. */
export function sliceWordParagraphFragment(
  paragraph: BodyParagraph, startOffset: number, endOffset: number,
  continuesBefore = false, continuesAfter = false,
): BodyParagraph | null {
  if (endOffset <= startOffset) return null
  let cursor = 0
  const runs = paragraph.runs.flatMap(run => {
    // Hidden runs are absent from BodyParagraph.text: retain ownership without
    // consuming its visible-source character positions.
    if (run.hidden) return startOffset <= cursor && cursor < endOffset ? [{ ...run }] : []
    const source = run.sourceText ?? run.text
    const runStart = cursor, runEnd = cursor + source.length
    cursor = runEnd
    const from = Math.max(0, startOffset - runStart), to = Math.min(source.length, endOffset - runStart)
    // مرجع الحاشية عقدة ذرية في قصة Word، وليس نصًا يجوز شطره عند حد
    // الصفحة. إزاحات COM قد تعد الرمز الآلي بمحرف مختلف عن run.text؛ وكان
    // القطع النصي يسقط المرجع كله عند الحافة، فتختفي الحاشية مع بقاء المتن
    // وعدد الصفحات صحيحين. تملكه القطعة التي تحتوي موضع بدايته مرة واحدة.
    if (run.noteRef)
      return startOffset <= runStart && runStart < endOffset ? [{ ...run }] : []
    if (to <= from) return []
    if (source.length !== run.text.length) {
      // الحقول/الرموز ليست قابلة للقسمة بأمان بين تمثيل COM والعرض.
      // لا يجوز مع ذلك نسخ الرن الذري إلى كل كسر يلامسه؛ فهذا يكرر نتيجة
      // الحقل (وأحيانًا سطرًا كاملًا) في ورقتين متتاليتين. تملّك الرن للجزء
      // الذي يحتوي بدايته المنطقية، وهو نفس قرار Word عند وقوع حد الصفحة
      // داخل قصة حقل لا يمكن شطر تمثيلها المرئي بأمان.
      return startOffset <= runStart && runStart < endOffset ? [{ ...run }] : []
    }
    return [{ ...run, text: run.text.slice(from, to),
      ...(run.sourceText === undefined ? {} : { sourceText: run.sourceText.slice(from, to) }) }]
  })
  if (!runs.length) return null
  const preservesSourceText = paragraph.runs.filter(run => !run.hidden)
    .map(run => run.sourceText ?? run.text).join('') === paragraph.text
  const shift = <T extends number | { at:number }>(entry: T): T | null => {
    const at = typeof entry === 'number' ? entry : entry.at
    if (at < startOffset || at >= endOffset) return null
    if (typeof entry === 'number') return (at - startOffset) as T
    return Object.assign({}, entry, { at: at - startOffset }) as T
  }
  return {
    ...paragraph,
    runs,
    text: runs.filter(run => !run.hidden).map(run =>
      preservesSourceText
        ? run.sourceText ?? run.text : run.text).join(''),
    ...(continuesBefore ? { bookmarkIds: [] }
      : paragraph.bookmarkIds === undefined ? {} : { bookmarkIds: paragraph.bookmarkIds }),
    anchors: continuesBefore ? [] : paragraph.anchors,
    numbered: continuesBefore ? false : paragraph.numbered,
    pageBreakBefore: continuesBefore ? false : paragraph.pageBreakBefore,
    ...(!continuesBefore && paragraph.pageBreaksBefore !== undefined
      ? { pageBreaksBefore: paragraph.pageBreaksBefore } : {}),
    spacing: { ...paragraph.spacing,
      before: continuesBefore ? 0 : paragraph.spacing.before,
      ...(continuesBefore ? { beforeAuto: false }
        : paragraph.spacing.beforeAuto === undefined ? {} : { beforeAuto: paragraph.spacing.beforeAuto }),
      after: continuesAfter ? 0 : paragraph.spacing.after,
      ...(continuesAfter ? { afterAuto: false }
        : paragraph.spacing.afterAuto === undefined ? {} : { afterAuto: paragraph.spacing.afterAuto }) },
    tabAt: paragraph.tabAt.map(shift).filter((x): x is number => x !== null),
    ...(paragraph.columnBreakAt === undefined ? {} : {
      columnBreakAt: paragraph.columnBreakAt.map(shift).filter((x): x is number => x !== null),
    }),
    ptabAt: paragraph.ptabAt.map(shift).filter((x): x is BodyParagraph['ptabAt'][number] => x !== null),
  }
}

/** يطابق فقرات OOXML بفقرات Word النصية؛ Word يضيف فقرات خلايا فارغة إلى
 * Document.Paragraphs لا تظهر دائمًا كعقد جسم مستقلة في OOXML. */
export function alignWordParagraphPages(model: DocumentModelV0, map: WordPageMap): number[] | null {
  const indices = alignWordParagraphIndices(model, map)
  if (!indices) return null
  const word = map.paragraphs ?? []
  const pages = indices.map(index => word[index]?.physicalPage ?? 0)
  return pages.every(page => Number.isInteger(page) && page >= 1 && page <= map.totalPages) ? pages : null
}

/** يطابق فهرس كل فقرة OOXML بفهرس Word COM؛ تستخدمه كسور الفقرة الدقيقة
 * لأن رقم الصفحة وحده يفقد امتداد الفقرة عبر ورقتين. */
export function alignWordParagraphIndices(model: DocumentModelV0, map: WordPageMap): number[] | null {
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
      return word.map((_, index) => index)
    }
  }
  const modelNonEmpty = modelText.map((text, index) => ({ text, index })).filter((x) => x.text)
  // Word COM يمثل فقرة الصورة السطرية الخالصة بـ`/`. عند اختلاف عدادي Word
  // وOOXML لا ينطبق المسار المباشر أعلاه، لكن sentinel يظل بنيويًا لا نصًا.
  // لا نحذفه إلا بميزانية مثبتة من فقرات OOXML الخالية ذات inlineFlow، حتى لا
  // يتحول `/` مؤلف حقيقي إلى wildcard عام.
  const inlineImageOnly = model.paragraphs.filter((paragraph, index) =>
    !modelText[index] && paragraph.anchors?.some(anchor => anchor.inlineFlow)).length
  const wordSlashCount = wordText.filter(text => text === '/').length
  const comparableWordText = wordSlashCount > 0 && wordSlashCount <= inlineImageOnly
    ? wordText.map(text => text === '/' ? '' : text) : wordText
  const wordNonEmpty = comparableWordText.map((text, index) => ({ text, index })).filter((x) => x.text)
  if (modelNonEmpty.length !== wordNonEmpty.length) return null
  const textualMismatches = modelNonEmpty.flatMap((item, i) =>
    matchesWordPageParagraph(wordNonEmpty[i]!.text, model.paragraphs[item.index]!) ? [] : [i])
  // Matching neighbours do not prove a changed value came from a field.
  // Representation differences must pass the run-aware matcher above.
  if (textualMismatches.length) return null

  const assigned = Array<number>(model.paragraphs.length)
  const pairs = [
    { model: -1, word: -1 },
    ...modelNonEmpty.map((item, i) => ({ model: item.index, word: wordNonEmpty[i]!.index })),
    { model: model.paragraphs.length, word: word.length },
  ]
  for (let p = 1; p + 1 < pairs.length; p++)
    assigned[pairs[p]!.model] = pairs[p]!.word
  for (let p = 0; p + 1 < pairs.length; p++) {
    const a = pairs[p]!, b = pairs[p + 1]!
    const modelCount = b.model - a.model - 1, wordCount = b.word - a.word - 1
    for (let offset = 0; offset < modelCount; offset++) {
      let wordIndex: number
      if (wordCount > 0)
        wordIndex = a.word + 1 + Math.min(wordCount - 1, Math.floor((offset + 0.5) * wordCount / modelCount))
      else wordIndex = a.word >= 0 ? a.word : b.word
      const fallback = a.word >= 0 ? a.word : b.word
      assigned[a.model + 1 + offset] = word[wordIndex] ? wordIndex : fallback
    }
  }
  return assigned.every(index => Number.isInteger(index) && index >= 0 && index < word.length) ? assigned : null
}

/**
 * Word ينشئ كسور صفحات تلقائية عند امتلاء المتن حتى إن لم يُخزّن w:br.
 * نقيس بلوكات DOM بخطوطها وصورها الفعلية، ثم ننقل أول بلوك متجاوز مع فقراته
 * ومراسيه إلى الصفحة التالية. هذا يمنع تمديد صفحة لتبتلع الصفحة اللاحقة.
 */
async function paginateByMeasuredOverflow(model: DocumentModelV0, signal?: AbortSignal): Promise<BodyParagraph[][]> {
  if (typeof document === 'undefined' || !document.body) return groupPages(model)
  const pending = groupPages(model).map(group => [...group])
  const groups: BodyParagraph[][] = []
  while (pending.length) {
    throwIfCancelled(signal)
    const group = pending.shift()!
    const splitAt = await measuredGroupSplit(model, group, signal)
    if (splitAt > 0 && splitAt < group.length) {
      groups.push(group.slice(0, splitAt))
      pending.unshift(group.slice(splitAt))
    } else groups.push(group)
    // لا تحتكر حلقة القياس الخيط الرئيسي؛ اسمح بالنقر/التمرير والإلغاء.
    if (groups.length % 4 === 0) await paginationIdleTurn(signal)
  }
  return groups
}

function paginationIdleTurn(signal?: AbortSignal): Promise<void> {
  if (signal?.aborted) return Promise.resolve()
  return new Promise(resolve => {
    const finish = (): void => resolve()
    if (typeof globalThis.requestIdleCallback === 'function')
      globalThis.requestIdleCallback(finish, { timeout: 100 })
    else globalThis.setTimeout(finish, 0)
  })
}

async function paginateLeadingMeasured(
  model: DocumentModelV0,
  count: number,
  signal?: AbortSignal,
): Promise<BodyParagraph[][]> {
  if (typeof document === 'undefined' || !document.body) return groupPages(model).slice(0, count)
  const pending = groupPages(model).map(group => [...group])
  const ready: BodyParagraph[][] = []
  while (pending.length && ready.length < count) {
    throwIfCancelled(signal)
    const group = pending.shift()!
    const splitAt = await measuredGroupSplit(model, group, signal)
    if (splitAt > 0 && splitAt < group.length) {
      ready.push(group.slice(0, splitAt))
      pending.unshift(group.slice(splitAt))
    } else ready.push(group)
  }
  leadingPaginationCache.set(model, {
    ready: ready.map(group => [...group]),
    pending: pending.map(group => [...group]),
  })
  return ready
}

/**
 * يطبق قياس overflow على نسخة من مجموعات Word مع إبقاء الانتقال إلى المجموعة
 * التالية. استعماله للنافذة الأولى وللكتاب الكامل يضمن أن `skip` في البث لا
 * يحذف فقرة ولا يكررها عند استبدال المعاينة بالصفحات المقاسة.
 */
async function paginateLeadingGroups(
  model: DocumentModelV0,
  source: readonly (readonly BodyParagraph[])[],
  count: number,
  signal?: AbortSignal,
): Promise<BodyParagraph[][]> {
  const pending = source.map(group => [...group])
  const ready: BodyParagraph[][] = []
  while (pending.length && ready.length < count) {
    throwIfCancelled(signal)
    const group = pending.shift()!
    const splitAt = await measuredGroupSplit(model, group, signal)
    if (splitAt > 0 && splitAt < group.length) {
      const redistributed = redistributeMeasuredOverflowWithinWordPages(group, pending, splitAt)
      ready.push(redistributed.page)
      pending.splice(0, pending.length, ...redistributed.following)
    } else ready.push(group)
  }
  return ready
}

async function paginateMeasuredGroups(
  model: DocumentModelV0,
  source: readonly (readonly BodyParagraph[])[],
  signal?: AbortSignal,
): Promise<BodyParagraph[][]> {
  return paginateLeadingGroups(model, source, Number.POSITIVE_INFINITY, signal)
}

async function measuredGroupSplit(model: DocumentModelV0, group: BodyParagraph[], signal?: AbortSignal): Promise<number> {
  const probe = renderDocument(model, [group])
  const release = takeRenderedAssetCleanup(probe)
  probe.style.cssText = 'position:fixed;left:-100000px;top:0;visibility:hidden;pointer-events:none'
  document.body.appendChild(probe)
  try {
    await settleProbe(probe)
    throwIfCancelled(signal)
    const page = probe.querySelector<HTMLElement>(':scope > .page')
    const body = page?.querySelector<HTMLElement>('.page-body')
    if (!page || !body || group.length < 2) return -1
    const section = sectionOf(model, group)
    const printableBottom = body.getBoundingClientRect().top
      + (section.pageHTwips - section.marTopTwips - section.marBottomTwips) / 15 + 0.75
    const footnote = body.querySelector<HTMLElement>(':scope > .page-footnotes')
    const visibleTop = (selector: string): number | undefined => {
      const tops = Array.from(page.querySelectorAll<HTMLElement>(selector))
        .map(element => element.getBoundingClientRect())
        .filter(rect => rect.width > 0 && rect.height > 0)
        .map(rect => rect.top)
      return tops.length ? Math.min(...tops) : undefined
    }
    // التذييل ورقم الصفحة قصتان عائمتان في Word ولا تدخلان في ارتفاع body.
    // حجز موضعهما أثناء القياس يمنع أن يصل المتن أو الحواشي إليهما ثم يُقصّا.
    const limit = effectiveMeasuredContentLimit(
      printableBottom,
      footnote?.getBoundingClientRect().height ?? 0,
      visibleTop(':scope > .page-footer, :scope > [data-word-story="footer"]'),
      visibleTop('[data-word-page-field], [data-word-field="PAGE"]'),
    )
    for (const block of Array.from(body.children) as HTMLElement[]) {
      if (block.classList.contains('page-footnotes') || block.getBoundingClientRect().bottom <= limit) continue
      const indices = paragraphIndices(block)
      const rows = block.matches('table')
        ? Array.from(block.querySelectorAll<HTMLElement>(':scope > tbody > tr, :scope > thead > tr')).map(row => ({
          bottom: row.getBoundingClientRect().bottom,
          paragraphIndices: [...paragraphIndices(row)],
        })) : []
      const split = measuredOverflowSplitIndex(group.map(p => p.index), [...indices], limit, rows)
      if (split > 0) return keepNextAwareSplitIndex(group, split)
      const last = Math.max(...[...indices].map(idx => group.findIndex(p => p.index === idx)))
      return last >= 0 && last + 1 < group.length
        ? keepNextAwareSplitIndex(group, last + 1) : -1
    }
    return -1
  } finally {
    probe.remove()
    release?.()
  }
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

/** ينفذ قياس هندسة الصفحة في إحداثيات Word قبل transform:scale. */
export function measureUnscaledWordPage<T>(page: HTMLElement, measure: () => T): T {
  const transform = page.style.transform
  if (transform) page.style.removeProperty('transform')
  try { return measure() } finally {
    if (transform) page.style.transform = transform
  }
}

/**
 * يبقي سطح ورقة Word نفسه ـ لا غلاف التحجيم وحده ـ بطول المحتوى الفعلي.
 * وهذا مهم لأن حدود الصفحة والخلفية مثبتة إلى أسفل `.page`؛ فإذا طال المتن
 * عن قياس Word بقيت النجوم/الأسطر داخل الورقة والإطار بدل أن تتدلى تحتهما.
 */
export function isDecorativeWordStoryBackground(element: HTMLElement): boolean {
  const anchor = element.closest<HTMLElement>('.flt-behind[data-word-story-ornament]')
  return Boolean(anchor && !anchor.textContent?.trim()
    && (anchor.matches('img,svg,canvas') || anchor.querySelector('img,svg,canvas'))
    && !anchor.querySelector('table,[data-word-field],[data-word-page-field],.page-footnotes'))
}

export function synchronizePageSurfaceHeight(
  page: HTMLElement,
  wordHeight: number,
): number {
  const pageRect = page.getBoundingClientRect()
  if (page.isConnected === false || pageRect.width <= 0 || pageRect.height <= 0) return wordHeight
  // CSS zoom يغيّر قيم getBoundingClientRect. القياس هنا يجب أن يبقى
  // بوحدات Word الأصلية، ثم تطبق نسبة العرض مرة واحدة عند حجز الـslot.
  // من دون التطبيع كان الغلاف عند 130% يقاس مكبرًا ثم يضرب في 130% ثانية.
  const authoredWidth = Number.parseFloat(page.style.width)
  const geometryScale = authoredWidth > 0 && pageRect.width > 0
    ? Math.max(.1, pageRect.width / authoredWidth) : 1
  const unscale = (value: number): number => value / geometryScale
  const pageTop = pageRect.top
  // A header watermark is paper decoration, not flow content. Word clips a
  // portrait background at a landscape paper edge; clip only that text-free
  // background, never the body, a text box, table, or footnote story.
  for (const anchor of page.querySelectorAll<HTMLElement>('.flt-behind[data-word-story-ornament]')) {
    if (!isDecorativeWordStoryBackground(anchor)) continue
    const rect = anchor.getBoundingClientRect()
    const top = Math.max(0, unscale(pageTop - rect.top))
    const bottom = Math.max(0, unscale(rect.bottom - pageTop) - wordHeight)
    anchor.style.clipPath = `inset(${top}px 0px ${bottom}px 0px)`
  }
  const body = page.querySelector<HTMLElement>('.page-body')
  const paddingBottom = Number.parseFloat(getComputedStyle(page).paddingBottom) || 0
  const borderRect = page.querySelector<HTMLElement>(':scope > .page-border')?.getBoundingClientRect()
  const floatingFooterStories = Array.from(page.querySelectorAll<HTMLElement>(
    ':scope > [data-word-story="footer"], :scope > [data-word-page-field]',
  ))
  // التذييل المؤلف في Word مرساةٌ إلى قاع الورقة، لا إلى أعلاها. بعض دورات
  // القياس (خصوصًا بعد تغيير نسبة القراءة) كانت تترك له top محسوبًا قديمًا
  // إلى جانب bottom الأصلي؛ وعندئذ يبتعد التذييل كلما كبرت الورقة. نحفظ
  // مسافة Word الأصلية من القاع مرة واحدة، ثم نجعل bottom هو المرجع الوحيد.
  // بذلك يكبر المتن والتذييل مع الورقة نفسها ولا يختفي التذييل عند 110%+.
  for (const footer of page.querySelectorAll<HTMLElement>(':scope > .page-footer')) {
    const authoredBottom = footer.dataset.wordSurfaceAuthoredBottom === undefined
      ? Number.parseFloat(footer.style.bottom)
      : Number(footer.dataset.wordSurfaceAuthoredBottom)
    if (!Number.isFinite(authoredBottom)) continue
    footer.dataset.wordSurfaceAuthoredBottom = String(authoredBottom)
    footer.style.position = 'absolute'
    footer.style.bottom = `${authoredBottom}px`
    footer.style.removeProperty('top')
    footer.style.zIndex = '4'
    // قد تكون زخرفة/حقول التذييل مطلقة داخل حاويته وتمتد بصريًا تحت سطح
    // الورقة، مع أن صندوق footer نفسه ما زال داخلها. نقيس الامتداد الحقيقي
    // عند موضع Word الأصلي ثم نرفع المرساة بالمقدار اللازم. القياس بوحدات
    // الورقة غير المكبرة، ولذلك تبقى النتيجة صحيحة في 100% و110% وما فوق.
    const visibleFooterRects = [footer, ...footer.querySelectorAll<HTMLElement>('*')]
      .filter(element => !isDecorativeWordStoryBackground(element))
      .map(element => element.getBoundingClientRect())
      .filter(rect => rect.width > 0 && rect.height > 0 && Number.isFinite(rect.bottom))
    const visibleBottom = visibleFooterRects.length
      ? Math.max(...visibleFooterRects.map(rect => rect.bottom)) : pageRect.bottom
    const overflowBelowPaper = Math.max(0, unscale(visibleBottom - pageRect.bottom))
    if (overflowBelowPaper > .5) footer.style.bottom = `${authoredBottom + Math.ceil(overflowBelowPaper) + 4}px`
  }
  // تُقرأ مواضع التذييل بعد تثبيت مرساته، لا من المستطيلات القديمة السابقة
  // للتصحيح، حتى يكون حساب حزام التذييل وارتفاع الصفحة متوافقين تمامًا.
  const footerRects = Array.from(page.querySelectorAll<HTMLElement>(
    ':scope > .page-footer, :scope > [data-word-story="footer"], :scope > [data-word-page-field]',
  ))
    .map(element => element.getBoundingClientRect()).filter(rect => rect.width > 0 && rect.height > 0)
  const footerTop = footerRects.length ? Math.min(...footerRects.map(rect => rect.top)) : undefined
  const borderBottomInset = borderRect ? unscale(Math.max(0, pageRect.bottom - borderRect.bottom)) : 0
  const bodyRect = body?.getBoundingClientRect()
  // صفحات Word الموثقة مقسمة أصلًا، فلا حاجة لإبقاء صندوق المتن بارتفاع
  // الورقة كاملًا حين لا يحوي إلا أسطرًا قليلة. نستثني الأغلفة والأعمدة
  // ونُدخل الحواشي السفلية في قياس المحتوى نفسه؛ وجود الحاشية لا يبرر
  // إبقاء بقية ارتفاع ورقة Word فارغًا قبل التذييل.
  // لا نُقصّر صفحةً ذات صورة مستقلة أبدًا: الصورة قد تكون لم تُحمّل بعد
  // في أول قياس، فتظهر أبعادها صفرًا ثم تُقتطع صفحة الغلاف. صفحات الصور
  // تحتفظ بقياس Word، بينما يظل توسيطها البصري مستقلًا عن هذا القرار.
  const pageMedia = Array.from(page.querySelectorAll<HTMLElement>(
    '.page-body img, .page-body svg, .page-body canvas, :scope > .flt-anchor.flt-img, :scope > .flt-anchor.flt-group, :scope > .flt-anchor:is(img,svg,canvas), :scope > .flt-anchor img, :scope > .flt-anchor svg, :scope > .flt-anchor canvas',
  )).filter(media => !media.closest('[data-word-story], [data-word-story-ornament]'))
  // page-cover هو الحكم الأقوى: قد يحتفظ Word بنص بديل طويل للصورة أو
  // بعناصر مخفية في فقرة الغلاف، فلا يصح أن يمنع ذلك ضغط الذيل الأبيض.
  const imageDominantPage = Boolean(page.classList?.contains?.('page-cover') || (body
    && (body.textContent?.replace(/\s+/g, '').length ?? 0) < 160
    && pageMedia.length))
  // لا تُقصّر سطح الصفحة منفردًا: القارئ الافتراضي يحتفظ بمواضع افتراضية
  // للصفحات غير المركبة، وتقليص الورقة وحدها يصنع فاصلًا بنيًا ويُسقط
  // الحواشي عند الفك والتركيب. يبقى التمدد الآمن مسموحًا أدناه، أما إزالة
  // الفراغ فتحتاج تحديث الورقة والـslot معًا ولا تُفعّل قبل ذلك.
  // صفحة الغلاف ذات الصورة المكتملة هي الاستثناء الوحيد الذي يجوز تقصير
  // الورقة فيه إلى حد الصورة الفعلي. لا نفعل ذلك قبل اكتمال الصور كي لا
  // تتحول أبعادها المؤقتة (صفر) إلى قص دائم للغلاف.
  const coverMediaReady = imageDominantPage && pageMedia.every(media =>
    !(media instanceof HTMLImageElement) || (media.complete && media.naturalHeight > 0))
  const compactOrdinaryPage = coverMediaReady
  const authoredCover = compactOrdinaryPage
    ? page.querySelector<HTMLElement>(':scope > [data-word-cover]') : null
  const authoredCoverTop = Number.parseFloat(authoredCover?.style.top ?? '')
  const authoredCoverHeight = Number.parseFloat(authoredCover?.style.height ?? '')
  const authoredCoverBottom = Number.isFinite(authoredCoverTop) && Number.isFinite(authoredCoverHeight)
    ? Math.max(0, authoredCoverTop + authoredCoverHeight) : undefined
  if (compactOrdinaryPage) delete page.dataset.wordRequiredGrowth
  if (body) {
    body.dataset.wordCompactSurface = compactOrdinaryPage ? 'true' : 'false'
    if (compactOrdinaryPage && body.style) {
      body.style.minHeight = '0px'
      // margin-top:auto يثبت حاشية الصفحة عند قاع ارتفاع Word القديم، ثم يدخل
      // موضعها المتأخر في القياس فيعيد الفراغ الأبيض نفسه. في السطح المرن تكون
      // الحاشية جزءًا طبيعيًا من تدفق المتن، ويبقى حزام التذييل محجوزًا مستقلًا.
      for (const notes of body.querySelectorAll<HTMLElement>(':scope > .page-footnotes')) {
        if (!notes?.style || !notes?.dataset) continue
        notes.style.marginTop = '16px'
        notes.dataset.wordCompactNoteFlow = 'true'
      }
    }
  }

  // موضع الصور عقدٌ من Word نفسه، لا تخمين بصري من القارئ. الصورة المضمّنة
  // ترث محاذاة فقرتها (يمين/وسط/يسار)، والصورة العائمة تحمل مرجعها وإزاحتها
  // في نموذج OOXML/VML. لا نوسّط «كل صورة منفردة»؛ نصحح الإحداثيات إلى مركز
  // الورقة فقط حين يصرّح المصدر نفسه بأن فقرة الصورة محاذاتها وسط.
  for (const image of pageMedia) {
    const target = image.closest?.<HTMLElement>('.flt-anchor') ?? image
    if (target.dataset.wordStandaloneCentered === 'true') {
      target.style.removeProperty('translate')
      delete target.dataset.wordStandaloneCentered
    }
    const paragraph = image.closest<HTMLElement>('.para, p, [data-word-paragraph]')
    const authoredAlign = paragraph
      ? (paragraph.style.textAlign || getComputedStyle(paragraph).textAlign).toLowerCase()
      : ''
    const sourceCentered = authoredAlign === 'center' || authoredAlign === '-webkit-center'
      || target.dataset.wordPosHAlign === 'center'
    if (!sourceCentered) continue
    const rect = target.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) continue
    const delta = (pageRect.left + pageRect.width / 2) - (rect.left + rect.width / 2)
    const localScale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1
    if (Math.abs(delta) > .5) target.style.translate = `${delta / (localScale || 1)}px 0px`
    target.dataset.wordStandaloneCentered = 'true'
  }
  const currentMinimum = Number.parseFloat(page.style.minHeight) || wordHeight
  const notes = body?.querySelector?.<HTMLElement>(':scope > .page-footnotes')
  if (notes) {
    notes.style.removeProperty('position')
    notes.style.removeProperty('inset-block-start')
    delete notes.dataset.wordOverflowShift
  }
  const meaningfulElementBottoms: number[] = []
  // القياس عقدٌ جامع لكل ما ترسمه صفحة Word، لا للمتن وحده. الحواشي
  // والتذييل وحقول رقم الصفحة والصور العائمة قد تكون إخوةً لـ page-body؛
  // إهمالها كان يجعل تقصير الورقة يبتلعها بصريًا. نأخذ أبعد عنصر حقيقي،
  // ويظل ارتفاع Word حدًا أدنى لا سقفًا ولا هدفًا للتقليص.
  const surfaceElements = page.querySelectorAll<HTMLElement>(
    '.page-body, .page-body *, .page-footnotes, .page-footnotes *, .page-footer, .page-footer *, '
      + '[data-word-story="footer"], [data-word-story="footer"] *, '
      + '[data-word-page-field], [data-word-field="PAGE"], '
      + ':scope > .flt-anchor, :scope > .flt-anchor *',
  )
  for (const element of surfaceElements) {
    if (element.classList.contains('page-border')) continue
    if (isDecorativeWordStoryBackground(element)) continue
    const rect = element.getBoundingClientRect()
    if (!Number.isFinite(rect.bottom) || rect.width <= 0 || rect.height <= 0) continue
    // textContent على الحاوية يشمل نص كل الأبناء؛ وكان ذلك يجعل حاويةً
    // هيكلية بطول الورقة كلها تُحسب آخر محتوى، فتنتج المساحة البيضاء الضخمة.
    // نعتمد النص المباشر فقط، أو العناصر المرئية ذات المحتوى الذاتي.
    const hasDirectText = Array.from(element.childNodes ?? []).some(node =>
      node.nodeType === 3 && Boolean(node.textContent?.trim()))
    const inFooterStory = Boolean(element.closest(
      '.page-footer, [data-word-story="footer"], [data-word-page-field], [data-word-field="PAGE"]',
    ))
    const requiredWordStory = Boolean(element.closest(
      '.page-footnotes, .page-footer, [data-word-story="footer"], [data-word-page-field], [data-word-field="PAGE"]',
    ))
    const meaningful = requiredWordStory || hasDirectText || element.matches('img,svg,canvas,table,video')
    // لا نسمح لخلية/مرساة فارغة شاذة أن تجعل صفحةً بيضاء لا تنتهي.
    if (!meaningful && rect.height > wordHeight) continue
    // التذييل يحدد footerTopInset أدناه، فلا نعدّه محتوى ثم نضيف حزامه مرة
    // ثانية. كان هذا هو مصدر النمو التراكمي والفراغ البني بعد كل دورة قياس.
    if (meaningful && !inFooterStory) meaningfulElementBottoms.push(unscale(rect.bottom - pageTop))
  }
  let baseHeight = calculateWordPageSurfaceHeight({
    wordHeight, currentMinimum, paddingBottom, borderBottomInset, meaningfulElementBottoms,
    ...(compactOrdinaryPage ? { allowShrink: true, minimumHeight: 240 } : {}),
    ...(footerTop === undefined ? {} : { footerTopInset: unscale(Math.max(0, pageRect.bottom - footerTop)), footerGap: 8 }),
    ...(!compactOrdinaryPage && bodyRect ? { bodyBottom: unscale(bodyRect.bottom - pageTop) } : {}),
    ...(borderRect ? { borderBottom: unscale(borderRect.bottom - pageTop) } : {}),
  })
  // غلاف Word صورة مطلقة بحدود مؤلفة صريحة. نعتمد حدها السفلي مباشرةً؛
  // فهو لا يتأثر بتحميل الصورة أو zoom، ويزيل بياض الورقة أسفل الغلاف من
  // دون أن يقتطع بكسلًا واحدًا من الصورة.
  if (compactOrdinaryPage && authoredCoverBottom !== undefined)
    baseHeight = Math.ceil(Math.max(240, authoredCoverBottom))
  // إذا كشف التدقيق تداخلًا سابقًا بين المتن/الحاشية والتذييل، نحفظ مقدار
  // التمدد المطلوب على الصفحة نفسها. يبقى هذا المقدار ثابتًا بعد انتقال
  // التذييل إلى القاع، وإلا تعيد دورة ResizeObserver الصفحة إلى الارتفاع
  // القصير ثم تدخل القصص بعضها في بعض من جديد.
  const requiredGrowth = Math.max(0, Number(page.dataset.wordRequiredGrowth) || 0)
  const height = baseHeight + requiredGrowth
  if (Math.abs((Number.parseFloat(page.style.minHeight) || 0) - height) > 0.5) page.style.minHeight = `${height}px`
  // holder العادي مثبت بـ bottom ويتبع min-height تلقائيًا. أما عناصر footer
  // العائمة فتحمل top مأخوذًا من ارتفاع Word الأصلي؛ ننقلها بمقدار نمو الورقة
  // من قيمة مؤلف ثابتة، كي لا يتراكم الانتقال مع ResizeObserver.
  const surfaceGrowth = height - wordHeight
  for (const story of floatingFooterStories) {
    if (story.closest('.page-footer')) continue
    const authoredTop = story.dataset.wordSurfaceAuthoredTop === undefined
      ? Number.parseFloat(story.style.top) : Number(story.dataset.wordSurfaceAuthoredTop)
    if (!Number.isFinite(authoredTop)) continue
    story.dataset.wordSurfaceAuthoredTop = String(authoredTop)
    story.style.top = `${authoredTop + surfaceGrowth}px`
  }
  return height
}

/** تدقيق هندسي بعد الرسم؛ يشمل رقم الصفحة العائم ولا يكتفي بحاوية footer. */
export function auditRenderedWordPageGeometry(page: HTMLElement, safetyGap = 8): number {
  const mountedRect = page.getBoundingClientRect()
  if (page.isConnected === false || mountedRect.width <= 0 || mountedRect.height <= 0) return 0
  const body = page.querySelector<HTMLElement>(':scope > .page-body')
  if (!body) return 0
  const notes = body.querySelector<HTMLElement>(':scope > .page-footnotes')
  const main = Array.from(body.children).filter(node => node !== notes) as HTMLElement[]
  const rects = (nodes: HTMLElement[]) => nodes.filter(node => !isDecorativeWordStoryBackground(node)).map(node => node.getBoundingClientRect())
    .filter(rect => rect.width > 0 && rect.height > 0)
  const mainRects = rects(main), footerRects = rects(Array.from(page.querySelectorAll<HTMLElement>(
    ':scope > .page-footer, :scope > [data-word-story="footer"]')))
  const numberRects = rects(Array.from(page.querySelectorAll<HTMLElement>(
    '[data-word-page-field], [data-word-field="PAGE"]')))
  const pageRect = page.getBoundingClientRect(), notesRect = notes?.getBoundingClientRect()
  const authoredWidth = Number.parseFloat(page.style.width)
  const geometryScale = authoredWidth > 0 && pageRect.width > 0
    ? Math.max(.1, pageRect.width / authoredWidth) : 1
  return wordPageStoryOverlap({
    mainBottom: mainRects.length ? Math.max(...mainRects.map(rect => rect.bottom)) : body.getBoundingClientRect().top,
    ...(notesRect && notesRect.width > 0 && notesRect.height > 0 ? { footnotesBottom: notesRect.bottom } : {}),
    ...(footerRects.length ? { footerTop: Math.min(...footerRects.map(rect => rect.top)) } : {}),
    ...(numberRects.length ? { pageNumberTop: Math.min(...numberRects.map(rect => rect.top)) } : {}),
    pageBottom: pageRect.bottom,
    safetyGap,
  }) / geometryScale
}

function fitMappedPageStory(page: HTMLElement): number {
  const body = page.querySelector<HTMLElement>(':scope > .page-body')
  if (!body) return 0
  const overlap = auditRenderedWordPageGeometry(page)
  page.dataset.wordGeometryOverlap = String(Math.round(overlap * 100) / 100)
  body.style.removeProperty('zoom')
  body.style.removeProperty('inline-size')
  body.style.removeProperty('max-inline-size')
  delete page.dataset.wordStoryScale
  return overlap
}

/** يلائم صفحةً (عرضها الثابت بحجم Word) لعرضٍ متاح، معولًا بنسبةٍ موحّدة. */
export function fitPageToWidth(page: HTMLElement, maxWidth: number, registerCleanup?: (cleanup: () => void) => void): HTMLElement {
  const w = parseFloat(page.style.width)
  // تبقى قيمة Word الأصلية ثابتة عبر unmount/remount. استعمال minHeight
  // الممدد أساسًا جديدًا كان يعيد surfaceGrowth إلى الصفر في التركيب التالي
  // فيرجع رقم الصفحة العائم إلى موضعه القديم داخل المتن.
  const storedWordHeight = Number(page.dataset.wordSurfaceWordHeight)
  const wordHeight = Number.isFinite(storedWordHeight) && storedWordHeight > 0
    ? storedWordHeight : parseFloat(page.style.minHeight)
  page.dataset.wordSurfaceWordHeight = String(wordHeight)
  // قياس scrollHeight بعد تحميل الخطوط هو نظير Container(minHeight) في فلاتر:
  // لا نغيّر فواصل Word، لكننا لا نقصّ محتوى الصفحة الأولى إذا زاد عن الورقة.
  let k = w > 0 && maxWidth > 0 ? Math.min(1, maxWidth / w) : 1
  const wrap = document.createElement('div')
  wrap.className = 'reading__page'
  let fittedWidth = Math.round(w * k)
  wrap.style.cssText = [
    `width:${fittedWidth}px`,
    'max-width:100%',
    `height:${Math.round(wordHeight * k)}px`,
    'overflow:visible',
    'position:relative',
    'background:#fff',
    'border-radius:8px',
    'box-shadow:0 2px 10px rgba(0,0,0,0.12)',
    'margin:0 auto 4px',
  ].join(';')
  page.style.transform = `scale(${k})`
  page.style.transformOrigin = 'top center'
  // الورقة ذات عرض Word ثابت؛ لا نسمح لـ flex في الغلاف أن يصغّرها قبل transform
  // وإلا تُصغّر مرتين وتخرج الجداول والصور عن متنٍ أصبح نصف عرضه.
  page.style.flex = 'none'
  wrap.appendChild(page)

  const syncFrameHeight = () => {
    // Refit the presentation, never the document, when the actual reading
    // column changes (window resize, browser zoom, TOC or companion pane).
    const column = wrap.closest<HTMLElement>('.reading')
    const available = column?.clientWidth || maxWidth
    k = w > 0 && available > 0 ? Math.min(1, available / w) : 1
    fittedWidth = Math.round(w * k)
    // يعيد موضعة wp:anchor relativeFrom="paragraph" بعد أن أصبحت الصفحة
    // المتصلة قابلة للقياس؛ الصفحات الأخرى تظل محفوظة خارج DOM حتى فتحها.
    const h = measureUnscaledWordPage(page, () => {
      containWordBodyMargins(page)
      fitMappedSingleLineText(page)
      if (typeof Event !== 'undefined') page.dispatchEvent(new Event('word-layout'))
      const mapped = page.dataset.wordPaginationSource?.startsWith('word-map') ?? false
      // ارتفاع Word حد أدنى لا سقف: إن اختلف قياس الخط/الجدول في الويب
      // تتمدد الورقة نفسها، فيبقى كل النص داخلها ويتحرك التذييل ورقم الصفحة
      // إلى أسفل السطح الجديد بدل ضغط المتن أو تقاطعهما.
      // ثبّت القصص العائمة أولًا ثم قس الصفحة بعد مواضعها النهائية؛ القياس
      // السابق كان يحدث قبل الحواشي/التذييل، فيعيد ارتفاعًا أقصر فيقصهما.
      if (mapped) fitMappedPageStory(page)
      let measured = synchronizePageSurfaceHeight(page, wordHeight)
      const overlap = auditRenderedWordPageGeometry(page)
      if (overlap > 0.5) {
        const oldGrowth = Math.max(0, Number(page.dataset.wordRequiredGrowth) || 0)
        const nextGrowth = Math.max(oldGrowth, Math.ceil(overlap + 10))
        if (nextGrowth !== oldGrowth) {
          page.dataset.wordRequiredGrowth = String(nextGrowth)
          measured = synchronizePageSurfaceHeight(page, wordHeight)
        }
      }
      return measured
    })
    const slot = wrap.parentElement?.closest<HTMLElement>('.reading__page-slot')
    const reader = slot?.closest<HTMLElement>('.reader')
    const requestedZoom = Math.max(.1, Number.parseFloat(
      reader ? getComputedStyle(reader).getPropertyValue('--reader-content-zoom') : '',
    ) || 1)
    // Word fixed-layout لا يستعمل CSS zoom: نكبر الورقة وتحويل محتواها معًا.
    // النسبة المختارة عقد صريح مع المستخدم؛ لا نخفض 110% و120% خفيةً إلى
    // 100% لمجرد أن عرض الورقة الأصلي ملأ العمود. الغلاف والـslot يكبران مع
    // الصفحة نفسها، والآباء يمنعون سحب الحاوية أفقيًا.
    const effectiveZoom = requestedZoom
    // كبّر غلاف الورقة والورقة كوحدة واحدة. ضرب transform في نسبة القراءة
    // مع إبقاء الغلاف في قياس آخر كان ينجح عند 100% فقط؛ ومن 105% تصبح
    // إحداثيات الصفحة والتذييل والـslot في ثلاث منظومات مختلفة فتظهر صفحات
    // بيضاء. CSS zoom في Chromium يشارك في التخطيط نفسه، ولذلك يحافظ على
    // الرأس والمتن والحواشي والتذييل داخل سطح واحد من دون قص أو انزياح.
    const baseHeight = Math.max(1, Math.round(h * k))
    const displayedHeight = Math.max(1, Math.round(baseHeight * effectiveZoom))
    wrap.style.width = `${fittedWidth}px`
    wrap.style.maxWidth = 'none'
    wrap.style.height = `${baseHeight}px`
    wrap.style.zoom = String(effectiveZoom)
    page.style.transform = `scale(${k})`
    const reservedHeight = displayedHeight
    // slot هو صاحب الموضع في تيار القارئ. لا يكفي تمديد الورقة والغلاف إذا
    // بقي slot على تقدير Word القديم، وإلا تقفز الصفحة التالية فوق الذيل.
    if (slot) {
      // CSS zoom يغيّر الحجم المرئي للغلاف كله. يجب أن يحجز slot الحجم
      // المرئي نفسه، وإلا يظهر فراغ عند التصغير أو تقفز الصفحة التالية فوقه
      // عند التكبير.
      // في أول قياس لم تكن class القراءة قد أضيفت إلى wrap بعد، ولذلك كانت
      // getComputedStyle(wrap).zoom تعيد 1 ثم تقفز الحاوية بعد الضغط على +/-.
      // اقرأ القيمة من عقد القارئ نفسه؛ فهي المصدر الثابت قبل وبعد التركيب.
      slot.style.height = `${reservedHeight}px`
      slot.style.minHeight = `${reservedHeight}px`
      slot.dataset.measuredHeight = String(reservedHeight)
    }
  }
  // أول قياس يفيد حين تكون الصفحة متصلة أصلًا؛ والثاني ضروري للصفحات التي
  // بُنيت خارج DOM ثم أُدرجت في القارئ (حينها scrollHeight لا يُعرف قبل الرسم).
  syncFrameHeight()
  let disposed = false
  let columnObserver: ResizeObserver | undefined
  const animationFrames: number[] = []
  if (typeof requestAnimationFrame === 'function') animationFrames.push(routeAnimationFrame(() => {
    if (disposed) return
    const column = wrap.closest<HTMLElement>('.reading')
    if (column && typeof ResizeObserver !== 'undefined') {
      let previousWidth = column.clientWidth
      columnObserver = routeObserver(new ResizeObserver(() => {
        if (disposed || column.clientWidth === previousWidth) return
        previousWidth = column.clientWidth
        syncFrameHeight()
      }))
      columnObserver.observe(column)
    }
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
    // قد يظل صندوق body ثابتًا بينما يكبر جدول/صورة داخله ويتجاوز حدّه.
    // مراقبة الكتل ذات المعنى تجعل القياس bottom-up يتبع المحتوى نفسه.
    for (const element of page.querySelectorAll<HTMLElement>(
      '.page-body > *, .page-body img, .page-body svg, .page-body canvas, .page-body table, .page-footnotes',
    )) observer.observe(element)
  }
  const pendingImages = Array.from(page.querySelectorAll<HTMLImageElement>('img'))
  const imageSettled = () => { if (!disposed) syncFrameHeight() }
  for (const image of pendingImages) {
    image.addEventListener('load', imageSettled)
    image.addEventListener('error', imageSettled)
    if (image.complete) imageSettled()
  }
  void document.fonts?.ready.then(() => { if (!disposed) syncFrameHeight() })
  const zoomSettled = () => { if (!disposed) {
    syncFrameHeight()
    animationFrames.push(routeAnimationFrame(() => { if (!disposed) syncFrameHeight() }))
  } }
  window.addEventListener('reader-content-zoom', zoomSettled)
  registerCleanup?.(() => {
    disposed = true
    observer?.disconnect()
    columnObserver?.disconnect()
    for (const image of pendingImages) {
      image.removeEventListener('load', imageSettled)
      image.removeEventListener('error', imageSettled)
    }
    for (const id of animationFrames) cancelAnimationFrame(id)
    window.removeEventListener('reader-content-zoom', zoomSettled)
  })
  return wrap
}
