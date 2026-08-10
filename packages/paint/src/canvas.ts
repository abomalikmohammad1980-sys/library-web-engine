/**
 * الرسم على Canvas — ترميمُ صفحةٍ من شجرة المشهد إلى بكسلات.
 *
 * المسارُ الكامل: غليفاتُ HB (وحدات خط) ⟵ twips ⟵ px. يبني Path2D من مسار
 * SVG الذي يخرجه `glyphPath` (مسارُ HarfBuzz بصيغة SVG — صالحٌ مباشرةً
 * لـ Path2D في المتصفح) ويرسمه بتحويل مقياسٍ وقلبٍ رأسيٍّ (خطوطُ الخطوط
 * صاعدة الـy بينما الـcanvas هابطه). كاشُ المسارات لكل (خط، غليف).
 */

import type { SceneAnchor, SceneDocument, ScenePage } from "@engine/scene";
import { paintImagePayload } from "./imagePayload.js";
import { Shaper } from "@engine/shaper";
import { lineWordGeometry, paragraphBlock } from "./geometry.js";
import { TWIPS_PER_PX } from "./units.js";

export interface RenderOptions {
  /** مقياسُ وضوح (dpr) — افتراضي 1 */
  scale?: number;
  /** لونُ الخلفية — null لشفّاف */
  background?: string | null;
}

/** كاشُ مسارات: فهرس الخطّ → (معرّف الغليف → Path2D) */
export interface PathCache {
  byFont: Map<number, Map<number, Path2D>>;
  shaper: Shaper;
}

export function createPathCache(): PathCache {
  return { byFont: new Map(), shaper: new Shaper() };
}

/** مسارُ الغليف (مقيّدٌ ومخفّض للمرة الأولى لكل خط/غليف). */
export function glyphPath(cache: PathCache, doc: SceneDocument, fontIndex: number, glyphId: number): Path2D {
  const font = doc.fonts[fontIndex];
  if (!font) throw new RangeError(`خطّ غير موجود: ${fontIndex}`);
  let byGlyph = cache.byFont.get(fontIndex);
  if (!byGlyph) { byGlyph = new Map(); cache.byFont.set(fontIndex, byGlyph); }
  let p = byGlyph.get(glyphId);
  if (!p) {
    p = new Path2D(cache.shaper.glyphPath(font.data, glyphId));
    byGlyph.set(glyphId, p);
  }
  return p;
}

/** يرسّم صفحةً كاملة إلى canvas بالـpx القياسيين (twips/15). */
export function renderPageToCanvas(
  page: ScenePage, doc: SceneDocument, opts: RenderOptions = {},
): HTMLCanvasElement {
  return paintPageToCanvas(page, doc, opts).canvas;
}

/** مثل renderPageToCanvas، لكنه لا يكتمل قبل فكّ كل الصور ورسمها.
 * هذا هو المسار الواجب استعماله عند أخذ لقطة ثابتة مثل PDF. */
export async function renderPageToCanvasSettled(
  page: ScenePage, doc: SceneDocument, opts: RenderOptions = {},
): Promise<HTMLCanvasElement> {
  const painted = paintPageToCanvas(page, doc, opts);
  await Promise.all(painted.pendingImages);
  return painted.canvas;
}

