/** ‏render — مُركِّبُ المستند: يقسّم فقرات النموذج إلى صفحاتٍ بعلامات
 *  pageBreakBefore (التي يحويها النموذج محسومةً من w:pageBreakBefore وw:br page
 *  وحدود المقاطع)، ويبني حاويةَ كلِّ صفحةٍ بهندستها وترويستها/تذييلها وحواشيها. */

import type { BodyParagraph, DocumentModelV0, FloatAnchor, SectionGeometry } from "@engine/ooxml-model";
import { css, el, px } from "./dom.js";
import { registerEmbeddedFonts } from "./fonts.js";
import { newRenderCtx, paragraphToElement, type RenderCtx } from "./Paragraph.js";
import { renderPageBlocks } from "./ParagraphTable.js";
import { formatPageNumberValue, headerFooterElement, headerFooterPartName, pageBorderElement, pageCss, pageNumberText } from "./SectPr.js";
import { twipsToPx } from "./units.js";
import { anchorToElement } from "./ImageToWidget.js";
import { formatNumber } from "./abstractNum.js";

/** OOXML defaults an omitted wp:anchor@behindDoc to the front layer. */
export function floatingAnchorBehindDocument(anchor: Pick<FloatAnchor, "behindDoc">): boolean {
  return anchor.behindDoc ?? false;
}

/** هل يجب أن يحجز عائم الرأس/التذييل مساحةً من المتن؟
 * كل عنصر أمام المتن يُعامل حاجزًا بصريًا، حتى Wrap=None: هذا النمط شائع في
 * شعارات وصور الرؤوس الحرة، وتركه بلا خلوص كان يضعه فوق أول سطور الصفحة.
 * وحدها طبقة behindDoc (الخلفية/العلامة المائية) يسمح لها بالمرور خلف النص. */
export function headerFooterAnchorReservesSpace(
  anchor: FloatAnchor, section?: SectionGeometry, kind: "header" | "footer" = "header",
): boolean {
  if (anchor.behindDoc) return false;
  if (anchor.wrap !== "None" || !section) return true;
  const margin = kind === "header" ? section.marTopTwips : section.marBottomTwips;
  const pageArea = Math.max(1, section.pageWTwips * section.pageHTwips);
  // Wrap=None في قصة الرأس قد يكون شعارًا/مربع رقم صغيرًا أو خلفية صفحة كاملة.
  // الصغير فقط حاجز؛ الكبير طبقة تصميم لا يجوز أن يدفع متن Word مئات البكسلات.
  return anchor.extentH <= Math.max(720, margin * 1.5)
    && (anchor.extentW * anchor.extentH) / pageArea < 0.22;
}

/** خلوصٌ محلي يمنع تداخل قصة الرأس/التذييل مع المتن بعد القياس المرئي. */
export function storyClearancePx(obstacleEdge: number, bodyEdge: number, scale: number, gap = 12): number {
  if (!Number.isFinite(scale) || scale <= 0) return 0;
  const overlap = (obstacleEdge - bodyEdge) / scale;
  return overlap > 0 ? overlap + gap : 0;
}

/** Bottom page padding already reserves marBottom; add only actual intrusion. */
export function footerMarginExcess(pageBottom: number, footerTop: number, marginBottom: number, scale: number, gap = 12): number {
  if (![pageBottom, footerTop, marginBottom, scale].every(Number.isFinite) || scale <= 0) return 0;
  return Math.max(0, (pageBottom - footerTop) / scale + gap - Math.max(0, marginBottom));
}

/**
 * خلوص الرأس والتذييل جزء من مساحة Word القابلة للطباعة، لا إضافة خارجها.
 * إبقاء minHeight كاملًا مع margin كان يثبت حاشية pageBottom عند الحد القديم
 * ثم يدفع التذييل تحته، فتتقاطع القصتان. ننقص الحزامين من جسم المتن مع إبقاء
 * الهوامش نفسها، فيظل مجموع (هامش + جسم + هامش) مساويًا لارتفاع Word.
 */
export function wordStoryBodyHeight(bodyHeight: number, topClearance: number, bottomClearance: number): number {
  const finite = (value: number): number => Number.isFinite(value) ? Math.max(0, value) : 0;
  return Math.max(0, finite(bodyHeight) - finite(topClearance) - finite(bottomClearance));
}

/** موضع مرساة relativeFrom=paragraph بعد حل موضع فقرتها في إحداثيات الصفحة. */
export function paragraphAnchorTop(ownerTopPx: number, posVOffsetTwips: number): number {
  return ownerTopPx + twipsToPx(posVOffsetTwips);
}

/** صورة غلاف خالصة: لا متن ظاهر في الصفحة، وصورة عائمة واحدة على الأقل تغطي
 * معظم الورقة. في هذه الحالة يعرض Word الصورة كورقة كاملة حتى إن حملت المرساة
 * نزفًا طفيفًا خارج الحدود؛ الويب يملأ الورقة ثم يقص عند حدها. */
export function coverAnchorForPage(
  pageParas: BodyParagraph[], section: SectionGeometry,
): FloatAnchor | null {
  const visibleText = pageParas.some(p => !p.excluded && p.text.replace(/[\s\r\u0007]/g, "").length > 0);
  if (visibleText) return null;
  const allAnchors = pageParas.flatMap(p => p.anchors);
  // الخلفية الكبيرة مع مربعات نص فوقها صفحة مصممة، لا غلاف خالص.
  if (allAnchors.length !== 1) return null;
  const pageArea = Math.max(1, section.pageWTwips * section.pageHTwips);
  const candidates = allAnchors
    .filter(a => !a.inlineFlow && !a.part && Boolean(a.rId) && !a.textBox?.length)
    .map(anchor => ({ anchor, ratio: (anchor.extentW * anchor.extentH) / pageArea }))
    .filter(item => item.ratio >= 0.55)
    .sort((a, b) => b.ratio - a.ratio);
  return candidates[0]?.anchor ?? null;
}

