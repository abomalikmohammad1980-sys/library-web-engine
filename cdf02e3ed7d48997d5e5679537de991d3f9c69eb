/**
 * هندسةُ رسمٍ خالصة (بلا DOM) — تُستخرج مواضعُ الغليفات والصناديق بالـpx
 * من السطر/الفقرة. تُستهلكها طبقةُ الرسم (canvas/pdf) **والتفاعل**
 * (hit-test/التحديد) فيما بعد — فتُبقي القياسَ موحَّدًا قابلاً للاختبار في Node.
 */

import type { SceneLine, SceneParagraph } from "@engine/scene";
import { TWIPS_PER_PX } from "./units.js";

/** صندوقُ غليفٍ واحد جاهزٌ للرسم (إحداثيات بالـpx؛ الإزاحات بوحدات الخط). */
export interface GlyphBox {
  fontIndex: number;
  glyphId: number;
  /** إحداثي رسم الغليف بالـpx (نقطة رسوّ خط الأساس أفقيًّا) */
  xPx: number;
  /** إحداثي خط الأساس بالـpx (رأسيًّا من أعلى الصفحة) */
  baselinePx: number;
  /** إزاحة الغليف بوحدات الخط — تُطبَّق بعد تحويل المقياس والقلب */
  xOffsetFont: number;
  yOffsetFont: number;
  /** وحداتُ الخط ⟵ px */
  sx: number;
  /** المقياس الرأسي مستقل عن w:w الأفقي. */
  sy: number;
  /** غليفٌ به صفر تقدمٍ أفقيّ (علامةُ تشكيل/حركة) */
  mark: boolean;
}

export interface WordBox {
  /** النص المنطقيّ للكلمة (للتشخيص والتفاعل) */
  text: string;
  fontIndex: number;
  minXPx: number;
  maxXPx: number;
  ascentPx: number;
  descentPx: number;
  /** صندوقُ كل الغليفات (المحرف + علاماته) — نفسَ مدى min/max */
  glyphs: GlyphBox[];
  color: string | null;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  underlineColor: string | null;
  strike: boolean;
  highlight: string | null;
}

export interface LineGeometry {
  words: WordBox[];
  /** مدى السطر بالـpx */
  minXPx: number;
  maxXPx: number;
}

/**
 * يحوّل سطرًا من المشهد إلى صناديق كلماتٍ وغليفاتٍ بالـpx.
 *
 * ترتيبُ الكلمات في `words` هو ترتيب التدفّق (من حافة البداية)، و«القلم»
 * يسير باتجاه الفقرة؛ الغليفاتُ داخل كل كلمة تُرصّ وفق اتجاهها الذاتيّ.
 */
export function lineWordGeometry(line: SceneLine, para: SceneParagraph): LineGeometry {
  const dirSign = para.dir === "rtl" ? -1 : 1;
  const scale = (sx: number) => sx; // وحدات الخط ⟵ px هي w.unitTwips/15
  const baselinePx = line.yTwips / TWIPS_PER_PX;
  const words: WordBox[] = [];
  let penPx = line.startTwips / TWIPS_PER_PX;
  let minX = Infinity, maxX = -Infinity;

  for (const w of line.words) {
    const wordBaselinePx = baselinePx - w.baselineShiftTwips / TWIPS_PER_PX;
    const sy = scale(w.unitTwips) / TWIPS_PER_PX;
    const sx = sy * (w.horizontalScale ?? 1);
    const wPx = w.advanceTwips / TWIPS_PER_PX;
    const spacePx = (w.spaceBeforeTwips * (line.shrinkFactor ?? 1)) / TWIPS_PER_PX;
    // المسافة ملكُ الكلمة الحالية وتُطوى قبل وضعها (بين الكلمة السابقة وهذه)
    penPx += dirSign * spacePx;
    const startPx = penPx;
    // صندوقُ الكلمة في اتجاه تدفّق الفقرة
    const boxRight = para.dir === "rtl" ? startPx : startPx + wPx;
    const boxLeft = para.dir === "rtl" ? startPx - wPx : startPx;
    const glyphs: GlyphBox[] = [];
    let cum = 0;
    for (const g of w.glyphs) {
      // الغليفات في ترتيبٍ بصريٍّ داخل الكلمة: اتجاهُ الكلمة يحدد من أيّ
      // حافةٍ تبدأ، وصندوقُ الكلمة يحدده اتجاهُ الفقرة.
      const gx = w.direction === "rtl" ? boxRight - cum * sx : boxLeft + cum * sx;
      glyphs.push({
        fontIndex: w.fontIndex,
        glyphId: g.id,
        xPx: gx,
        baselinePx: wordBaselinePx,
        xOffsetFont: g.xOffset,
        yOffsetFont: g.yOffset,
        sx,
        sy,
        mark: g.xAdvance === 0,
      });
      cum += g.xAdvance;
    }
    words.push({
      text: w.text, fontIndex: w.fontIndex,
      minXPx: boxLeft, maxXPx: boxRight,
      ascentPx: w.ascentTwips / TWIPS_PER_PX,
      descentPx: w.descentTwips / TWIPS_PER_PX,
      glyphs,
      color: w.color, bold: w.bold, italic: w.italic,
      underline: w.underline, underlineColor: w.underlineColor,
      strike: w.strike, highlight: w.highlight,
    });
    if (boxLeft < minX) minX = boxLeft;
    if (boxRight > maxX) maxX = boxRight;
    penPx += dirSign * wPx;
  }
  return { words, minXPx: minX, maxXPx: maxX };
}

/** أبعاد الفقرة بالـpx (لخلفية التظليل) من أسطرها. */
export function paragraphBlock(para: SceneParagraph): { x: number; y: number; w: number; h: number } | null {
  if (para.lines.length === 0) return null;
  let minX = Infinity, maxX = -Infinity, top = Infinity, bottom = -Infinity;
  for (const ln of para.lines) {
    const g = lineWordGeometry(ln, para);
    minX = Math.min(minX, g.minXPx);
    maxX = Math.max(maxX, g.maxXPx);
    top = Math.min(top, ln.yTwips / TWIPS_PER_PX - ln.ascentTwips / TWIPS_PER_PX);
    bottom = Math.max(bottom, ln.yTwips / TWIPS_PER_PX + ln.descentTwips / TWIPS_PER_PX);
  }
  return { x: minX, y: top, w: maxX - minX, h: bottom - top };
}