function paintPageToCanvas(
  page: ScenePage, doc: SceneDocument, opts: RenderOptions,
): { canvas: HTMLCanvasElement; pendingImages: Promise<void>[] } {
  const scale = opts.scale ?? 1;
  const wCss = page.widthTwips / TWIPS_PER_PX;
  const hCss = page.heightTwips / TWIPS_PER_PX;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(wCss * scale));
  canvas.height = Math.max(1, Math.round(hCss * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("لا يمكن إنشاء سياق رسم 2D");
  ctx.scale(scale, scale);
  if (opts.background !== null) {
    ctx.fillStyle = opts.background ?? (page.backgroundColor ? `#${page.backgroundColor}` : "#ffffff");
    ctx.fillRect(0, 0, wCss, hCss);
  }
  const cache = createPathCache();
  const pendingImages: Promise<void>[] = [];
  if (page.pageBorderZOrder === "back") drawPageBorder(ctx, page);
  // رسم الصور/الأشكال خلف النص
  const orderedAnchors = (page.anchors ?? []).map((anchor, index) => ({ anchor, index }))
    .sort((a, b) => (a.anchor.zOrder ?? 0) - (b.anchor.zOrder ?? 0) || a.index - b.index)
    .map(item => item.anchor);
  const behindAnchors = orderedAnchors.filter((a) => a.behindDoc);
  const frontAnchors = orderedAnchors.filter((a) => !a.behindDoc);
  for (const anc of behindAnchors) {
    pendingImages.push(drawAnchor(ctx, anc));
    for (const para of anc.textBoxParas ?? []) drawParagraph(ctx, page, doc, para, cache);
  }
  for (const para of page.headerParas ?? []) drawParagraph(ctx, page, doc, para, cache);
  for (const para of page.footerParas ?? []) drawParagraph(ctx, page, doc, para, cache);
  // رسم فقرات النص
  for (const para of page.paragraphs) {
    drawParagraph(ctx, page, doc, para, cache);
  }
  const drawTable = (table: NonNullable<ScenePage["tables"]>[number]): void => {
  for (const row of table.rows) for (const cell of row.cells) {
    const x = cell.xTwips / TWIPS_PER_PX, y = cell.yTwips / TWIPS_PER_PX;
    const w = cell.wTwips / TWIPS_PER_PX, h = cell.hTwips / TWIPS_PER_PX;
    if (cell.shdFill) { ctx.fillStyle = `#${cell.shdFill}`; ctx.fillRect(x, y, w, h); }
    const borders = cell.borders;
    const line = (side: "top" | "right" | "bottom" | "left") => {
      const b = borders?.[side]; if (!b) return;
      ctx.strokeStyle = `#${b.color ?? "000000"}`; ctx.lineWidth = Math.max(1, b.wTwips / TWIPS_PER_PX);
      ctx.beginPath();
      if (side === "top" || side === "bottom") { const yy = side === "top" ? y : y + h; ctx.moveTo(x, yy); ctx.lineTo(x + w, yy); }
      else { const xx = side === "left" ? x : x + w; ctx.moveTo(xx, y); ctx.lineTo(xx, y + h); }
      ctx.stroke();
    };
    line("top"); line("right"); line("bottom"); line("left");
    for (const para of cell.paragraphs) drawParagraph(ctx, page, doc, para, cache);
    for (const nested of cell.nestedTables ?? []) drawTable(nested);
  }
  };
  for (const table of page.tables ?? []) drawTable(table);
  // رسم الصور/الأشكال فوق النص
  for (const anc of frontAnchors) {
    pendingImages.push(drawAnchor(ctx, anc));
    for (const para of anc.textBoxParas ?? []) drawParagraph(ctx, page, doc, para, cache);
  }
  if (page.pageBorderZOrder !== "back") drawPageBorder(ctx, page);
  return { canvas, pendingImages };
}

function drawPageBorder(ctx: CanvasRenderingContext2D, page: ScenePage): void {
  const borders = page.pageBorders;
  if (!borders) return;
  const base = page.pageBorderOffsetFrom === "text"
    ? [page.marTopTwips, page.marRightTwips, page.marBottomTwips, page.marLeftTwips] : [0, 0, 0, 0];
  const sides = [borders.top, borders.right, borders.bottom, borders.left];
  const inset = sides.map((side, index) => (base[index]! + (side?.spaceTwips ?? 0)) / TWIPS_PER_PX);
  const x0 = inset[3]!, y0 = inset[0]!;
  const x1 = page.widthTwips / TWIPS_PER_PX - inset[1]!;
  const y1 = page.heightTwips / TWIPS_PER_PX - inset[2]!;
  const art = sides.every(side => side?.val === "twistedLines1");
  if (art) {
    const w = x1 - x0, h = y1 - y0, band = Math.max(2, (borders.top?.wTwips ?? 35) / TWIPS_PER_PX * 1.5);
    ctx.save();
    ctx.strokeStyle = "#000000"; ctx.lineWidth = 1;
    ctx.strokeRect(x0 - band - 2, y0 - band - 2, w + (band + 2) * 2, h + (band + 2) * 2);
    ctx.strokeRect(x0 + band + 2, y0 + band + 2, w - (band + 2) * 2, h - (band + 2) * 2);
    ctx.strokeStyle = "#000080"; ctx.lineWidth = band; ctx.strokeRect(x0, y0, w, h);
    const knot = band * 3.2;
    const corners: Array<[number, number]> = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]];
    for (const [cx, cy] of corners) {
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1;
      ctx.strokeRect(cx - knot / 2, cy - knot / 2, knot, knot);
      ctx.strokeRect(cx - knot / 3, cy - knot / 3, knot * 2 / 3, knot * 2 / 3);
      ctx.beginPath(); ctx.moveTo(cx - knot / 2, cy); ctx.lineTo(cx + knot / 2, cy);
      ctx.moveTo(cx, cy - knot / 2); ctx.lineTo(cx, cy + knot / 2); ctx.stroke();
    }
    ctx.restore(); return;
  }
  const line = (side: typeof borders.top, xA: number, yA: number, xB: number, yB: number) => {
    if (!side || !["single", "thick", "dashed", "dotted"].includes(side.val) || side.wTwips <= 0) return;
    ctx.strokeStyle = `#${side.color ?? "000000"}`;
    ctx.lineWidth = side.wTwips / TWIPS_PER_PX;
    ctx.setLineDash(side.val === "dashed" ? [6, 4] : side.val === "dotted" ? [1, 3] : []);
    ctx.beginPath(); ctx.moveTo(xA, yA); ctx.lineTo(xB, yB); ctx.stroke();
  };
  line(borders.top, x0, y0, x1, y0); line(borders.right, x1, y0, x1, y1);
  line(borders.bottom, x1, y1, x0, y1); line(borders.left, x0, y1, x0, y0);
  ctx.setLineDash([]);
}