/** يفرض غلاف الصفحة الخالص داخل حافة الورقة، بلا بطاقة بيضاء خلفه. */
export function fillPageWithCover(node: HTMLElement, section: SectionGeometry, anchor?: FloatAnchor): void {
  // الموضع والحجم وsrcRect حُسمت من wp:anchor نفسه قبل هذه الدالة. إعادة
  // كتابتها بحجم الورقة كانت تقص امتداد الديوان الحقيقي (15tw من الحافة ثم
  // نزف 94tw). لا نغير شيئًا هندسيًا هنا؛ overflow الصفحة وحده يقص النزف
  // كما يفعل Word، وstretch/contain يبقيان من خصائص المرساة المؤلفة.
  if (anchor) {
    // wp:positionH relativeFrom=column starts at the text column, whereas the
    // absolutely positioned web child starts in the padded page. Convert to
    // physical-sheet coordinates so authored -1785tw + 1800tw = 15tw, not
    // -119px of horizontal overflow.
    const physicalX = anchor.posHRel === "column" || anchor.posHRel === "margin"
      ? section.marLeftTwips + anchor.posHOffset : anchor.posHOffset;
    const physicalY = anchor.posVRel === "paragraph" || anchor.posVRel === "margin"
      ? section.marTopTwips + anchor.posVOffset : anchor.posVOffset;
    node.style.left = px(twipsToPx(physicalX));
    node.style.top = px(twipsToPx(physicalY));
    node.style.width = px(twipsToPx(anchor.extentW));
    node.style.height = px(twipsToPx(anchor.extentH));
  }
  node.setAttribute("data-word-cover", "true");
}

export function replacePageFieldText(value: string, page: string, total: string, sectionTotal = total): string {
  return value.replace(/\bSECTIONPAGES\b/g, sectionTotal)
    .replace(/\bNUMPAGES\b/g, total).replace(/\bPAGE\b/g, page);
}

/** حقول PAGE داخل مربع نص عائم لا تمر عبر headerFooterElement؛ نحدّث عقد النص
 * في مكانها مع إبقاء spans وتنسيقات الرن كما هي. */
function materializeFloatingPageFields(
  node: HTMLElement, page: string, total: string, sectionTotal: string,
  styleRefs: ReadonlyMap<string, string> = new Map(),
): void {
  const root = node as Node;
  const stack: Node[] = [root];
  let hasPageField = false;
  while (stack.length) {
    const current = stack.pop()!;
    if (current.nodeType === 3 && current.nodeValue) {
      if (/\bPAGE\b/.test(current.nodeValue)) hasPageField = true;
      current.nodeValue = replacePageFieldText(current.nodeValue, page, total, sectionTotal)
        .replace(/STYLEREF:([^\s]+)/g, (_all, id: string) => styleRefs.get(id) ?? "");
    }
    for (const child of Array.from(current.childNodes ?? [])) stack.push(child);
  }
  if (hasPageField) node.setAttribute("data-word-page-field", "true");
}

/** فقرة تمهيدية بنيوية لا تحمل شيئًا مرئيًا. بعض ملفات Word تبدأ بواحدة
 * قبل غلاف VML ذي pageBreakBefore؛ عدّها ورقةً مستقلة يصنع صفحة بيضاء وهمية
 * ويدفع الغلاف إلى الورقة الثانية. لا نعمم هذا على الفراغات الداخلية لأنها
 * قد تكون صفحات مقصودة بين حدّي صفحة متتاليين. */
function isLeadingStructuralParagraph(paragraph: BodyParagraph): boolean {
  return (paragraph.anchors?.length ?? 0) === 0
    && !paragraph.tableCell
    && (paragraph.text ?? "").replace(/[\s\r\u0007]/g, "").length === 0
    && (paragraph.runs ?? []).every(run => run.text.replace(/[\s\r\u0007]/g, "").length === 0);
}

/** يقسّم الفقرات إلى صفحاتٍ (كلُّ pageBreakBefore يفتح صفحةً جديدة). */
export function groupPages(model: DocumentModelV0): BodyParagraph[][] {
  const pages: BodyParagraph[][] = [];
  let current: BodyParagraph[] = [];
  let suppressedLeadingBoundary = false;
  for (const p of model.paragraphs) {
    const boundaries = p.pageBreaksBefore ?? (p.pageBreakBefore ? 1 : 0);
    for (let boundary = 0; boundary < boundaries; boundary++) {
      const incomingIsVisible = (p.anchors?.length ?? 0) > 0 || Boolean(p.tableCell)
        || (p.text ?? "").replace(/[\s\r\u0007]/g, "").length > 0;
      if (!suppressedLeadingBoundary && !pages.length && incomingIsVisible
          && current.every(isLeadingStructuralParagraph)) {
        suppressedLeadingBoundary = true;
        continue;
      }
      pages.push(current);
      current = [];
    }
    current.push(p);
  }
  if (current.length || !pages.length) pages.push(current);
  return pages;
}

function explicitPageCount(model: DocumentModelV0): number {
  return groupPages(model).length;
}

/** مقطعُ الصفحة (من فهرس مقطع أولِ فقراتها). */
export function sectionOf(model: DocumentModelV0, pageParas: BodyParagraph[]): SectionGeometry {
  const idx = pageParas[0]?.sectionIndex ?? model.sections.length - 1;
  return model.sections[idx] ?? model.section;
}

/** عدد الصفحات الفيزيائية لكل مقطع بعد اكتمال خريطة صفحات Word. */
export function pageCountsBySection(pages: BodyParagraph[][], fallbackSectionIndex: number): Map<number, number> {
  const counts = new Map<number, number>();
  let previous = fallbackSectionIndex;
  for (const paragraphs of pages) {
    const sectionIndex = paragraphs[0]?.sectionIndex ?? previous;
    counts.set(sectionIndex, (counts.get(sectionIndex) ?? 0) + 1);
    previous = sectionIndex;
  }
  return counts;
}

/** المقطع المالك للصفحة الفارغة هو المقطع السابق؛ فالصفحة نتجت من حدّين
 * قبل أول فقرة في المقطع التالي. للفراغ القائد فقط نسقط إلى أقرب تالٍ. */
export function pageSectionIndex(
  pages: BodyParagraph[][], pageIndex: number, fallbackSectionIndex: number,
): number {
  const direct = pages[pageIndex]?.[0]?.sectionIndex;
  if (direct != null) return direct;
  for (let i = pageIndex - 1; i >= 0; i--) {
    const prior = pages[i]?.[0]?.sectionIndex;
    if (prior != null) return prior;
  }
  for (let i = pageIndex + 1; i < pages.length; i++) {
    const next = pages[i]?.[0]?.sectionIndex;
    if (next != null) return next;
  }
  return fallbackSectionIndex;
}

/** تسلسل أرقام Word المعدلة لكل صفحة مادية، مع إعادة pgNumStart عند أول
 * صفحة فعلية للمقطع لا عند صفحة فارغة من المقطع السابق. */
export function documentPageNumbers(model: DocumentModelV0, pages: BodyParagraph[][]): number[] {
  const out: number[] = [];
  const pageInSection = new Map<number, number>();
  let previous = 0;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const secIdx = pageSectionIndex(pages, pageIndex, model.sections.length - 1);
    const section = model.sections[secIdx] ?? model.section;
    const idx = pageInSection.get(secIdx) ?? 0;
    pageInSection.set(secIdx, idx + 1);
    previous = nextDocumentPageNumber(previous, pageIndex, idx, section);
    out.push(previous);
  }
  return out;
}

