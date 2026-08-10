/** ‏Paragraph — تحويل BodyParagraph إلى عنصر DOM (ترجمة مفهومية من `Paragraph.dart`):
 *  علامة الترقيم (خارج النص)، صفوف TOC الثلاثية، مقاطع w:ptab المطلقة،
 *  الرنّات المتتالية، والصور السطرية. */

import type { BodyParagraph, DocumentModelV0, EffectiveRun } from "@engine/ooxml-model";
import { css, el, px } from "./dom.js";
import { twipsToPx } from "./units.js";
import { paragraphCss, wordJustification } from "./PPr.js";
import { runCss, runToNode } from "./runT.js";
import { inlineAnchors, ImageCache } from "./ImageToWidget.js";
import { NumberingState } from "./abstractNum.js";
import { cssFamily } from "./fonts.js";

/** سياقُ الرسم المشترك عبر الصفحة — يتشارك عدّاد الترقيم وكاش الصور. */
export interface RenderCtx {
  model: DocumentModelV0;
  imageCache: ImageCache;
  numbering: NumberingState;
}

export function newRenderCtx(model: DocumentModelV0): RenderCtx {
  return { model, imageCache: new ImageCache(), numbering: new NumberingState() };
}

/** هل الفقرة تُرسم كمقاطع موضّعة (w:ptab)؟ */
export function hasPositionalTabs(p: BodyParagraph): boolean {
  return p.ptabAt.length > 0;
}

/** CSS خط علامة القائمة؛ منفصل لاختبار عدم سقوط Wingdings/Symbol. */
export function numberMarkerFontCss(p: BodyParagraph): string | null {
  return p.markAsciiFamily ? `font-family:${cssFamily(p.markAsciiFamily)}` : null;
}

export function numberMarkerLookCss(p: BodyParagraph, model: DocumentModelV0): string {
  const level = p.numId ? model.numbering.get(`${p.numId}/${p.ilvl ?? "0"}`) : undefined;
  return css([
    level?.markerBold ? "font-weight:700" : false,
    level?.markerUnderline && level.markerUnderline !== "none" ? "text-decoration-line:underline" : false,
    level?.markerColor ? `color:#${level.markerColor}` : false,
  ]);
}

export function paragraphOutlineAttrs(p: BodyParagraph): Record<string, string> {
  const level = p.outlineLevel;
  return level != null && level >= 0 && level <= 8
    ? { role: "heading", "aria-level": String(level + 1), "data-outline-level": String(level) }
    : {};
}

/** يقسّم الفقرة عند مواضع w:ptab ويعيد شرائح + موضعَ كلِّ شريحة.
 *  النصُّ قبل أول ptab يبقى في «start»، وكلُّ نصٍّ بعد ptab يتبع محاذاةَ
 *  آخر ptab سبقه (§17.3.3.23 — القاعدة 10.1). */
function ptabSegments(p: BodyParagraph): { alignment: string; nodes: Node[] }[] {
  const segments: { alignment: string; nodes: Node[] }[] = [];
  let active = "start";
  let nodes: Node[] = [];
  let pos = 0;
  let ti = 0;

  const pushText = (text: string, run: EffectiveRun): void => {
    nodes.push(el("span", { style: runCss(run) }, text));
  };

  for (const run of p.runs) {
    if (run.hidden) continue;
    const text = run.fieldResult ?? run.text;
    if (text.length === 0) continue;
    let cursor = 0;
    for (;;) {
      const next = ti < p.ptabAt.length ? p.ptabAt[ti]!.at : -1;
      if (next < 0 || next > pos + text.length) break;
      const splitAt = next - pos;
      const seg = text.slice(cursor, splitAt);
      if (seg) pushText(seg, run);
      segments.push({ alignment: active, nodes });
      nodes = [];
      active = p.ptabAt[ti]!.alignment ?? "left";
      cursor = splitAt;
      ti++;
    }
    const tail = text.slice(cursor);
    if (tail) pushText(tail, run);
    pos += text.length;
  }
  if (nodes.length) segments.push({ alignment: active, nodes });
  return segments;
}

/** صفُّ فهرس (TOC): مدخلٌ / قائدٌ يتمدّد / رقمُ صفحة — في اتجاه الفقرة. */
function sectionForParagraph(p: BodyParagraph, ctx: RenderCtx) {
  return ctx.model.sections?.[p.sectionIndex] ?? ctx.model.section;
}

export function tocRowElement(p: BodyParagraph, ctx: RenderCtx): HTMLElement {
  const style = paragraphCss(p, sectionForParagraph(p, ctx));
  const toc = p.toc!;
  const rawHref = p.runs.find(run => run.href)?.href ?? null;
  const external = rawHref ? /^[a-z]+:/i.test(rawHref) : false;
  const href = rawHref ? (external ? rawHref : "#") : null;
  const row = el(href ? "a" : "div", {
    class: "p toc-row",
    ...paragraphOutlineAttrs(p),
    ...(href ? { href, target: /^https?:/i.test(href) ? "_blank" : undefined,
      ...(!external && rawHref ? { "data-word-bookmark": rawHref } : {}) } : {}),
    style: css([style, "display:flex", "align-items:baseline", "white-space:nowrap"]),
  });
  row.dataset.idx = String(p.index);
  if (p.bookmarkIds?.length) row.id = p.bookmarkIds[0]!;
  if (rawHref && !external && typeof row.addEventListener === "function") row.addEventListener("click", (event) => {
    event.preventDefault(); event.stopPropagation();
    const root = row.closest(".doc") ?? document;
    const target = Array.from(root.querySelectorAll<HTMLElement>("[id]"))
      .find(node => node.id === rawHref);
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
    target?.focus({ preventScroll: true });
  });
  row.appendChild(el("span", { class: "toc-entry" }, toc.entry));
  row.appendChild(el("span", {
    class: "toc-leader",
    style: "flex:1 1 auto;border-bottom:1px dotted #000;margin-inline:6px",
  }));
  row.appendChild(el("span", { class: "toc-page" }, toc.pageNum));
  return row;
}