/** يرسم صورة/شكلًا على Canvas من بيانات المشهد. */
function drawAnchor(ctx: CanvasRenderingContext2D, anc: SceneAnchor): Promise<void> {
  const xPx = anc.xTwips / TWIPS_PER_PX;
  const yPx = anc.yTwips / TWIPS_PER_PX;
  const wPx = anc.wTwips / TWIPS_PER_PX;
  const hPx = anc.hTwips / TWIPS_PER_PX;
  if (wPx <= 0 || hPx <= 0) return Promise.resolve();
  if (anc.groupChildren?.length) {
    return Promise.all(anc.groupChildren.map(child => drawAnchor(ctx, {
      ...child, behindDoc: anc.behindDoc, floating: anc.floating,
    }))).then(() => undefined);
  }
  if (anc.chart) {
    drawChart(ctx, anc, xPx, yPx, wPx, hPx);
    return Promise.resolve();
  }
  const shapePath = () => {
    const cx = xPx + wPx / 2, cy = yPx + hPx / 2;
    ctx.beginPath();
    const prst = anc.shapePrst;
    if (prst === "rect" || prst === "roundRect") {
      const r = prst === "roundRect" ? Math.min(wPx, hPx) * 0.15 : 0;
      ctx.roundRect ? ctx.roundRect(xPx, yPx, wPx, hPx, r) : ctx.rect(xPx, yPx, wPx, hPx);
    } else if (prst === "ellipse") ctx.ellipse(cx, cy, wPx / 2, hPx / 2, 0, 0, Math.PI * 2);
    else if (prst?.startsWith("diamond")) { ctx.moveTo(cx, yPx); ctx.lineTo(xPx + wPx, cy);
      ctx.lineTo(cx, yPx + hPx); ctx.lineTo(xPx, cy); ctx.closePath(); }
    else if (prst === "teardrop") {
      // OOXML teardrop: رأس عند أعلى اليمين وفص دائري ممتد إلى أسفل اليسار.
      ctx.moveTo(xPx + wPx, yPx);
      ctx.bezierCurveTo(xPx + wPx, yPx + hPx * .58, xPx + wPx * .58, yPx + hPx,
        xPx + wPx * .34, yPx + hPx);
      ctx.bezierCurveTo(xPx + wPx * .08, yPx + hPx, xPx, yPx + hPx * .78,
        xPx, yPx + hPx * .52);
      ctx.bezierCurveTo(xPx, yPx + hPx * .2, xPx + wPx * .28, yPx,
        xPx + wPx, yPx); ctx.closePath();
    }
    else ctx.rect(xPx, yPx, wPx, hPx);
  };
  // شكل متجه بلا صورة
  if (anc.shapePrst && !anc.imageData) {
    ctx.save();
    if (anc.imageShadow) {
      ctx.shadowOffsetX = anc.imageShadow.x; ctx.shadowOffsetY = anc.imageShadow.y;
      ctx.shadowBlur = anc.imageShadow.blur;
      const alpha = Math.max(0, Math.min(1, anc.imageShadow.opacity));
      ctx.shadowColor = `#${anc.imageShadow.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    } else if (anc.imageGlow) {
      ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = anc.imageGlow.radius;
      const alpha = Math.max(0, Math.min(1, anc.imageGlow.opacity));
      ctx.shadowColor = `#${anc.imageGlow.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
    }
    if (anc.shapeGradient?.stops.length) {
      const angle = anc.shapeGradient.angle * Math.PI / 180;
      const dx = Math.cos(angle) * wPx / 2, dy = Math.sin(angle) * hPx / 2;
      const gradient = ctx.createLinearGradient(xPx + wPx / 2 - dx, yPx + hPx / 2 - dy,
        xPx + wPx / 2 + dx, yPx + hPx / 2 + dy);
      for (const stop of anc.shapeGradient.stops) gradient.addColorStop(stop.pos, `#${stop.color}`);
      ctx.fillStyle = gradient;
    } else ctx.fillStyle = anc.shapeFill ?? "transparent";
    ctx.strokeStyle = anc.shapeStroke ?? "transparent";
    ctx.lineWidth = Math.max(.5, (anc.shapeStrokeWTwips ?? 15) / TWIPS_PER_PX);
    shapePath();
    if (ctx.fillStyle !== "transparent") ctx.fill();
    if (ctx.strokeStyle !== "transparent") ctx.stroke();
    ctx.restore();
    const child = anc as SceneAnchor & { text?: string; textEmTwips?: number };
    if (child.text) {
      ctx.save();
      ctx.fillStyle = "#000000";
      ctx.font = `${Math.max(1, (child.textEmTwips ?? 240) / TWIPS_PER_PX)}px sans-serif`;
      ctx.textAlign = "center"; ctx.textBaseline = "middle";
      ctx.fillText(child.text, xPx + wPx / 2, yPx + hPx / 2, Math.max(1, wPx - 4));
      ctx.restore();
    }
    return Promise.resolve();
  }
  // صورة نقطية
  if (anc.imageData) {
    const img = document.createElement("img");
    const payload = paintImagePayload(anc.imageData);
    if (!payload) return Promise.resolve();
    const blob = new Blob([payload.bytes as BlobPart], { type: payload.mime });
    const url = URL.createObjectURL(blob);
    return new Promise((resolve) => {
      img.onload = () => {
        ctx.save();
        if (anc.imageOpacity != null) ctx.globalAlpha = Math.max(0, Math.min(1, anc.imageOpacity));
        if (anc.imageShadow) {
          ctx.shadowOffsetX = anc.imageShadow.x;
          ctx.shadowOffsetY = anc.imageShadow.y;
          ctx.shadowBlur = anc.imageShadow.blur;
          const alpha = Math.max(0, Math.min(1, anc.imageShadow.opacity));
          ctx.shadowColor = `#${anc.imageShadow.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
        } else if (anc.imageGlow) {
          ctx.shadowOffsetX = 0; ctx.shadowOffsetY = 0; ctx.shadowBlur = anc.imageGlow.radius;
          const alpha = Math.max(0, Math.min(1, anc.imageGlow.opacity));
          ctx.shadowColor = `#${anc.imageGlow.color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
        }
        if (anc.shapePrst) { shapePath(); ctx.clip(); }
        ctx.drawImage(img, xPx, yPx, wPx, hPx);
        ctx.restore();
        if (anc.imageBorder) {
          ctx.save(); shapePath();
          ctx.strokeStyle = `#${anc.imageBorder.color}`;
          ctx.lineWidth = Math.max(0.5, anc.imageBorder.width);
          ctx.stroke(); ctx.restore();
        }
        if (anc.imageReflection) {
          const reflection = document.createElement("canvas");
          reflection.width = Math.max(1, Math.ceil(wPx)); reflection.height = Math.max(1, Math.ceil(hPx));
          const rc = reflection.getContext("2d");
          if (rc) {
            rc.translate(0, hPx); rc.scale(1, -1); rc.drawImage(img, 0, 0, wPx, hPx);
            rc.setTransform(1, 0, 0, 1, 0, 0); rc.globalCompositeOperation = "destination-in";
            const mask = rc.createLinearGradient(0, 0, 0, hPx);
            mask.addColorStop(0, `rgba(0,0,0,${anc.imageReflection.startOpacity})`);
            mask.addColorStop(1, `rgba(0,0,0,${anc.imageReflection.endOpacity})`);
            rc.fillStyle = mask; rc.fillRect(0, 0, wPx, hPx);
            ctx.drawImage(reflection, xPx, yPx + hPx + anc.imageReflection.distance, wPx, hPx);
          }
        }
        URL.revokeObjectURL(url);
        resolve();
      };
      img.onerror = () => { URL.revokeObjectURL(url); resolve(); };
      img.src = url;
    });
  }
  return Promise.resolve();
}