/** قيم STYLEREF للرأس: أول مطابق في الصفحة، وإلا أقرب قيمة سابقة. */
export function styleRefValuesForPage(
  pageParas: BodyParagraph[], preceding: ReadonlyMap<string, string>,
): Map<string, string> {
  const values = new Map(preceding);
  const seen = new Set<string>();
  for (const p of pageParas) if (p.styleId && p.text && !seen.has(p.styleId)) {
    values.set(p.styleId, p.text);
    seen.add(p.styleId);
  }
  return values;
}

/** موضع الحاشية الفعلي: تجاوز المقطع يعلو إعداد المستند العام. */
export function notePositionForPage(
  model: DocumentModelV0, section: SectionGeometry, kind: "footnote" | "endnote",
): string {
  return section[`${kind}Pr`]?.position
    ?? model.noteSettings?.[kind].position
    ?? (kind === "footnote" ? "pageBottom" : "docEnd");
}

/** الفاصل تابع لنوع قصة الحاشية نفسها؛ استعمال footnotes دائمًا كان يسقط
 * فاصل endnotes المخصص ويعرض تصميمًا من جزء آخر. */
export function noteSeparatorParagraphs(
  model: DocumentModelV0, kind: "footnote" | "endnote", continuation = false,
): BodyParagraph[] | undefined {
  return (kind === "endnote" ? model.endnotes : model.footnotes).get(continuation ? "0" : "-1");
}

/** Custom marks are commonly stored as literal text at the start of the note
 * body.  In that form Word does not synthesize a second marker. */
export function noteBodyNeedsMarker(paras: BodyParagraph[], customMark: string | null): boolean {
  if (paras.some(paragraph => paragraph.runs?.some(run => run.noteBodyRef))) return false;
  if (!customMark) return true;
  const leading = paras.map(paragraph => paragraph.text).join("").trimStart();
  return !leading.startsWith(customMark);
}

/** يعيد أرقام المراجع على حدود الصفحات **المعروضة فعليًا**. استخراج OOXML لا
 * يعرف الكسور التلقائية التي يحسبها Word؛ لذلك numRestart=eachPage لا يصح إلا
 * بعد وصول خريطة Word وتقسيم الفقرات إلى مجموعات صفحات. */
export function renumberNoteRefsForPages(model: DocumentModelV0, pages: BodyParagraph[][]): void {
  const counters = {
    footnote: model.noteSettings?.footnote.start ?? 1,
    endnote: model.noteSettings?.endnote.start ?? 1,
  };
  counters.footnote--; counters.endnote--;
  let previousSection = -1;
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const paragraphs = pages[pageIndex]!;
    const sectionIndex = paragraphs[0]?.sectionIndex ?? previousSection;
    const section = model.sections[sectionIndex] ?? model.section;
    const sectionChanged = previousSection >= 0 && sectionIndex !== previousSection;
    for (const kind of ["footnote", "endnote"] as const) {
      const local = section?.[`${kind}Pr`];
      const global = model.noteSettings?.[kind] ?? { start: 1, restart: "continuous", fmt: "decimal", position: kind === "footnote" ? "pageBottom" : "docEnd" };
      const pref = { ...global, ...local };
      if ((pref.restart === "eachPage" && pageIndex >= 0)
          || (sectionChanged && (pref.restart === "eachSect" || local?.start != null)))
        counters[kind] = pref.start - 1;
      for (const paragraph of paragraphs) for (const run of paragraph.runs) {
        const ref = run.noteRef;
        if (!ref || ref.kind !== kind) continue;
        if (!ref.custom) ref.num = ++counters[kind];
        ref.fmt = pref.fmt;
      }
    }
    previousSection = sectionIndex;
  }
}

/** تسلسل PAGE بين المقاطع: غياب pgNumStart يعني متابعة المقطع السابق، لا 1. */
export function nextDocumentPageNumber(
  previous: number, physicalPageIndex: number, pageIndexInSection: number, section: SectionGeometry,
): number {
  // Word emits w:start="0" in a number of converted documents to mean that
  // the section does not visibly restart its PAGE sequence. Treating zero as
  // a literal first page made every such section show 0, 1, ... in its footer
  // although the authored footer continues the physical document sequence.
  const authoredStart = section.pgNumStart != null && section.pgNumStart > 0
    ? section.pgNumStart : null;
  if (physicalPageIndex === 0) return authoredStart ?? 1;
  if (pageIndexInSection === 0 && authoredStart != null) return authoredStart;
  return previous + 1;
}

/** كتلةُ الحواشي/التعليقات الختامية للصفحة — أسفل المتن بفاصلٍ فوقها. */
export function footnotesBlock(
  model: DocumentModelV0, pageParas: BodyParagraph[], ctx: RenderCtx,
  endnoteParas: BodyParagraph[] | null = null, section = sectionOf(model, pageParas),
): HTMLElement | null {
  const seen = new Set<string>();
  const entries: { id: string; num: number; kind: string; fmt: string;
    customMark: string | null; order: number }[] = [];
  let order = 0;
  // Footnotes and endnotes are separate Word stories and can have different
  // placement (commonly pageBottom vs docEnd). Never merge both into a single
  // block merely because the current sheet also closes an endnote scope.
  const renderedKind = endnoteParas ? "endnote" : "footnote";
  const noteParas = endnoteParas ?? pageParas;
  for (const p of noteParas) {
    for (const r of p.runs) {
      const n = r.noteRef;
      if (!n || !n.id || n.kind !== renderedKind) continue;
      const noteKey = `${n.kind}:${n.id}`;
      if (seen.has(noteKey)) continue;
      seen.add(noteKey);
      entries.push({ id: n.id, num: n.num, kind: n.kind, fmt: n.fmt ?? "decimal",
        customMark: n.custom ? (n.customMark ?? r.text) : null, order: order++ });
    }
  }
  if (!entries.length) return null;

  const notePosition = endnoteParas
    ? notePositionForPage(model, section, "endnote")
    : notePositionForPage(model, section, "footnote");
  const wrap = el("div", {
    class: "page-footnotes",
    "data-word-note-position": notePosition,
    style: css([
      "column-span:all",
      notePosition === "pageBottom" ? "margin-top:auto" : "",
      "flex:none",
    ]),
  });
  const separator = noteSeparatorParagraphs(model, endnoteParas ? "endnote" : "footnote");
  const customSeparator = separator?.some(p => p.text.trim() || p.anchors.length || p.pBdr || p.shd);
  if (customSeparator) {
    const holder = el("div", { class: "fn-separator" });
    for (const node of renderPageBlocks(separator!, section, ctx)) holder.appendChild(node);
    wrap.appendChild(holder);
  } else {
    wrap.appendChild(el("div", { class: "fn-rule", style: "border-top:0.5px solid #000;margin:8px 0 4px 0;margin-inline-end:auto;width:30%" }));
  }

  for (const e of entries) {
    const src = e.kind === "endnote" ? model.endnotes : model.footnotes;
    const paras = src.get(e.id);
    if (!paras?.length) continue;
    const rtlNote = paras.some(paragraph => paragraph.bidi
      || paragraph.runs.some(run => run.direction === "rtl" || run.bidiLanguage?.toLowerCase().startsWith("ar")));
    const marker = e.customMark ?? formatNumber(e.fmt === "decimal" && rtlNote ? "hindiNumbers" : e.fmt, e.num);
    const renderedParas = composeAtomicNoteMarker(paras, marker);
    const entry = el("div", { class: "fn-entry", style: css([
      "display:block", "direction:rtl",
    ]) });
    const body = el("div", { class: "fn-body", "data-word-note-marker": `(${marker})`,
      style: css(["font-size:10pt", "text-align:justify"]) });
    // A note is a block container in Word, not a flat paragraph list.  In
    // particular, tables inside footnotes carry row/cell geometry and
    // cantSplit semantics that paragraphToElement alone cannot preserve.
    for (const node of renderPageBlocks(renderedParas, section, ctx)) body.appendChild(node);
    entry.appendChild(body);
    wrap.appendChild(entry);
  }
  return wrap;
}