/** فقرة w:ptab ⟵ ثلاثة أقسامٍ مرنة (يمين/وسط/يسار) حسب المحاذاة. */
export function ptabParagraphElement(p: BodyParagraph, ctx: RenderCtx): HTMLElement {
  const style = paragraphCss(p, sectionForParagraph(p, ctx));
  const div = el("div", { class: "p ptab", ...paragraphOutlineAttrs(p), style: css([style, "display:flex", "align-items:baseline"]) });

  const zones: Record<string, Node[]> = { start: [], center: [], left: [], right: [] };
  for (const seg of ptabSegments(p)) {
    const zone = seg.alignment === "start" || seg.alignment === "end"
      ? (p.bidi ? (seg.alignment === "start" ? "right" : "left") : seg.alignment)
      : seg.alignment;
    (zones[zone] ?? zones.start!).push(...seg.nodes);
  }

  const order = p.bidi ? ["right", "center", "left"] : ["left", "center", "right"];
  for (const z of order) {
    const justify = z === "left" ? "flex-start" : z === "center" ? "center" : "flex-end";
    div.appendChild(el("span", {
      class: `ptab-zone ptab-${z}`,
      style: css(["flex:1 1 0%", "display:inline-flex", "align-items:baseline", `justify-content:${justify}`]),
    }, zones[z] ?? []));
  }
  return div;
}

/** يبني عنصر الفقرة كاملًا — أو null للفقرات التي لا تُرسم. */
export function paragraphToElement(p: BodyParagraph, ctx: RenderCtx): HTMLElement | null {
  if (p.toc) return tocRowElement(p, ctx);

  const style = paragraphCss(p, sectionForParagraph(p, ctx));
  if (hasPositionalTabs(p)) {
    const div = ptabParagraphElement(p, ctx);
    // المراسي paragraph-relative تبحث عن الفقرة المالكة بواسطة data-idx بعد
    // تركيب الصفحة. كان مسار ptab المبكر يفقد هذه الهوية، فتظل زخارف الفقرات
    // ذات التبويب مخفية إلى الأبد (وهي حالة متكررة في «زهر الخمائل»).
    div.dataset.idx = String(p.index);
    if (p.tableCell) div.dataset.cell = `${p.tableCell.tableId}:${p.tableCell.row}:${p.tableCell.col}`;
    return div;
  }

  const justification = wordJustification(p.jc);
  const div = el("div", {
    class: "p", style,
    ...paragraphOutlineAttrs(p),
    ...(justification !== "none" ? { "data-word-justify": justification } : {}),
  });
  div.dataset.idx = String(p.index);
  if (p.bookmarkIds?.length) {
    div.id = p.bookmarkIds[0]!;
    for (const bookmark of p.bookmarkIds.slice(1))
      div.appendChild(el("span", { id: bookmark, class: "bookmark-target", "aria-hidden": "true" }));
  }
  if (p.tableCell) div.dataset.cell = `${p.tableCell.tableId}:${p.tableCell.row}:${p.tableCell.col}`;

  // علامة الترقيم: تُرسم خارج النص وتحجز عرض التعليق
  if (p.numbered && p.numId && p.numId !== "0") {
    const marker = ctx.numbering.markerFor(p, ctx.model);
    const hanging = p.indFirstLine < 0 ? -p.indFirstLine : 0;
    const markerAlign = ctx.model.numbering.get(`${p.numId}/${p.ilvl ?? "0"}`)?.jc ?? "start";
    if (marker) {
      div.appendChild(el("span", {
        class: "num-marker",
        style: css([
          "display:inline-block",
          numberMarkerFontCss(p) ?? false,
          numberMarkerLookCss(p, ctx.model),
          `min-width:${px(twipsToPx(hanging))}`,
          `text-align:${markerAlign === "center" ? "center" : markerAlign === "left" ? "left" : markerAlign === "right" ? "right" : "start"}`,
          "white-space:nowrap",
          "padding-inline-end:" + (hanging ? "4px" : "8px"),
        ]),
      }, marker));
    }
  }

  // الرنّات
  for (const run of p.runs) {
    if (run.hidden) continue;
    const node = runToNode(run);
    if (node) div.appendChild(node);
  }

  // الصور السطرية
  for (const img of inlineAnchors(p, ctx)) div.appendChild(img);

  // A textless paragraph can still be the coordinate origin of a floating
  // DrawingML shape.  Dropping its DOM box makes a paragraph-relative anchor
  // impossible to resolve (common in decorative corpus documents).
  const ownsParagraphAnchor = p.anchors.some(anchor => anchor.posVRel === "paragraph");
  if (div.children.length === 0 && !p.shd && !p.pBdr && !ownsParagraphAnchor) {
    // فقرة فارغة: سطرٌ فارغ بارتفاع سطر
    div.appendChild(el("span", { style: "display:inline-block;min-width:1px;height:1em" }));
  }
  return div;
}
