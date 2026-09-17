/** ‏PPr — خصائص الفقرة ⟵ CSS (ترجمة مفهومية من `PPr.dart`):
 *  الاتجاه، المحاذاة، المسافات (قبل/بعد)، ارتفاعات الأسطر (w:spacing line/lineRule)،
 *  البادئات (left/right/firstLine/hanging)، التظليل w:shd، الحدود w:pBdr. */

import type { BodyParagraph, BorderSide, Borders4, SectionGeometry, SpacingProps } from "@engine/ooxml-model";
import { css, px } from "./dom.js";
import { twipsToPx } from "./units.js";
import { wordBorderStyle } from "./BorderCss.js";
import {paragraphNaturalLineTwips} from './font-line-metrics.js';
import {cssFamily} from './fonts.js';

/** ‏w:jc ⟵ CSS text-align. القيم المطلقة (left/right/center/both) تبقى مطلقة؛
 *  والقيم المنطقية (start/end) تُفوَّض للاتجاه. */
export type WordJustification = "none" | "word" | "distribute" | "lowKashida" | "mediumKashida" | "highKashida";

/** يحفظ معنى w:jc بدل اختزال جميع أوضاع Word إلى justify واحد. */
export function wordJustification(jc: string | null): WordJustification {
  switch (jc) {
    case "both": return "word";
    case "distribute": case "thaiDistribute": return "distribute";
    case "lowKashida": return "lowKashida";
    case "mediumKashida": return "mediumKashida";
    case "highKashida": return "highKashida";
    default: return "none";
  }
}

function textAlign(jc: string | null): string {
  switch (jc) {
    case "center": return "center";
    case "both": case "distribute": case "thaiDistribute":
    case "mediumKashida": case "highKashida": return "justify";
    case "lowKashida": return "start";
    case "left": return "left";
    case "right": return "right";
    case "start": return "start";
    case "end": return "end";
    default: return "start";
  }
}

/** ‏w:spacing ⟵ خط الارتفاع. auto: القيمة مضاعفُ سطرٍ (240 = سطر مفرد)؛
 *  exact/atLeast: القيمة بالـtwips (ارتفاعٌ ثابت أو أدنى). */
function lineHeight(spacing: SpacingProps, p: BodyParagraph, section?: SectionGeometry): string | null {
  const line = spacing.line;
  if (line == null) return null;
  const rule = spacing.lineRule ?? "auto";
  if (rule === "exact") return `${px(twipsToPx(line))}`;
  const pitch = section?.docGridLinePitch ?? null;
  const gridLines = section?.docGridType === "lines" || section?.docGridType === "linesAndChars";
  if (p.snapToGrid !== false && gridLines && pitch && pitch > 0) {
    const largestRunEm = Math.max(p.markEmTwips ?? 0, ...p.runs.map((run) => run.emTwips ?? 0));
    const natural = largestRunEm > 0 ? largestRunEm * 1.2 : pitch;
    const requested = rule === "atLeast" ? Math.max(natural, line) : natural * line / 240;
    return `${px(twipsToPx(Math.ceil(requested / pitch) * pitch))}`;
  }
  if (rule === "atLeast") {
    // CSS has no `min-line-height`. Applying Word's minimum as an ordinary
    // line-height collapses large glyphs when the minimum is tiny (for
    // example 18 twips with a 320-twip font). Resolved runs carry their
    // effective font size, so keep natural font metrics unless the requested
    // minimum is genuinely larger.
    const largestRunEm = Math.max(0, ...p.runs.map((run) => run.emTwips ?? 0));
    const estimatedNatural = largestRunEm * 1.2;
    // If no run exposes resolved metrics (notably empty/decorative corpus
    // paragraphs), the browser's inherited font still supplies a natural
    // line box.  Emitting the tiny minimum as a fixed line-height is the one
    // result we know is wrong, so defer to that natural box as well.
    return largestRunEm === 0 || line <= estimatedNatural
      ? null
      : `${px(twipsToPx(line))}`;
  }
  // Word's `auto` value is a requested baseline multiplier, not permission to
  // clip glyph extents.  CSS `line-height:.8` constructs a line box smaller
  // than tall Arabic faces and makes adjacent rows paint through each other.
  // Browsers cannot express "requested multiplier, but at least the resolved
  // font metrics", so values below a natural line defer to the font's own box.
  const measuredNatural = paragraphNaturalLineTwips(p);
  if (measuredNatural !== null && line >= 240) return `${px(twipsToPx(measuredNatural * line / 240))}`;
  return line < 240 ? null : `${line / 240}`;
}