/** يركّب رقم الحاشية في أول فقرة كتشغيل واحد ذري، ويحذف أقواس Word المفصولة.
 * الفقرات التالية تبقى بلا عمود رقم مستقل فتبدأ بمحاذاة متن الحاشية. */
export function composeAtomicNoteMarker(paras: BodyParagraph[], marker: string): BodyParagraph[] {
  const firstIndex = paras.findIndex(paragraph => paragraph.runs.length > 0);
  if (firstIndex < 0) return paras;
  return paras.map((paragraph, paragraphIndex) => {
    if (paragraphIndex !== firstIndex) return paragraph;
    const authoredRefIndex = paragraph.runs.findIndex(run => run.noteBodyRef);
    const authoredRef = authoredRefIndex >= 0 ? paragraph.runs[authoredRefIndex] : undefined;
    const basis = authoredRef ?? paragraph.runs[0]!;
    let beforeContent = true;
    const markerRunIndices = new Set<number>();
    if (authoredRefIndex >= 0) {
      markerRunIndices.add(authoredRefIndex);
      for (const adjacent of [authoredRefIndex - 1, authoredRefIndex + 1]) {
        const text = paragraph.runs[adjacent]?.text ?? "";
        if (/^[\s()（）]*$/u.test(text)) markerRunIndices.add(adjacent);
      }
    }
    const contentRuns = paragraph.runs.flatMap((run, runIndex) => {
      if (markerRunIndices.has(runIndex) || run.noteBodyRef) return [];
      let text = run.text;
      if (beforeContent && authoredRefIndex >= 0) {
        text = text.replace(/^\s+/u, "");
        if (text) beforeContent = false;
      } else if (beforeContent) {
        // في بعض المحولات لا توجد noteBodyRef مستقلة، بل علامة آلية فارغة
        // أو رقمية في أول الرن. احذف زوج العلامة الكامل فقط؛ حذف كل قوس بادئ
        // كان يقتطع قوسًا مؤلفًا من متن حاشية تبدأ مثل «(عجبتُ): ...».
        text = text.replace(/^\s*[（(]\s*[0-9٠-٩]*\s*[）)]\s*/u, "");
        if (text) beforeContent = false;
      }
      return text ? [{ ...run, text }] : [];
    });
    const atomic = { ...basis, text: `(${marker})`, noteBodyRef: null,
      family: "Adwa Assalaf", bold: false, italic: false, superscript: false,
      subscript: false, position: 0, direction: "ltr" as const };
    const spacer = { ...atomic, text: " " };
    const runs = [atomic, spacer, ...contentRuns];
    return { ...paragraph, text: runs.map(run => run.text).join(""), runs };
  });
}

