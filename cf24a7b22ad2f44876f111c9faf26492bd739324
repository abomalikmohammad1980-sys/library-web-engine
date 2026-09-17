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
export function fillPageWithCover(node: HTMLElement, section: SectionGeometry): void {
  // The positioned child lives in the page's padded containing block.  Word's
  // page coordinates start at the physical sheet edge, so x/y=0 must cancel
  // the page padding instead of starting at the text margin.
  node.style.left = px(-twipsToPx(section.marLeftTwips ?? 0));
  node.style.top = px(-twipsToPx(section.marTopTwips ?? 0));
  node.style.width = px(twipsToPx(section.pageWTwips));
  node.style.height = px(twipsToPx(section.pageHTwips));
  // الغلاف الخالص في Word يمتد إلى حدود الورقة. كانت صورة DrawingML غير
  // المعلّمة stretch ترث object-fit:contain فتظهر شرائط بيضاء جانبية.
  node.style.objectFit = "fill";
  const image = typeof node.querySelector === "function" ? node.querySelector<HTMLImageElement>("img") : null;
  if (image) image.style.objectFit = "fill";
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
  while (stack.length) {
    const current = stack.pop()!;
    if (current.nodeType === 3 && current.nodeValue)
      current.nodeValue = replacePageFieldText(current.nodeValue, page, total, sectionTotal)
        .replace(/STYLEREF:([^\s]+)/g, (_all, id: string) => styleRefs.get(id) ?? "");
    for (const child of Array.from(current.childNodes ?? [])) stack.push(child);
  }
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
  if (physicalPageIndex === 0) return section.pgNumStart ?? 1;
  if (pageIndexInSection === 0 && section.pgNumStart != null) return section.pgNumStart;
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
  const noteParas = endnoteParas ? [...pageParas, ...endnoteParas] : pageParas;
  for (const p of noteParas) {
    for (const r of p.runs) {
      const n = r.noteRef;
      if (!n || !n.id) continue;
      const noteKey = `${n.kind}:${n.id}`;
      if (seen.has(noteKey)) continue;
      if (n.kind === "endnote" && !endnoteParas) continue;
      if (n.kind === "footnote" && !pageParas.includes(p)) continue;
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
    const entry = el("div", { class: "fn-entry", style: css([
      "display:grid", "grid-template-columns:auto minmax(0,1fr)", "direction:rtl", "align-items:start", "column-gap:5px",
    ]) });
    if (noteBodyNeedsMarker(paras, e.customMark)) {
      entry.appendChild(el("sup", {
        class: "fn-num",
        style: "font-size:0.72em;line-height:1;min-width:1.2em;text-align:start;direction:rtl;unicode-bidi:isolate",
      }, e.customMark ?? formatNumber(e.fmt, e.num)));
    } else {
      // Keep the two-column structure while the literal custom mark remains
      // part of the authored note text.
      entry.appendChild(el("span", { class: "fn-num fn-num-authored", "aria-hidden": "true" }));
    }
    const body = el("div", { class: "fn-body", style: css(["font-size:10pt", "text-align:justify"]) });
    // A note is a block container in Word, not a flat paragraph list.  In
    // particular, tables inside footnotes carry row/cell geometry and
    // cantSplit semantics that paragraphToElement alone cannot preserve.
    for (const node of renderPageBlocks(paras, section, ctx)) body.appendChild(node);
    entry.appendChild(body);
    wrap.appendChild(entry);
  }
  return wrap;
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
        .filter(item => !item.anchor.inlineFlow && item.anchor.behindDoc === behind)
        .sort((a, b) => (a.anchor.zOrder ?? 0) - (b.anchor.zOrder ?? 0));
      for (const { anchor, paragraphIndex } of anchors) {
        const node = anchorToElement(anchor, ctx);
        if (!node) continue;
        materialize(node);
        positionFloatingAnchor(node, anchor, paragraphIndex, section, page, kind);
        // قصة الرأس/التذييل بكاملها خلف قصة المتن في Word. relativeHeight يرتب
        // العناصر داخل القصة فقط، ولا يحق له رفع صندوق رأس فوق غلاف المتن.
        node.style.zIndex = behind ? "0" : "1";
        node.style.pointerEvents = "none";
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
      .filter(item => !item.anchor.inlineFlow && item.anchor.behindDoc === behind)
      .sort((a, b) => (a.anchor.zOrder ?? 0) - (b.anchor.zOrder ?? 0));
      for (const { anchor, paragraphIndex } of anchors) {
        const node = anchorToElement(anchor, ctx);
        if (!node) continue;
        materialize(node);
        positionFloatingAnchor(node, anchor, paragraphIndex, section, page);
        if (anchor === coverAnchor) fillPageWithCover(node, section);
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
  const fn = footnotesBlock(model, pageParas, ctx, endnoteParas);
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
    const freshBody = body.getBoundingClientRect();
    const oldBottom = Number(body.dataset.wordFooterClearance ?? 0);
    const measuredBottom = storyClearancePx(freshBody.bottom, footerTop, scale);
    // لا ننقص الخلوص في الدورة التالية بعد أن أدى تمدد الورقة إلى تحريك التذييل؛
    // وإلا تتذبذب الصفحة بين ارتفاعين مع ResizeObserver.
    const footerBand = twipsToPx(Math.max(240,
      section.marBottomTwips - (section.footerDistTwips ?? 720)));
    const nextBottom = Math.min(footerBand, Math.max(oldBottom, measuredBottom));
    body.dataset.wordFooterClearance = String(nextBottom);
    body.style.marginBottom = px(nextBottom);
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
  // `.page` stores Word margins as CSS padding.  Absolute offsets are relative
  // to that padded containing block, whereas OOXML offsets above are physical
  // page coordinates.  Translate once here for every page/margin/column
  // anchor; the reference-origin calculation above remains unchanged.
  node.style.left = px(left - marginX);
  node.style.top = px(top - marginY);
  if (anchor.relWidth?.pct && anchor.relWidth.pct > 0) node.style.width = px(w);
  if (anchor.relHeight?.pct && anchor.relHeight.pct > 0) node.style.height = px(h);

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

export function renderDocument(model: DocumentModelV0, pageGroups?: BodyParagraph[][]): HTMLElement {
  const ctx = newRenderCtx(model);
  const doc = el("div", { class: "doc", style: css(["direction:rtl"]) });

  // الخطوط المضمّنة (FontFace) — المتصفح فقط
  void registerEmbeddedFonts(model);

  const pages = pageGroups ?? groupPages(model);
  renumberNoteRefsForPages(model, pages);
  const pagesPerSection = pageCountsBySection(pages, model.sections.length - 1);
  const pageInSection = new Map<number, number>();
  const pageNumbers = documentPageNumbers(model, pages);
  const precedingStyleText = new Map<string, string>();
  for (let pageIndex = 0; pageIndex < pages.length; pageIndex++) {
    const pageParas = pages[pageIndex]!;
    const secIdx = pageSectionIndex(pages, pageIndex, model.sections.length - 1);
    const section = model.sections[secIdx] ?? model.section;
    const idx = pageInSection.get(secIdx) ?? 0;
    pageInSection.set(secIdx, idx + 1);
    const documentPageNumber = pageNumbers[pageIndex]!;
    const displayedPageNumber = formatPageNumberValue(section, documentPageNumber);
    // في الرأس يبحث STYLEREF أولًا في الصفحة الحالية من أعلاها، ثم إلى الخلف.
    const styleRefs = styleRefValuesForPage(pageParas, precedingStyleText);
    const isLast = pageIndex === pages.length - 1;
    const nextSection = pageIndex + 1 < pages.length
      ? pageSectionIndex(pages, pageIndex + 1, model.sections.length - 1) : undefined;
    const sectionEnds = nextSection == null || nextSection !== secIdx;
    const endPos = notePositionForPage(model, section, "endnote");
    const endnoteScope = (endPos === "sectEnd" && sectionEnds)
      ? model.paragraphs.filter(p => p.sectionIndex === secIdx)
      : (endPos !== "sectEnd" && isLast ? model.paragraphs : null);
    doc.appendChild(buildPageElement(model, section, pageParas, idx, ctx, endnoteScope,
      displayedPageNumber, pages.length, pagesPerSection.get(secIdx) ?? 1,
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