function drawChart(ctx: CanvasRenderingContext2D, anc: SceneAnchor,
  x: number, y: number, w: number, h: number): void {
  const chart = anc.chart!;
  ctx.save(); ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, w, h);
  if (chart.kind !== "bar") {
    ctx.strokeStyle = "#999"; ctx.strokeRect(x, y, w, h); ctx.fillStyle = "#555";
    ctx.font = "12px sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(`Unsupported chart: ${chart.unsupportedType ?? "unknown"}`, x + w / 2, y + h / 2);
    ctx.restore(); return;
  }
  const top = y + (chart.legend.visible ? 28 : 12), left = x + 34, right = x + w - 12;
  const bottom = y + h - 30, plotW = Math.max(1, right - left), plotH = Math.max(1, bottom - top);
  const max = Math.max(1, ...chart.series.flatMap(series => series.values));
  ctx.strokeStyle = "#d8d8d8"; ctx.lineWidth = 1;
  if (chart.categoryAxis) { ctx.beginPath(); ctx.moveTo(left, bottom); ctx.lineTo(right, bottom); ctx.stroke(); }
  if (chart.valueAxis) { ctx.beginPath(); ctx.moveTo(left, top); ctx.lineTo(left, bottom); ctx.stroke(); }
  const categories = chart.categories.length || Math.max(0, ...chart.series.map(s => s.values.length));
  const groupW = plotW / Math.max(1, categories), barW = groupW / Math.max(1, chart.series.length + 1);
  chart.series.forEach((series, si) => series.values.forEach((value, ci) => {
    const bh = Math.max(0, value / max * plotH);
    const bx = left + ci * groupW + barW * (.5 + si), by = bottom - bh;
    ctx.fillStyle = `#${series.color}`; ctx.fillRect(bx, by, barW, bh);
    if (chart.showValues) { ctx.fillStyle = "#555"; ctx.font = "9px sans-serif";
      ctx.textAlign = "center"; ctx.fillText(String(value), bx + barW / 2, by - 3); }
  }));
  ctx.font = "9px sans-serif"; ctx.fillStyle = "#666"; ctx.textAlign = "center";
  chart.categories.forEach((category, index) => ctx.fillText(category,
    left + groupW * (index + .5), bottom + 13, groupW));
  if (chart.legend.visible) { let lx = left; ctx.textAlign = "left";
    for (const series of chart.series) { ctx.fillStyle = `#${series.color}`; ctx.fillRect(lx, y + 8, 9, 9);
      ctx.fillStyle = "#555"; ctx.fillText(series.name, lx + 12, y + 16); lx += 75; } }
  if (chart.title) { ctx.font = "bold 11px sans-serif"; ctx.textAlign = "center";
    ctx.fillText(chart.title, x + w / 2, y + 14); }
  ctx.restore();
}