/** يبني حاويةَ صفحةٍ كاملةً (هندسة + ترويسة + متن + حواشٍ + تذييل). */
export function buildPageElement(
  model: DocumentModelV0,
  section: SectionGeometry,
  pageParas: BodyParagraph[],
  pageIdxInSection: number,
  ctx: RenderCtx,
  endnoteParas: BodyParagraph[] | null = null,
  pageNumberOverride?: string,
  totalPagesOverride?: number,
  sectionPagesOverride?: number,
  pageNumberValue?: number,
  styleRefs: ReadonlyMap<string, string> = new Map(),
): HTMLElement {
  const coverAnchor = coverAnchorForPage(pageParas, section);
  const page = el("div", { class: coverAnchor ? "page page-cover" : "page", style: pageCss(section) });
  if (model.pageBackground) page.style.backgroundColor = `#${model.pageBackground}`;
  if (coverAnchor) page.style.overflow = "hidden";
  const pageBorder = coverAnchor ? null : pageBorderElement(section, pageIdxInSection);
  if (pageBorder) page.appendChild(pageBorder);
  const headerFrontFloats: HTMLElement[] = [], footerFrontFloats: HTMLElement[] = [];
  const physicalTotal = String(totalPagesOverride ?? explicitPageCount(model));
  const sectionTotal = String(sectionPagesOverride ?? totalPagesOverride ?? physicalTotal);
  const materialize = (node: HTMLElement) =>
    materializeFloatingPageFields(node, pageNumberOverride ?? pageNumberText(section, pageIdxInSection), physicalTotal, sectionTotal, styleRefs);

  const appendHeaderFooterFloats = (behind: boolean): void => {
    for (const kind of ["header", "footer"] as const) {
      const part = headerFooterPartName(model, section, pageIdxInSection, kind, pageNumberValue);
      const paragraphs = part ? model.headerFooters.get(part) : null;
      const anchors = (paragraphs ?? [])
        .flatMap(paragraph => paragraph.anchors.map(anchor => ({ anchor, paragraphIndex: paragraph.index })))
        // wp:anchor@behindDoc is optional and defaults to false.  Treating an
        // omitted attribute as neither front nor back silently dropped the
        // whole shape (including its textbox story) from both passes.
        .filter(item => !item.anchor.inlineFlow && floatingAnchorBehindDocument(item.anchor) === behind)
        .sort((a, b) => (a.anchor.zOrder ?? 0) - (b.anchor.zOrder ?? 0));
      for (const { anchor, paragraphIndex } of anchors) {
        const node = anchorToElement(anchor, ctx);
        if (!node) continue;
        materialize(node);
        positionFloatingAnchor(node, anchor, paragraphIndex, section, page, kind);
        // behindDoc هو وحده الذي يضع زخرفة الرأس/التذييل خلف المتن. كانت
        // العناصر الأمامية تُعطى z-index=1 بينما page-body عند 2، فيبقى الخط
        // والصندوق موجودين في DOM لكن يغطيهما بياض المتن (كما حدث في إبهاج).
        // ارفع العناصر الأمامية فقط؛ الخلفيات/العلامات المائية تبقى خلف المتن.
        node.style.zIndex = behind ? "0" : "5";
        node.style.pointerEvents = "none";
        // يظل العنصر العائم تابعًا لقصة التذييل عند تمديد سطح الورقة في
        // القارئ. وسم القصة أهم من موضعه الحالي لأن top محسوب من ارتفاع Word
        // الأصلي، بخلاف holder النصي المثبت بـ bottom.
        // لا نضع data-word-story على الزخرفة نفسها؛ هذا الوسم محجوز لحاوية
        // القصة الفعلية (header/footer). وإلا يعيد querySelector الزخرفة قبل
        // مالك الفقرة، فتفشل محاذاة الخطوط والمربعات في الصفحات المرنة.
        node.setAttribute("data-word-story-ornament", kind);
        // العنصر العائم Wrap=None طبقة زخرفية حرة (وقد يكون غلافًا أو علامة
        // مائية) ولا يدفع المتن. الأنواع الملتفة الأمامية وحدها تحجز خلوصًا.
        if (headerFooterAnchorReservesSpace(anchor, section, kind))
          (kind === "header" ? headerFrontFloats : footerFrontFloats).push(node);
        page.appendChild(node);
      }
    }
  };

  const appendFloats = (behind: boolean): void => {
    const anchors = pageParas
      .flatMap(paragraph => paragraph.anchors.map(anchor => ({ anchor, paragraphIndex: paragraph.index })))
      .filter(item => !item.anchor.inlineFlow && floatingAnchorBehindDocument(item.anchor) === behind)
      .sort((a, b) => (a.anchor.zOrder ?? 0) - (b.anchor.zOrder ?? 0));
      for (const { anchor, paragraphIndex } of anchors) {
        const node = anchorToElement(anchor, ctx);
        if (!node) continue;
        materialize(node);
        positionFloatingAnchor(node, anchor, paragraphIndex, section, page);
        if (anchor === coverAnchor) fillPageWithCover(node, section, anchor);
        node.style.zIndex = behind ? "0" : "4";
      node.style.pointerEvents = "none";
      page.appendChild(node);
    }
  };

  appendFloats(true);
  appendHeaderFooterFloats(true);

  const header = headerFooterElement(model, section, pageIdxInSection, "header", ctx,
    pageNumberOverride, totalPagesOverride, sectionPagesOverride, pageNumberValue, styleRefs);
  if (header) page.appendChild(header);

  const body = el("div", { class: "page-body" });
  body.style.position = "relative";
  body.style.zIndex = "2";
  const bodyHeight = twipsToPx(
    section.pageHTwips - section.marTopTwips - section.marBottomTwips,
  );
  body.style.minHeight = px(bodyHeight);
  const content = renderPageBlocks(pageParas, section, ctx);
  // الحواشي أسفل المتن (بعد كل الفقرات) — ككتلةٍ مستقلّة
  const fn = footnotesBlock(model, pageParas, ctx);
  const en = endnoteParas ? footnotesBlock(model, pageParas, ctx, endnoteParas) : null;
  const footnoteAtBottom = fn?.dataset.wordNotePosition === "pageBottom";
  if (footnoteAtBottom) {
    body.style.display = "flex";
    body.style.flexDirection = "column";
  }
  let contentTarget = body;
  const unequalColumns = section.explicitColumns && section.explicitColumns.length > 1
    && section.explicitColumns.some(column => column.widthTwips !== section.explicitColumns![0]!.widthTwips);
  if (unequalColumns) {
    // CSS multi-column cannot express per-column widths. Keep a truthful linear
    // fallback instead of fabricating equal columns, and expose the limitation.
    body.dataset.wordUnsupportedColumns = "unequal-widths";
  } else if (section.colCount > 1) {
    const columns = footnoteAtBottom
      ? el("div", { class: "page-columns", "data-word-column-flow": "separate-from-page-bottom-notes" })
      : body;
    columns.style.columnCount = String(section.colCount);
    columns.style.columnGap = px(twipsToPx(section.colSpaceTwips));
    columns.style.columnFill = "auto";
    columns.style.direction = "rtl";
    if (footnoteAtBottom) {
      // Word يوازن متن الأعمدة داخل المساحة المتبقية فوق الحاشية. وضع الحاشية
      // نفسها في multi-column flow يجعلها تبدأ في عمود أو تنقسم بين عمودين.
      columns.style.flex = "1 1 auto";
      columns.style.minHeight = "0";
      columns.style.overflow = "hidden";
      body.appendChild(columns);
    } else {
      columns.style.height = px(twipsToPx(
        section.pageHTwips - section.marTopTwips - section.marBottomTwips,
      ));
    }
    contentTarget = columns;
  }
  for (const node of content) contentTarget.appendChild(node);
  if (fn) body.appendChild(fn);
  if (en) body.appendChild(en);
  page.appendChild(body);

  appendFloats(false);
  appendHeaderFooterFloats(false);

  const footer = headerFooterElement(model, section, pageIdxInSection, "footer", ctx,
    pageNumberOverride, totalPagesOverride, sectionPagesOverride, pageNumberValue, styleRefs);
  if (footer) page.appendChild(footer);

  // Word يفصل قصة الرأس/التذييل عن المتن. العناصر الخلفية (watermark أو صورة
  // behindDoc) لا تحجز مساحة، أما النص والصور الأمامية فلا يجوز أن تبتلع أول/آخر
  // سطر عند اختلاف قياس خطوط المتصفح. نحسب خلوصًا محليًا بعد تركيب الصفحة فقط.
  const syncStoryClearance = () => {
    if (typeof page.getBoundingClientRect !== "function" || typeof body.getBoundingClientRect !== "function") return;
    const pageRect = page.getBoundingClientRect(), bodyRect = body.getBoundingClientRect();
    if (page.isConnected === false || pageRect.width <= 0 || pageRect.height <= 0) return;
    const scale = page.offsetWidth ? pageRect.width / page.offsetWidth : 1;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const rects = (nodes: HTMLElement[]) => nodes
      .filter(node => typeof node.getBoundingClientRect === "function")
      .map(node => node.getBoundingClientRect());
    const oldTop = Number(body.dataset.wordHeaderClearance ?? 0);
    const unshiftedTop = bodyRect.top - oldTop * scale;
    const headerBottom = Math.max(pageRect.top, ...rects([...(header ? [header] : []), ...headerFrontFloats]).map(rect => rect.bottom));
    const measuredTop = storyClearancePx(headerBottom, unshiftedTop, scale);
    // لا نسمح لدورة قياس لاحقة بإلغاء الخلوص بعد أن تحرك المتن؛ كان ذلك يعيد
    // الرأس فوق أول فقرة عند اكتمال الخط أو الصورة في توقيت مختلف.
    const headerBand = twipsToPx(Math.max(240,
      section.marTopTwips - (section.headerDistTwips ?? 720)));
    const nextTop = Math.min(headerBand, Math.max(oldTop, measuredTop));
    body.dataset.wordHeaderClearance = String(nextTop);
    body.style.marginTop = px(nextTop);

    const footerTop = Math.min(pageRect.bottom, ...rects([...(footer ? [footer] : []), ...footerFrontFloats]).map(rect => rect.top));
    const oldBottom = Number(body.dataset.wordFooterClearance ?? 0);
    // لا ننقص الخلوص في الدورة التالية بعد أن أدى تمدد الورقة إلى تحريك التذييل؛
    // وإلا تتذبذب الصفحة بين ارتفاعين مع ResizeObserver.
    const excess = footerMarginExcess(pageRect.bottom, footerTop,
      twipsToPx(section.marBottomTwips), scale);
    // The existing page padding owns the bottom margin. Only a tall footer
    // protruding above that margin reduces the usable body area. Real content
    // overflow remains visible and is handled by the reader geometry audit.
    const nextBottom = Math.max(oldBottom, excess);
    body.dataset.wordFooterClearance = String(nextBottom);
    body.style.marginBottom = px(nextBottom);
    // قارئ الويب قد يحوّل ورقة Word قليلة المحتوى إلى سطح مرن أقصر. لا نعد
    // بعد ذلك min-height الأصلي في دورة الخطوط/ResizeObserver المتأخرة، وإلا
    // دفعت margin-top:auto الحاشية إلى قاع الورقة القديمة وأعادت الفراغ الكبير.
    body.style.minHeight = body.dataset.wordCompactSurface === "true"
      ? "0px" : px(wordStoryBodyHeight(bodyHeight, nextTop, nextBottom));
  };
  if (typeof page.addEventListener === "function") {
    page.addEventListener("word-layout", syncStoryClearance);
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(syncStoryClearance);
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(syncStoryClearance);
      if (header) observer.observe(header);
      if (footer) observer.observe(footer);
      observer.observe(body);
    }
    if (typeof document !== "undefined" && document.fonts?.ready)
      void document.fonts.ready.then(syncStoryClearance);
  }

  return page;
}

