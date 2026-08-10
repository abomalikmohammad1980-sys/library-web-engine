/** ‏SectPr — هندسةُ الصفحة (من `SectPr.dart`/`WordPageScreen.dart`): CSS الصفحة
 *  من w:pgSz/w:pgMar، واختيار الترويسة/التذييل (default/even/first) لكلِّ صفحةٍ
 *  في المقطع، وحلُّ اسم الجزء من rId عبر علاقات المستند. */

import type { BodyParagraph, BorderSide, DocumentModelV0, SectionGeometry } from "@engine/ooxml-model";
import { css, el, px } from "./dom.js";
import { twipsToPx } from "./units.js";
import { renderPageBlocks } from "./ParagraphTable.js";
import { paragraphToElement, type RenderCtx } from "./Paragraph.js";
import { wordBorderData, wordBorderStyle } from "./BorderCss.js";

/** اسمُ الجزء ("header1.xml"…) من rId بعد إزالة بادئة "word/". */
export function partNameFromRid(model: DocumentModelV0, rId: string | null): string | null {
  if (!rId) return null;
  // Newer model revisions resolve section references eagerly to the actual
  // package part. Keep accepting relationship ids for serialized/legacy
  // models so DOM and scene share one contract during migration.
  const target = model.relTargets?.get(rId) ?? rId;
  return target.replace(/^\.\.\//, "").replace(/^word\//, "").replace(/^media\//, "");
}

/** نوعُ الترويسة/التذييل لصفحةٍ (فهرس 0-أساس داخل المقطع): first/even/default. */
export function headerFooterType(
  model: DocumentModelV0,
  section: SectionGeometry,
  pageIdxInSection: number,
  pageNumber = (section.pgNumStart ?? 1) + pageIdxInSection,
): "first" | "even" | "default" {
  if (section.titlePg && pageIdxInSection === 0) return "first";
  if (model.evenAndOddHeaders && pageNumber % 2 === 0) return "even";
  return "default";
}

/** اسمُ جزء الترويسة/التذييل للصفحة، أو null إن لا مرجع (أو مرجع بلا جزء). */
export function headerFooterPartName(
  model: DocumentModelV0,
  section: SectionGeometry,
  pageIdxInSection: number,
  kind: "header" | "footer",
  pageNumber?: number,
): string | null {
  const refs = kind === "header" ? section.headerRefs : section.footerRefs;
  if (!refs) return null;
  const type = headerFooterType(model, section, pageIdxInSection, pageNumber);
  // Different First Page is strict: an absent first story means a blank first
  // header/footer.  Odd/even is different in Word: an absent even story falls
  // back to default (unless inheritance already supplied one).
  const rId = type === "even" ? (refs.even ?? refs.default ?? null) : (refs[type] ?? null);
  return partNameFromRid(model, rId);
}

/** CSS حاوية الصفحة: أبعاد w:pgSz وهوامش w:pgMar (صندوق الحشو = مساحة المتن). */
export function pageCss(section: SectionGeometry): string {
  const t = twipsToPx(section.marTopTwips);
  const b = twipsToPx(section.marBottomTwips);
  const l = twipsToPx(section.marLeftTwips);
  const r = twipsToPx(section.marRightTwips);
  return css([
    `width:${px(twipsToPx(section.pageWTwips))}`,
    `min-height:${px(twipsToPx(section.pageHTwips))}`,
    `padding:${px(t)} ${px(r)} ${px(b)} ${px(l)}`,
    "box-sizing:border-box",
    "position:relative",
    "direction:rtl",
    // لا نقصُّ سطرًا إن اختلف قياسُ خط المتصفح قليلًا عن Word؛ حاويةُ القارئ
    // تمدّد الورقة إلى scrollHeight وتحافظ على المحتوى كاملًا داخل خلفيتها.
    "overflow:visible",
    "font-size:12pt",
  ]);
}

function pageBorderCss(side: BorderSide | null): string {
  if (!side || side.wTwips <= 0 || side.val === "none") return "none";
  return `${px(twipsToPx(side.wTwips))} ${wordBorderStyle(side.val)} #${side.color ?? "000000"}`;
}

/** إطار w:pgBorders كطبقة مستقلة كي لا يغيّر مساحة متن الصفحة. */
export function pageBorderElement(section: SectionGeometry, pageIdxInSection = 0): HTMLElement | null {
  const borders = section.pageBorders;
  if (!borders) return null;
  if (section.pageBorderDisplay === "firstPage" && pageIdxInSection !== 0) return null;
  if (section.pageBorderDisplay === "notFirstPage" && pageIdxInSection === 0) return null;
  const spaces = [borders.top, borders.right, borders.bottom, borders.left]
    .map((s) => s?.spaceTwips ?? 0);
  const textBase = section.pageBorderOffsetFrom === "text"
    ? [section.marTopTwips, section.marRightTwips, section.marBottomTwips, section.marLeftTwips]
    : [0, 0, 0, 0];
  const inset = spaces.map((space, i) => space + textBase[i]!);
  const frame = el("div", {
    class: "page-border",
    "data-word-border-top": wordBorderData(borders.top?.val),
    "data-word-border-right": wordBorderData(borders.right?.val),
    "data-word-border-bottom": wordBorderData(borders.bottom?.val),
    "data-word-border-left": wordBorderData(borders.left?.val),
    style: css([
      "position:absolute", `top:${px(twipsToPx(inset[0]!))}`,
      `right:${px(twipsToPx(inset[1]!))}`, `bottom:${px(twipsToPx(inset[2]!))}`,
      `left:${px(twipsToPx(inset[3]!))}`, "pointer-events:none",
      `z-index:${section.pageBorderZOrder === "back" ? 0 : 7}`, "box-sizing:border-box",
      `border-top:${pageBorderCss(borders.top)}`, `border-right:${pageBorderCss(borders.right)}`,
      `border-bottom:${pageBorderCss(borders.bottom)}`, `border-left:${pageBorderCss(borders.left)}`,
    ]),
  });
  if ([borders.top, borders.right, borders.bottom, borders.left]
      .every(side => side?.val === "twistedLines1")) {
    frame.dataset.wordArtBorder = "twistedLines1";
    const band = Math.max(2, twipsToPx(borders.top?.wTwips ?? 35) * 1.5);
    frame.style.border = `${px(band)} solid #000080`;
    frame.style.outline = "1px solid #000";
    frame.style.boxShadow = `inset 0 0 0 ${px(band + 2)} #fff,inset 0 0 0 ${px(band + 3)} #000,0 0 0 ${px(band + 2)} #fff,0 0 0 ${px(band + 3)} #000`;
    for (const corner of ["tl", "tr", "bl", "br"]) frame.appendChild(el("span", {
      class: `page-border-knot page-border-knot--${corner}`,
      style: css(["position:absolute", `width:${px(band * 3.2)}`, `height:${px(band * 3.2)}`,
        "border:1px solid #000", "box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px #000",
        corner.includes("t") ? `top:${px(-band * 1.6)}` : `bottom:${px(-band * 1.6)}`,
        corner.includes("l") ? `left:${px(-band * 1.6)}` : `right:${px(-band * 1.6)}`]),
    }));
  }
  return frame;
}

/** قيمة حقل PAGE كما يحسبها Word داخل المقطع (مع احترام w:pgNumType@start). */
export function pageNumberText(section: SectionGeometry, pageIdxInSection: number): string {
  const n = (section.pgNumStart ?? 1) + pageIdxInSection;
  return formatPageNumberValue(section, n);
}

/** يصوغ رقمًا محسوبًا على مستوى المستند بصيغة المقطع الحالي. */
export function formatPageNumberValue(section: SectionGeometry, n: number): string {
  const roman = (value: number) => {
    const pairs: [number, string][] = [[1000,"M"],[900,"CM"],[500,"D"],[400,"CD"],[100,"C"],[90,"XC"],[50,"L"],[40,"XL"],[10,"X"],[9,"IX"],[5,"V"],[4,"IV"],[1,"I"]];
    let left = value, out = "";
    for (const [amount, glyph] of pairs) while (left >= amount) { out += glyph; left -= amount; }
    return out;
  };
  const fmt = section.pgNumFmt ?? "decimal";
  if (fmt === "upperRoman") return roman(n);
  if (fmt === "lowerRoman") return roman(n).toLowerCase();
  if (fmt === "upperLetter" || fmt === "lowerLetter") {
    let value = n, out = "";
    while (value > 0) { value--; out = String.fromCharCode(65 + value % 26) + out; value = Math.floor(value / 26); }
    return fmt === "lowerLetter" ? out.toLowerCase() : out;
  }
  if (fmt === "hindiNumbers" || fmt === "hindiCounting")
    return String(n).replace(/\d/g, d => "٠١٢٣٤٥٦٧٨٩"[Number(d)]!);
  if (fmt === "thaiNumbers")
    return String(n).replace(/\d/g, d => "๐๑๒๓๔๕๖๗๘๙"[Number(d)]!);
  return String(n);
}

/** موضع framePr داخل قصة الرأس/التذييل. القيم العددية twips؛ وغياب العرض
 * يعني امتداد الإطار في عرض قصة النص كما يفعل Word في فوترات corpus. */
export function framePrCss(frame: NonNullable<BodyParagraph["framePr"]>): string {
  const out = ["position:absolute", `top:${px(twipsToPx(frame.y ?? 0))}`];
  if (frame.xAlign === "center") out.push("left:50%", "transform:translateX(-50%)");
  else if (frame.xAlign === "right" || frame.xAlign === "outside") out.push("right:0");
  else out.push(`left:${px(twipsToPx(frame.x ?? 0))}`);
  if (frame.w != null && frame.w > 0) out.push(`width:${px(twipsToPx(frame.w))}`);
  // A single text frame with no w:w is auto-sized by Word.  Stretching it to
  // the story width reverses the visible side of an RTL PAGE frame (Ibhaj:
  // the number belongs at the physical left, while the anchor paragraph stays
  // at the right).  Adjacent shared frames still get their authored width or
  // their content width, rather than inventing a full-width frame.
  else out.push("width:max-content", "max-width:100%");
  if (frame.h != null && frame.h > 0) out.push(`min-height:${px(twipsToPx(frame.h))}`);
  if (frame.hSpace) out.push(`padding-inline:${px(twipsToPx(frame.hSpace))}`);
  if (frame.vSpace) out.push(`padding-block:${px(twipsToPx(frame.vSpace))}`);
  return css(out);
}

/** فقرات framePr المتجاورة ذات التوقيع نفسه إطار واحد فوق فقرة الارتكاز
 * التالية؛ لا يجوز رصفها كسطرين يدفع أحدهما الآخر في قصة الرأس/التذييل. */
export function renderHeaderFooterBlocks(
  paragraphs: BodyParagraph[], section: SectionGeometry, ctx: RenderCtx,
): HTMLElement[] {
  const out: HTMLElement[] = [];
  let i = 0;
  while (i < paragraphs.length) {
    const frame = paragraphs[i]!.framePr;
    if (!frame) {
      const plain: BodyParagraph[] = [];
      while (i < paragraphs.length && !paragraphs[i]!.framePr) plain.push(paragraphs[i++]!);
      out.push(...renderPageBlocks(plain, section, ctx));
      continue;
    }
    const framed: BodyParagraph[] = [];
    while (i < paragraphs.length && paragraphs[i]!.framePr?.signature === frame.signature)
      framed.push(paragraphs[i++]!);
    const anchor = i < paragraphs.length && !paragraphs[i]!.framePr ? paragraphs[i++]! : null;
    const stack = el("div", { class: "word-frame-stack", style: "position:relative" });
    if (anchor) for (const node of renderPageBlocks([anchor], section, ctx)) stack.appendChild(node);
    const box = el("div", { class: "word-frame", "data-word-frame-anchor": `${frame.hAnchor}:${frame.vAnchor}`,
      style: framePrCss(frame) });
    for (const paragraph of framed) {
      const node = paragraphToElement(paragraph, ctx);
      if (node) box.appendChild(node);
    }
    stack.appendChild(box);
    out.push(stack);
  }
  return out;
}

/** عنصر الترويسة/التذييل للصفحة — يُموضع داخل حاشية الصفحة (margin box). */
export function headerFooterElement(
  model: DocumentModelV0,
  section: SectionGeometry,
  pageIdxInSection: number,
  kind: "header" | "footer",
  ctx: RenderCtx,
  pageNumberOverride?: string,
  totalPagesOverride?: number,
  sectionPagesOverride?: number,
  pageNumberValue?: number,
  styleRefs: ReadonlyMap<string, string> = new Map(),
): HTMLElement | null {
  const part = headerFooterPartName(model, section, pageIdxInSection, kind, pageNumberValue);
  if (!part) return null;
  const paras = model.headerFooters.get(part);
  if (!paras?.length) return null;

  const pageNumber = pageNumberOverride ?? pageNumberText(section, pageIdxInSection);
  const totalPages = String(totalPagesOverride ?? Math.max(1, model.paragraphs.reduce((count, p) =>
    count + (p.pageBreaksBefore ?? (p.pageBreakBefore ? 1 : 0)), 1)));
  const sectionPages = String(sectionPagesOverride ?? totalPages);
  const replaceFields = (value: string) => value
    .replace(/\bSECTIONPAGES\b/g, sectionPages)
    .replace(/\bNUMPAGES\b/g, totalPages)
    .replace(/\bPAGE\b/g, pageNumber)
    .replace(/STYLEREF:([^\s]+)/g, (_all, id: string) => styleRefs.get(id) ?? "");
  const displayParas = paras.map((paragraph) => ({
    ...paragraph,
    text: replaceFields(paragraph.text),
    runs: paragraph.runs.map((run) => ({
      ...run,
      text: replaceFields(run.text),
      ...(run.fieldResult != null
        ? { fieldResult: run.fieldResult === "PAGE" ? pageNumber
          : run.fieldResult === "NUMPAGES" ? totalPages
          : run.fieldResult === "SECTIONPAGES" ? sectionPages
          : replaceFields(run.fieldResult) }
        : {}),
    })),
  }));

  const distTwips = kind === "header" ? section.headerDistTwips ?? 720 : section.footerDistTwips ?? 720;
  // موضع absolute داخل `.page` يبدأ من حافة مساحة المتن لأن الصفحة تحمل
  // الهوامش كـpadding.  أما header/footer distance ففي Word فمن حافة الورقة؛
  // لذا نلغي padding الموافق (وينطبق الأمر نفسه على right/bottom).
  const offsetPx = twipsToPx(distTwips);
  const pos = kind === "header"
    ? `top:${px(offsetPx - twipsToPx(section.marTopTwips))}`
    : `bottom:${px(offsetPx - twipsToPx(section.marBottomTwips))}`;

  const holder = el(kind === "header" ? "header" : "footer", {
    class: "page-" + (kind === "header" ? "header" : "footer"),
    style: css([
      "position:absolute",
      "left:0",
      "right:0",
      pos,
      "direction:rtl",
      // قصة الرأس/التذييل خلف قصة المتن؛ تبقى مرئية في منطقة الهامش الشفافة.
      "z-index:1",
    ]),
  });
  for (const node of renderHeaderFooterBlocks(displayParas, section, ctx)) holder.appendChild(node);
  return holder;
}