export function renderDocumentToCanvas(
  doc: SceneDocument, opts: RenderOptions = {},
): HTMLCanvasElement[] {
  return doc.pages.map((p) => renderPageToCanvas(p, doc, opts));
}

function drawParagraph(
  ctx: CanvasRenderingContext2D, _page: ScenePage, doc: SceneDocument,
  para: Parameters<typeof lineWordGeometry>[1], cache: PathCache,
): void {
  // خلفيةُ تظليل الفقرة
  const block = paragraphBlock(para);
  if (para.shd && block) {
    ctx.fillStyle = `#${para.shd}`;
    ctx.fillRect(block.x, block.y, block.w, block.h);
  }
  // حدودُ الفقرة (w:pBdr)
  if (para.pBdr && block) {
    for (const side of ["top", "bottom", "left", "right"] as const) {
      const b = para.pBdr[side];
      if (!b || b.val === "none" || b.wTwips <= 0) continue;
      ctx.strokeStyle = b.color ? `#${b.color}` : "#000000";
      ctx.lineWidth = Math.max(1, b.wTwips / TWIPS_PER_PX);
      ctx.beginPath();
      if (side === "top") {
        ctx.moveTo(block.x - (b.spaceTwips / TWIPS_PER_PX), block.y);
        ctx.lineTo(block.x + block.w + (b.spaceTwips / TWIPS_PER_PX), block.y);
      } else if (side === "bottom") {
        const by = block.y + block.h;
        ctx.moveTo(block.x - (b.spaceTwips / TWIPS_PER_PX), by);
        ctx.lineTo(block.x + block.w + (b.spaceTwips / TWIPS_PER_PX), by);
      } else if (side === "left") {
        ctx.moveTo(block.x, block.y);
        ctx.lineTo(block.x, block.y + block.h);
      } else if (side === "right") {
        const rx = block.x + block.w;
        ctx.moveTo(rx, block.y);
        ctx.lineTo(rx, block.y + block.h);
      }
      ctx.stroke();
    }
  }
  for (const ln of para.lines) {
    const geo = lineWordGeometry(ln, para);
    const baselinePx = ln.yTwips / TWIPS_PER_PX;
    for (const w of geo.words) {
      const yTop = baselinePx - w.ascentPx;
      // تظليل الكلمة
      if (w.highlight) {
        ctx.fillStyle = `#${w.highlight}`;
        ctx.fillRect(w.minXPx, yTop, w.maxXPx - w.minXPx, w.ascentPx + w.descentPx);
      }
      // الغليفات
      ctx.fillStyle = `#${w.color ?? "000000"}`;
      for (const g of w.glyphs) {
        const path = glyphPath(cache, doc, g.fontIndex, g.glyphId);
        ctx.save();
        ctx.translate(g.xPx, g.baselinePx);
        ctx.scale(g.sx, -g.sy);
        ctx.translate(g.xOffsetFont, g.yOffsetFont);
        ctx.fill(path);
        ctx.restore();
      }
      // تسطير / شطب
      const th = Math.max(1, w.ascentPx * 0.05);
      if (w.underline) {
        ctx.fillStyle = `#${w.underlineColor ?? w.color ?? "000000"}`;
        ctx.fillRect(w.minXPx, baselinePx + th * 1.5, w.maxXPx - w.minXPx, th);
      }
      if (w.strike) {
        ctx.fillStyle = `#${w.color ?? "000000"}`;
        ctx.fillRect(w.minXPx, yTop + w.ascentPx * 0.45, w.maxXPx - w.minXPx, th);
      }
    }
  }
}