/** موضع wp:anchor بالنسبة إلى الصفحة/الهامش/العمود أو الفقرة المالكة. */
export function positionFloatingAnchor(
  node: HTMLElement,
  anchor: FloatAnchor,
  paragraphIndex: number,
  section: SectionGeometry,
  page: HTMLElement,
  partKind?: "header" | "footer",
): void {
  const pageW = twipsToPx(section.pageWTwips);
  const pageH = twipsToPx(section.pageHTwips);
  const refW = (from: string) => from === "page" ? pageW
    : pageW - twipsToPx(section.marLeftTwips + section.marRightTwips);
  const refH = (from: string) => from === "page" ? pageH
    : pageH - twipsToPx(section.marTopTwips + section.marBottomTwips);
  const w = anchor.relWidth && anchor.relWidth.pct > 0 ? refW(anchor.relWidth.from) * anchor.relWidth.pct
    : twipsToPx(anchor.extentW);
  const h = anchor.relHeight && anchor.relHeight.pct > 0 ? refH(anchor.relHeight.from) * anchor.relHeight.pct
    : twipsToPx(anchor.extentH);
  const marginX = twipsToPx(section.marLeftTwips);
  const marginY = twipsToPx(section.marTopTwips);

  const marginRight = twipsToPx(section.marRightTwips);
  const marginBottom = twipsToPx(section.marBottomTwips);
  // topMargin/bottomMargin/leftMargin/rightMargin تشير إلى *منطقة* الهامش
  // نفسها، لا إلى بداية المتن. كان جمع marTop مرة أخرى يُنزل مربعات الرأس
  // العائمة إلى داخل النص، كما في «تهنئة ومؤازرة».
  const hRef = anchor.posHRel === "page" ? { start: 0, size: pageW }
    : anchor.posHRel === "leftMargin" ? { start: 0, size: marginX }
    : anchor.posHRel === "rightMargin" ? { start: pageW - marginRight, size: marginRight }
    : { start: marginX, size: pageW - marginX - marginRight };
  const vRef = anchor.posVRel === "page" ? { start: 0, size: pageH }
    : anchor.posVRel === "topMargin" ? { start: 0, size: marginY }
    : anchor.posVRel === "bottomMargin" ? { start: pageH - marginBottom, size: marginBottom }
    : { start: marginY, size: pageH - marginY - marginBottom };

  let left = hRef.start + twipsToPx(anchor.posHOffset);
  if (anchor.posHAlign === "center") left = hRef.start + (hRef.size - w) / 2;
  else if (anchor.posHAlign === "right" || anchor.posHAlign === "outside") left = hRef.start + hRef.size - w;
  else if (anchor.posHAlign === "left" || anchor.posHAlign === "inside") left = hRef.start;

  let top = vRef.start + twipsToPx(anchor.posVOffset);
  if (partKind === "header" && anchor.posVRel === "paragraph")
    top = twipsToPx(section.headerDistTwips ?? 720) + twipsToPx(anchor.posVOffset);
  else if (partKind === "footer" && anchor.posVRel === "paragraph")
    top = pageH - twipsToPx(section.footerDistTwips ?? 720) - h + twipsToPx(anchor.posVOffset);
  if (anchor.posVAlign === "center") top = vRef.start + (vRef.size - h) / 2;
  else if (anchor.posVAlign === "bottom" || anchor.posVAlign === "outside") top = vRef.start + vRef.size - h;
  else if (anchor.posVAlign === "top" || anchor.posVAlign === "inside") top = vRef.start;

  const testNode = node as HTMLElement & { attrs?: Map<string, string> };
  const priorClass = typeof node.getAttribute === "function"
    ? (node.getAttribute("class") ?? "") : (testNode.attrs?.get("class") ?? "");
  node.setAttribute("class", `${priorClass} flt-anchor ${anchor.behindDoc ? "flt-behind" : "flt-front"}`.trim());
  node.setAttribute("data-allow-overlap", String(anchor.allowOverlap !== false));
  node.setAttribute("data-layout-in-cell", String(anchor.layoutInCell !== false));
  node.style.position = "absolute";
  // An absolutely positioned child of `.page` is measured from the physical
  // page padding box, not from the beginning of the text column. `left` above
  // is already a physical Word coordinate (column start + authored offset).
  // Subtracting marLeft a second time moved body text boxes to the sheet edge;
  // the closing Ibhaj panel is authored almost exactly in the centre of its
  // text column, yet appeared flush-left in the web reader. Keep the physical
  // horizontal coordinate for body and header/footer stories alike.
  node.style.left = px(left);
  // العقدة العائمة ابن مباشر للورقة ذات padding علوي يساوي marTop. مراسي
  // المتن/topMargin تحمل إحداثيًا محسوبًا من عمود المتن، ولذلك نلغي padding
  // مرة واحدة. أما مرساة paragraph داخل قصة الرأس/التذييل فقد حُوّلت أعلاه
  // بالفعل إلى إحداثي الصفحة الفيزيائي انطلاقًا من headerDist/footerDist؛
  // طرح marTop منها مرة أخرى كان يدفع زخارف الرأس إلى قيمة سالبة ويقصها قبل
  // أن تتاح دورة RAF لحل الفقرة المالكة (ولا تعمل RAF أصلًا في التصدير).
  const storyParagraphCoordinate = Boolean(partKind && anchor.posVRel === "paragraph");
  node.style.top = px(storyParagraphCoordinate ? top : top - marginY);
  if (anchor.relWidth?.pct && anchor.relWidth.pct > 0) node.style.width = px(w);
  if (anchor.relHeight?.pct && anchor.relHeight.pct > 0) node.style.height = px(h);

  if (partKind && anchor.posVRel === "paragraph" && typeof requestAnimationFrame === "function") {
    // A VML rule in a header/footer is relative to the actual owning
    // paragraph.  footerDist is the story reference line, not that
    // paragraph's top.  Using it directly drew Ibhaj's rule below the caption
    // instead of above it.  Resolve after the story holder is mounted and keep
    // tracking it when fonts/zoom change.
    // لا نُخفِ زخرفة الرأس/التذييل أثناء انتظار قياس فقرة الارتكاز. بعض
    // الصفحات تُبنى خارج DOM ثم تدخل القارئ بالتحميل المتدرج؛ وفي تلك الحالة
    // قد تسبق دورة القياس اتصال الصفحة بالوثيقة، فكان الخط/المربع يبقى
    // visibility:hidden إلى الأبد. الموضع الأولي المبني على header/footerDist
    // صالح وآمن للعرض، ثم نصححه إلى موضع الفقرة فور إمكان قياسها.
    node.setAttribute("data-word-anchor-owner", String(paragraphIndex));
    let observedOwner: HTMLElement | null = null;
    const syncToStoryOwner = () => {
      const story = page.querySelector<HTMLElement>(
        `${partKind}[data-word-story="${partKind}"]`,
      );
      const owner = story?.querySelector<HTMLElement>(`[data-idx="${paragraphIndex}"]`);
      if (!owner) return;
      const pageRect = page.getBoundingClientRect();
      const ownerRect = owner.getBoundingClientRect();
      if (pageRect.width <= 0 || ownerRect.width <= 0) return;
      const localScale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
      node.style.top = px((ownerRect.top - pageRect.top) / (localScale || 1)
        + twipsToPx(anchor.posVOffset));
      node.style.visibility = "";
      node.setAttribute("data-word-anchor-resolved", "true");
      if (typeof ResizeObserver === "function" && observedOwner !== owner) {
        observedOwner = owner;
        const observer = new ResizeObserver(syncToStoryOwner);
        observer.observe(owner);
      }
    };
    page.addEventListener?.("word-layout", syncToStoryOwner as EventListener);
    requestAnimationFrame(syncToStoryOwner);
  }

  if (!partKind && anchor.posVRel === "paragraph" && typeof requestAnimationFrame === "function") {
    // لا تملك المرساة paragraph-relative موضعًا صالحًا قبل قياس فقرتها. رسمها
    // مؤقتًا عند أعلى الهامش يكدّس عشرات الزخارف فوق بعضها في الكتب الكثيفة.
    node.style.visibility = "hidden";
    node.setAttribute("data-word-anchor-owner", String(paragraphIndex));
    let exclusion: HTMLElement | null = null;
    let pushedBlock: HTMLElement | null = null;
    let pushedMarginTop = "";
    let observedOwner: HTMLElement | null = null;
    const syncToOwner = () => {
      if (pushedBlock) {
        pushedBlock.style.marginTop = pushedMarginTop;
        pushedBlock = null;
      }
      const owner = page.querySelector<HTMLElement>(`[data-idx="${paragraphIndex}"]`);
      if (!owner) return;
      const pageRect = page.getBoundingClientRect();
      const ownerRect = owner.getBoundingClientRect();
      // الصفحة قد تكون مبنية خارج DOM؛ نؤجل القيمة الحقيقية إلى حدث word-layout
      // الذي يطلقه القارئ عند تركيب هذه الصفحة بعينها.
      if (pageRect.width <= 0 || ownerRect.width <= 0) return;
      // getBoundingClientRect يعيد إحداثيات ما بعد transform:scale في القارئ،
      // بينما style.top/left يعملان في إحداثيات صفحة Word قبل التحجيم.
      const localScale = page.offsetWidth > 0 ? pageRect.width / page.offsetWidth : 1;
      const ownerTop = (ownerRect.top - pageRect.top) / (localScale || 1);
      const ownerLeft = (ownerRect.left - pageRect.left) / (localScale || 1);
      node.style.top = px(paragraphAnchorTop(ownerTop, anchor.posVOffset));
      if (anchor.layoutInCell !== false && owner.dataset.cell && anchor.posHRel === "column")
        node.style.left = px(ownerLeft + twipsToPx(anchor.posHOffset));
      node.style.visibility = "";
      node.setAttribute("data-word-anchor-resolved", "true");
      if (typeof ResizeObserver === "function" && observedOwner !== owner) {
        observedOwner = owner;
        const observer = new ResizeObserver(syncToOwner);
        observer.observe(owner);
      }

      const wrap = anchor.wrap.toLowerCase();
      if (anchor.behindDoc || (!wrap.includes("square") && !wrap.includes("tight")
          && !wrap.includes("through") && !wrap.includes("topandbottom"))) return;
      if (wrap.includes("topandbottom")) {
        // لا نضع spacer ذا marginTop داخل الفقرة المالكة؛ هامشه ينهار عبر الأب
        // فيزيح الفقرة نفسها، ثم يتغير موضع المرساة في حلقة. Word يسمح للنص
        // السابق للصورة أن يبقى قبلها، ويدفع فقط أول كتلة تتقاطع فعليًا معها.
        exclusion?.remove();
        exclusion = null;
        const body = owner.closest<HTMLElement>(".page-body");
        const blocks = body ? Array.from(body.children).filter((x): x is HTMLElement => x instanceof HTMLElement) : [];
        const ownerBlock = owner.closest<HTMLElement>(":scope > .p, :scope > .tbl") ?? owner;
        const ownerAt = blocks.indexOf(ownerBlock);
        const imageRect = node.getBoundingClientRect();
        const collision = blocks.slice(Math.max(0, ownerAt + 1)).find((block) => {
          const rect = block.getBoundingClientRect();
          return rect.top < imageRect.bottom && rect.bottom > imageRect.top;
        });
        if (collision) {
          const rect = collision.getBoundingClientRect();
          pushedBlock = collision;
          pushedMarginTop = collision.style.marginTop;
          const current = Number.parseFloat(getComputedStyle(collision).marginTop) || 0;
          collision.style.marginTop = px(current + imageRect.bottom - rect.top + twipsToPx(anchor.distB));
        }
        return;
      }
      exclusion ??= el("span", { class: "flt-exclusion", "aria-hidden": "true" });
      exclusion.style.display = "block";
      exclusion.style.width = px(w);
      exclusion.style.height = px(h + twipsToPx(anchor.distT + anchor.distB));
      exclusion.style.marginTop = px(Math.max(0, twipsToPx(anchor.posVOffset)));
      exclusion.style.marginLeft = px(twipsToPx(anchor.distL));
      exclusion.style.marginRight = px(twipsToPx(anchor.distR));
      exclusion.style.cssFloat = left + w / 2 < pageW / 2 ? "left" : "right";
      if (wrap.includes("tight") || wrap.includes("through")) {
        if (anchor.wrapPolygon?.length) {
          const maxX = Math.max(...anchor.wrapPolygon.map(p => p.x), 1);
          const maxY = Math.max(...anchor.wrapPolygon.map(p => p.y), 1);
          exclusion.style.shapeOutside = `polygon(${anchor.wrapPolygon.map(p =>
            `${(p.x / maxX * 100).toFixed(3)}% ${(p.y / maxY * 100).toFixed(3)}%`).join(",")})`;
        } else exclusion.style.shapeOutside = "inset(0)";
      }
      if (exclusion.parentElement !== owner) owner.prepend(exclusion);
    };
    const pageWithEvents = page as HTMLElement & { addEventListener?: HTMLElement["addEventListener"] };
    pageWithEvents.addEventListener?.("word-layout", syncToOwner as EventListener);
    requestAnimationFrame(syncToOwner);
  }
}