/** BorderSide ⟵ CSS حدٍّ واحد. اللون null (= auto) ⟵ لون النصّ (نُتركه). */
function borderSide(side: BorderSide | null, dfltColor: string | null): string | null {
  if (!side || side.wTwips <= 0) return null;
  const style = wordBorderStyle(side.val);
  const w = px(twipsToPx(side.wTwips));
  const color = side.color ?? dfltColor ?? "#000000";
  return `${w} ${style} #${color}`;
}

/** حدودُ الفقرة ⟵ border-* مع فراغٍ (w:space) يتحول padding. */
function borderCss(pBdr: Borders4 | null, textColor: string | null): string[] {
  if (!pBdr) return [];
  const out: string[] = [];
  const side = (nm: "top" | "bottom" | "left" | "right"): string | null =>
    borderSide(pBdr[nm], textColor);
  const t = side("top");
  if (t) {
    out.push(`border-top:${t}`);
    if (pBdr.top?.spaceTwips) out.push(`padding-top:${px(twipsToPx(pBdr.top.spaceTwips))}`);
  }
  const b = side("bottom");
  if (b) {
    out.push(`border-bottom:${b}`);
    if (pBdr.bottom?.spaceTwips) out.push(`padding-bottom:${px(twipsToPx(pBdr.bottom.spaceTwips))}`);
  }
  const l = side("left");
  if (l) {
    out.push(`border-left:${l}`);
    if (pBdr.left?.spaceTwips) out.push(`padding-left:${px(twipsToPx(pBdr.left.spaceTwips))}`);
  }
  const r = side("right");
  if (r) {
    out.push(`border-right:${r}`);
    if (pBdr.right?.spaceTwips) out.push(`padding-right:${px(twipsToPx(pBdr.right.spaceTwips))}`);
  }
  return out;
}