/** يعرض المستندَ كاملًا: <div class="doc"> فيه صفحةٌ لكلِّ مجموعة. */
const renderedAssetCleanup = new WeakMap<HTMLElement, () => void>();

/** Transfers ownership of blob-backed Word images to the caller. */
export function takeRenderedAssetCleanup(root: HTMLElement): (() => void) | undefined {
  const cleanup = renderedAssetCleanup.get(root);
  renderedAssetCleanup.delete(root);
  return cleanup;
}

export interface RenderDocumentOptions {
  /** التسلسل الكامل حين نرسم نافذة/صفحة مفردة منه. يمنع إعادة PAGE إلى 1. */
  fullPageGroups?: BodyParagraph[][];
  /** فهرس أول pageGroups داخل fullPageGroups، صفر الأساس. */
  physicalPageOffset?: number;
}

export function renderDocument(
  model: DocumentModelV0,
  pageGroups?: BodyParagraph[][],
  options: RenderDocumentOptions = {},
): HTMLElement {
  const ctx = newRenderCtx(model);
  const doc = el("div", { class: "doc", style: css(["direction:rtl"]) });

  // الخطوط المضمّنة (FontFace) — المتصفح فقط
  void registerEmbeddedFonts(model);

  const pages = pageGroups ?? groupPages(model);
  const fullPages = options.fullPageGroups ?? pages;
  const physicalOffset = Math.max(0, options.physicalPageOffset ?? 0);
  renumberNoteRefsForPages(model, pages);
  const pagesPerSection = pageCountsBySection(fullPages, model.sections.length - 1);
  const pageInSection = new Map<number, number>();
  for (let index = 0; index < physicalOffset; index++) {
    const secIdx = pageSectionIndex(fullPages, index, model.sections.length - 1);
    pageInSection.set(secIdx, (pageInSection.get(secIdx) ?? 0) + 1);
  }
  const pageNumbers = documentPageNumbers(model, fullPages);
  const precedingStyleText = new Map<string, string>();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageParas = pages[pageIndex]!;
    const physicalPageIndex = physicalOffset + pageIndex;
    const secIdx = pageSectionIndex(fullPages, physicalPageIndex, model.sections.length - 1);
    const section = model.sections[secIdx] ?? model.section;
    const idx = pageInSection.get(secIdx) ?? 0;
    pageInSection.set(secIdx, idx + 1);
    const documentPageNumber = pageNumbers[physicalPageIndex]!;
    const displayedPageNumber = formatPageNumberValue(section, documentPageNumber);
    // في الرأس يبحث STYLEREF أولًا في الصفحة الحالية من أعلاها، ثم إلى الخلف.
    const styleRefs = styleRefValuesForPage(pageParas, precedingStyleText);
    const isLast = physicalPageIndex === fullPages.length - 1;
    const nextSection = physicalPageIndex + 1 < fullPages.length
      ? pageSectionIndex(fullPages, physicalPageIndex + 1, model.sections.length - 1) : undefined;
    const sectionEnds = nextSection == null || nextSection !== secIdx;
    const endPos = notePositionForPage(model, section, "endnote");
    const endnoteScope = (endPos === "sectEnd" && sectionEnds)
      ? model.paragraphs.filter(p => p.sectionIndex === secIdx)
      : (endPos !== "sectEnd" && isLast ? model.paragraphs : null);
    doc.appendChild(buildPageElement(model, section, pageParas, idx, ctx, endnoteScope,
      displayedPageNumber, fullPages.length, pagesPerSection.get(secIdx) ?? 1,
      documentPageNumber, styleRefs));
    for (const p of pageParas) if (p.styleId && p.text) precedingStyleText.set(p.styleId, p.text);
  }
  let disposed = false;
  renderedAssetCleanup.set(doc, () => { if (!disposed) { disposed = true; ctx.imageCache.dispose(); } });
  return doc;
}

// إعادة تصدير للاختبارات
export { twipsToPx as _twipsToPx };
export { px as _px };