/** CSS الفقرة الكامل (بلا أبناء) — مُنفصلة للاختبار. */
export function paragraphCss(p: BodyParagraph, section?: SectionGeometry): string {
  const items: (string | false)[] = [];
  if (p.suppressAutoHyphens) items.push("hyphens:none");
  const justification = wordJustification(p.jc);
  items.push(`direction:${p.bidi ? "rtl" : "ltr"}`);
  items.push(`text-align:${textAlign(p.jc)}`);
  // both يوزع المسافات؛ distribute يوزع المحارف ويشمل السطر الأخير.
  // أوضاع الكشيدة لا تختزل إلى inter-word: تبقى موسومةً لوحدة التشكيل
  // العربية، بينما auto هو أفضل سقوط أصلي في المتصفح قبل تركيبها.
  // inter-word يمد الفراغات العربية بصورة قبيحة. في الفقرة RTL نترك
  // المشكّل العربي للمتصفح يوازن الحروف/الكشيدة طبيعيًا، مع بقاء اللاتيني
  // على سلوك Word المعتاد بين الكلمات.
  if (justification === "word") {
    items.push(p.bidi ? "text-justify:inter-character" : "text-justify:inter-word");
    // Word لا يمد السطر الأخير العادي لفقرة both. الاستثناء هو الفاصل
    // اليدوي Shift+Enter في نهاية الفقرة: السطر السابق له ليس خاتمة فقرة
    // ويظل مضبوطًا. CSS يعبّر عن هذا الاستثناء بـ text-align-last فقط حين
    // يحمل المصدر فعلًا w:br textWrapping في النهاية، لا لكل فقرة عربية.
    if (p.bidi && paragraphEndsWithManualLineBreak(p)) items.push("text-align-last:justify");
  }
  if (justification === "distribute") {
    items.push("text-justify:inter-character");
    items.push("text-align-last:justify");
  }
  if (justification.endsWith("Kashida")) {
    items.push("text-justify:inter-character");
    // A hemistich in a Word poetry table is normally a one-line paragraph.
    // CSS does not justify the final (and therefore only) line unless this is
    // explicit, which collapsed Word's low/medium/high-kashida alignment to a
    // ragged edge.  Keep the authored text untouched (no synthetic U+0640)
    // and let the browser's Arabic shaper perform its native justification.
    if (justification === "lowKashida" && p.tableCell) {
      // لا نستخدم justify لأنه يوسّع الفراغات. طبقة جدول الشعر تمدد رسم
      // الشطر كاملًا بلا إضافة محارف إلى النص القابل للنسخ.
      items.push("word-spacing:normal");
      items.push("text-align:start");
      items.push("text-align-last:start");
    }
    else if (justification === "lowKashida") {
      // lowKashida في النثر تعني ضبطًا عربيًا خفيفًا، لا محاذاة بداية.
      // الاستثناء المحافظ أعلاه خاص بأبيات الشعر داخل خلايا الجداول.
      items.push("text-align:justify");
      if (paragraphEndsWithManualLineBreak(p)) items.push("text-align-last:justify");
    }
    else if (paragraphEndsWithManualLineBreak(p)) items.push("text-align-last:justify");
  }

  // المسافات: margin-top/bottom مع طيِّ الهوامش يحقق «max(before, after)» بين فقرتين
  const sp = p.spacing;
  if (sp.before) items.push(`margin-top:${px(twipsToPx(sp.before))}`);
  if (sp.after) items.push(`margin-bottom:${px(twipsToPx(sp.after))}`);
  const lh = lineHeight(sp, p, section);
  if (lh) items.push(`line-height:${lh}`);
  if (!p.numbered && !p.runs.some(run => run.text && !run.hidden) && p.paragraphMark) {
    const mark = p.paragraphMark;
    if (mark.family) items.push(`font-family:${cssFamily(mark.family)}`);
    if (mark.emTwips) items.push(`font-size:${px(twipsToPx(mark.emTwips))}`);
    if (mark.bold) items.push('font-weight:700');
    if (mark.italic) items.push('font-style:italic');
  }

  // البادئات: left/right مادية (من حافة الصفحة)، text-indent تتبّع الاتجاه
  // CSS rejects negative padding. An outdent expands this paragraph, not its table.
  if (p.indLeft) items.push(`${p.indLeft < 0 ? 'margin' : 'padding'}-left:${px(twipsToPx(p.indLeft))}`);
  if (p.indRight) items.push(`${p.indRight < 0 ? 'margin' : 'padding'}-right:${px(twipsToPx(p.indRight))}`);
  if (p.indFirstLine) items.push(`text-indent:${px(twipsToPx(p.indFirstLine))}`);

  if (p.shd) items.push(`background-color:#${p.shd}`);

  // الحدود + تظليل علامة الفقرة (rPr علامة الفقرة لا نرسمه هنا)
  const textColor = p.runs.find((r) => r.color)?.color ?? null;
  items.push(...borderCss(p.pBdr ?? null, textColor));

  // الجداول: منعُ قصّ الصف عبر الصفحات
  if (p.tableCell?.cantSplit) items.push("break-inside:avoid");

  // التبويب: white-space يحفظ \t ويسمح بالالتفاف
  items.push("white-space:pre-wrap");
  // عرض الجدولة: أولُ توقّفٍ مخصّص أو افتراضيّ Word (720tw)
  const tabSize = p.tabStops[0]?.posTwips ?? 720;
  if (tabSize > 0) items.push(`tab-size:${px(twipsToPx(tabSize))}`);
  return css(items);
}

/** آخر محرف مرئي في قصة الفقرة ناتج من w:br غير الصفحي (Shift+Enter).
 * يحتفظ المستخرج به كـ\n داخل الرن؛ لا نخمّن من طول الفقرة أو كونها حاشية. */
export function paragraphEndsWithManualLineBreak(p: BodyParagraph): boolean {
  for (let index = p.runs.length - 1; index >= 0; index--) {
    const run = p.runs[index]!;
    if (run.hidden) continue;
    const text = run.fieldResult ?? run.text;
    if (!text) continue;
    return /\n$/u.test(text);
  }
  return false;
}
