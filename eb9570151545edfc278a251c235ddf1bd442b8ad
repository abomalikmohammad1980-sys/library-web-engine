/**
 * ترسيم صفحة المشهد إلى HTML — مع دعم كامل: RTL، صور، حواشي، جداول، TOC.
 *
 * لكل صفحة من المشهد، نبني div بحجم الصفحة ونضع العناصر بمواضعها المطلقة.
 */

import type { SceneAnchor, SceneDocument, SceneLine, ScenePage, SceneParagraph, SceneTableCell } from "@engine/scene";
import { paintImagePayload } from "./imagePayload.js";
import { TWIPS_PER_PX } from "./units.js";

export function renderPageToHtml(page: ScenePage, doc: SceneDocument, pageNum?: number): HTMLElement {
  const wPx = page.widthTwips / TWIPS_PER_PX;
  const hPx = page.heightTwips / TWIPS_PER_PX;

  const root = document.createElement("div");
  root.className = "scene-page";
  root.style.cssText = [
    "position:relative",
    `width:${wPx}px`,
    `height:${hPx}px`,
    "overflow:hidden",
    `background:#${page.backgroundColor ?? "fff"}`,
  ].join(";");

  if (page.pageBorders) {
    const b = page.pageBorders;
    const base = page.pageBorderOffsetFrom === "text"
      ? [page.marTopTwips, page.marRightTwips, page.marBottomTwips, page.marLeftTwips] : [0, 0, 0, 0];
    const sides = [b.top, b.right, b.bottom, b.left];
    const inset = sides.map((side, index) => base[index]! + (side?.spaceTwips ?? 0));
    const cssBorder = (side: typeof b.top) => {
      const style = side ? borderStyle(side.val) : null;
      return !side || !style ? "none"
        : `${side.wTwips / TWIPS_PER_PX}px ${style} #${side.color ?? "000000"}`;
    };
    const frame = document.createElement("div");
    frame.className = "scene-page-border";
    frame.style.cssText = ["position:absolute", `top:${inset[0]! / TWIPS_PER_PX}px`,
      `right:${inset[1]! / TWIPS_PER_PX}px`, `bottom:${inset[2]! / TWIPS_PER_PX}px`,
      `left:${inset[3]! / TWIPS_PER_PX}px`, "pointer-events:none", "box-sizing:border-box",
      `z-index:${page.pageBorderZOrder === "back" ? 0 : 30}`,
      `border-top:${cssBorder(b.top)}`, `border-right:${cssBorder(b.right)}`,
      `border-bottom:${cssBorder(b.bottom)}`, `border-left:${cssBorder(b.left)}`].join(";");
    if ([b.top, b.right, b.bottom, b.left].every(side => side?.val === "twistedLines1")) {
      frame.dataset.wordArtBorder = "twistedLines1";
      const band = Math.max(2, (b.top?.wTwips ?? 35) / TWIPS_PER_PX * 1.5);
      frame.style.border = `${band}px solid #000080`;
      frame.style.outline = "1px solid #000";
      frame.style.boxShadow = `inset 0 0 0 ${band + 2}px #fff,inset 0 0 0 ${band + 3}px #000,0 0 0 ${band + 2}px #fff,0 0 0 ${band + 3}px #000`;
      for (const corner of ["tl", "tr", "bl", "br"]) {
        const knot = document.createElement("span"); knot.className = `scene-page-border-knot scene-page-border-knot--${corner}`;
        knot.style.cssText = ["position:absolute", `width:${band * 3.2}px`, `height:${band * 3.2}px`,
          "border:1px solid #000", "box-shadow:inset 0 0 0 2px #fff,inset 0 0 0 3px #000",
          corner.includes("t") ? `top:${-band * 1.6}px` : `bottom:${-band * 1.6}px`,
          corner.includes("l") ? `left:${-band * 1.6}px` : `right:${-band * 1.6}px`].join(";");
        frame.appendChild(knot);
      }
    }
    root.appendChild(frame);
  }

  // رقم الصفحة أسفل
  if (pageNum != null) {
    const pgNum = document.createElement("div");
    pgNum.style.cssText = [
      "position:absolute",
      `bottom:${(page.marBottomTwips / TWIPS_PER_PX) * 0.4}px`,
      "left:0;right:0",
      "text-align:center",
      "font-size:10pt",
      "color:#999",
      "direction:rtl",
    ].join(";");
    pgNum.textContent = `— ${pageNum + 1} —`;
    root.appendChild(pgNum);
  }

  // ===== الصور والأشكال (behind + front) =====
  const anchorBackRoot = document.createElement("div");
  anchorBackRoot.className = "scene-anchor-layer scene-anchor-layer--back";
  anchorBackRoot.style.cssText = "position:absolute;inset:0;z-index:1;pointer-events:none";
  root.appendChild(anchorBackRoot);
  const anchorFrontRoot = document.createElement("div");
  anchorFrontRoot.className = "scene-anchor-layer scene-anchor-layer--front";
  anchorFrontRoot.style.cssText = "position:absolute;inset:0;z-index:20;pointer-events:none";
  const anchorTextTargets = new Map<SceneAnchor, HTMLElement>();
  const orderedAnchors = (page.anchors ?? []).map((anchor, index) => ({ anchor, index }))
    .sort((a, b) => (a.anchor.zOrder ?? 0) - (b.anchor.zOrder ?? 0) || a.index - b.index)
    .map(item => item.anchor);
  for (const anc of orderedAnchors) {
    const anchorLayer = document.createElement("div");
    anchorLayer.className = "scene-anchor";
    anchorLayer.style.cssText = "position:absolute;inset:0";
    (anc.behindDoc ? anchorBackRoot : anchorFrontRoot).appendChild(anchorLayer);
    anchorTextTargets.set(anc, anchorLayer);
    if (anc.chart) {
      anchorLayer.appendChild(chartSvg(anc));
      continue;
    }
    if (anc.groupChildren?.length) {
      for (const child of anc.groupChildren) {
        const childNode = child.imageData ? document.createElement("img") : document.createElement("div");
        childNode.className = "scene-anchor-child";
        if (child.imageData) {
          const payload = paintImagePayload(child.imageData);
          if (!payload) continue;
          (childNode as HTMLImageElement).src = URL.createObjectURL(new Blob(
            [payload.bytes as BlobPart], { type: payload.mime }));
          (childNode as HTMLImageElement).alt = child.text ?? "";
        } else childNode.textContent = child.text ?? "";
        childNode.style.cssText = [
          "position:absolute", `left:${child.xTwips / TWIPS_PER_PX}px`,
          `top:${child.yTwips / TWIPS_PER_PX}px`, `width:${child.wTwips / TWIPS_PER_PX}px`,
          `height:${child.hTwips / TWIPS_PER_PX}px`, "box-sizing:border-box", "overflow:hidden",
          "display:flex", "align-items:center", "justify-content:center", "text-align:center",
          child.shapeGradient?.stops.length ? `background:linear-gradient(${child.shapeGradient.angle}deg,${child.shapeGradient.stops.map(stop => `#${stop.color} ${stop.pos * 100}%`).join(",")})`
            : child.shapeFill ? `background:#${child.shapeFill}` : "",
          child.shapeStroke ? `border:${(child.shapeStrokeWTwips ?? 15) / TWIPS_PER_PX}px solid #${child.shapeStroke}` : "",
          child.shapePrst === "ellipse" || child.shapePrst === "circle" ? "border-radius:50%" : "",
          child.textEmTwips ? `font-size:${child.textEmTwips / TWIPS_PER_PX}px` : "",
        ].filter(Boolean).join(";");
        anchorLayer.appendChild(childNode);
      }
      continue;
    }
    if (anc.imageData) {
      const img = document.createElement("img");
      const payload = paintImagePayload(anc.imageData);
      if (!payload) continue;
      const blob = new Blob([payload.bytes as BlobPart], { type: payload.mime });
      img.src = URL.createObjectURL(blob);
      img.style.cssText = [
        "position:absolute",
        `left:${anc.xTwips / TWIPS_PER_PX}px`,
        `top:${anc.yTwips / TWIPS_PER_PX}px`,
        `width:${anc.wTwips / TWIPS_PER_PX}px`,
        `height:${anc.hTwips / TWIPS_PER_PX}px`,
        anc.imageOpacity != null ? `opacity:${Math.max(0, Math.min(1, anc.imageOpacity))}` : "",
        anc.shapePrst === "ellipse" ? "border-radius:50%" : "",
        anc.shapePrst?.includes("round") ? "border-radius:8px" : "",
        anc.imageShadow ? `filter:drop-shadow(${anc.imageShadow.x}px ${anc.imageShadow.y}px ${anc.imageShadow.blur}px #${anc.imageShadow.color}${Math.round(anc.imageShadow.opacity * 255).toString(16).padStart(2, "0")})` :
          anc.imageGlow ? `filter:drop-shadow(0 0 ${anc.imageGlow.radius}px #${anc.imageGlow.color}${Math.round(anc.imageGlow.opacity * 255).toString(16).padStart(2, "0")})` : "",
        anc.imageBorder ? `border:${anc.imageBorder.width}px solid #${anc.imageBorder.color}` : "",
      ].join(";");
      anchorLayer.appendChild(img);
      if (anc.imageReflection) {
        const reflection = img.cloneNode(false) as HTMLImageElement;
        reflection.className = "scene-anchor-reflection";
        reflection.style.top = `${(anc.yTwips + anc.hTwips) / TWIPS_PER_PX + anc.imageReflection.distance}px`;
        reflection.style.transform = "scaleY(-1)";
        reflection.style.transformOrigin = "top";
        const start = Math.max(0, Math.min(1, anc.imageReflection.startOpacity));
        const end = Math.max(0, Math.min(1, anc.imageReflection.endOpacity));
        reflection.style.maskImage = `linear-gradient(to bottom,rgba(0,0,0,${start}),rgba(0,0,0,${end}))`;
        reflection.style.webkitMaskImage = reflection.style.maskImage;
        reflection.style.filter = "none";
        anchorLayer.appendChild(reflection);
      }
    } else if (anc.shapePrst) {
      // أشكال بسيطة
      const shape = document.createElement("div");
      shape.style.cssText = [
        "position:absolute",
        `left:${anc.xTwips / TWIPS_PER_PX}px`,
        `top:${anc.yTwips / TWIPS_PER_PX}px`,
        `width:${anc.wTwips / TWIPS_PER_PX}px`,
        `height:${anc.hTwips / TWIPS_PER_PX}px`,
        anc.shapeGradient?.stops.length ? `background:linear-gradient(${anc.shapeGradient.angle}deg,${anc.shapeGradient.stops.map(stop => `#${stop.color} ${stop.pos * 100}%`).join(",")})`
          : anc.shapeFill ? `background:#${anc.shapeFill}` : "",
        anc.shapeStroke ? `border:${(anc.shapeStrokeWTwips ?? 15) / TWIPS_PER_PX}px solid #${anc.shapeStroke}` : "",
        anc.shapePrst === "ellipse" ? "border-radius:50%" : "",
        anc.shapePrst?.includes("round") ? "border-radius:8px" : "",
        anc.shapePrst === "teardrop" ? "border-radius:0 50% 50% 50%" : "",
        anc.imageShadow ? `filter:drop-shadow(${anc.imageShadow.x}px ${anc.imageShadow.y}px ${anc.imageShadow.blur}px #${anc.imageShadow.color}${Math.round(anc.imageShadow.opacity * 255).toString(16).padStart(2, "0")})` :
          anc.imageGlow ? `filter:drop-shadow(0 0 ${anc.imageGlow.radius}px #${anc.imageGlow.color}${Math.round(anc.imageGlow.opacity * 255).toString(16).padStart(2, "0")})` : "",
      ].filter(Boolean).join(";");
      anchorLayer.appendChild(shape);
    }
  }

  // ===== النص الرئيسي + الهيدرات/الفوترات =====
  const textRoot = document.createElement("div");
  textRoot.style.cssText = "position:absolute;top:0;left:0;right:0;bottom:0;z-index:10";
  root.appendChild(textRoot);
  root.appendChild(anchorFrontRoot);

  const allTableCells = (tables: NonNullable<ScenePage["tables"]>): SceneTableCell[] =>
    tables.flatMap(table => table.rows.flatMap(row => row.cells.flatMap(cell =>
      [cell, ...allTableCells(cell.nestedTables ?? [])])));
  const sceneCells = allTableCells(page.tables ?? []);
  for (const cell of sceneCells) {
    const box = document.createElement("div");
    const border = cell.borders;
    const side = (name: "top" | "right" | "bottom" | "left") => {
      const b = border?.[name];
      return b ? `border-${name}:${b.wTwips / TWIPS_PER_PX}px solid #${b.color ?? "000"}` : "";
    };
    box.style.cssText = ["position:absolute", `left:${cell.xTwips / TWIPS_PER_PX}px`,
      `top:${cell.yTwips / TWIPS_PER_PX}px`, `width:${cell.wTwips / TWIPS_PER_PX}px`,
      `height:${cell.hTwips / TWIPS_PER_PX}px`, cell.shdFill ? `background:#${cell.shdFill}` : "",
      side("top"), side("right"), side("bottom"), side("left"), "box-sizing:border-box"].filter(Boolean).join(";");
    textRoot.appendChild(box);
  }

  const flatLines = (paras: ScenePage["headerParas"], target = textRoot):
    { line: SceneLine; para: SceneParagraph; target: HTMLElement }[] =>
    (paras ?? []).flatMap((p) => p.lines.map((l) => ({ line: l, para: p, target })));

  const allParas = [
    ...flatLines(page.headerParas),
    ...page.paragraphs.flatMap((p) => p.lines.map((l) => ({ line: l, para: p, target: textRoot }))),
    ...sceneCells.flatMap(cell =>
      cell.paragraphs.flatMap(p => p.lines.map(line => ({ line, para: p, target: textRoot })))),
    ...orderedAnchors.flatMap(anchor => (anchor.textBoxParas ?? [])
      .flatMap(p => p.lines.map(line => ({ line, para: p, target: anchorTextTargets.get(anchor)! })))),
    ...flatLines(page.footerParas),
  ];

  for (const { line, para, target } of allParas) {
    const baselinePx = line.yTwips / TWIPS_PER_PX;
    const lineTopPx = baselinePx - (line.ascentTwips / TWIPS_PER_PX);
    const lineH = line.heightTwips / TWIPS_PER_PX;
    let penPx = line.startTwips / TWIPS_PER_PX;
    const dirSign = para.dir === "rtl" ? -1 : 1;

    for (const word of line.words) {
      const wordTopPx = lineTopPx - word.baselineShiftTwips / TWIPS_PER_PX;
      const spacePx = (word.spaceBeforeTwips * (line.shrinkFactor ?? 1)) / TWIPS_PER_PX;
      penPx += dirSign * spacePx;
      const wPxWord = word.advanceTwips / TWIPS_PER_PX;
      const pxRight = para.dir === "rtl" ? wPx - penPx : penPx;

      const font = doc.fonts[word.fontIndex];
      const span = document.createElement("span");
      span.textContent = word.text;
      const cssText = [
        "position:absolute",
        `top:${wordTopPx}px`,
        `height:${lineH}px`,
        word.direction === "rtl" ? `right:${pxRight}px` : `left:${pxRight}px`,
        "white-space:nowrap",
        `font-size:${word.emTwips / TWIPS_PER_PX}px`,
        `font-family:${cssFamily(font?.family)}`,
        (word.horizontalScale ?? 1) !== 1 ? `font-stretch:${(word.horizontalScale ?? 1) * 100}%` : "",
        word.bold ? "font-weight:bold" : "",
        word.italic ? "font-style:italic" : "",
        word.color ? `color:#${word.color}` : "color:#000",
        word.underline ? "text-decoration:underline" : "",
        word.highlight ? `background:#${word.highlight}` : "",
        "unicode-bidi:embed",
      ].filter(Boolean).join(";");
      span.style.cssText = cssText;
      target.appendChild(span);
      penPx += dirSign * wPxWord;
    }
  }

  return root;
}

function chartSvg(anc: SceneAnchor): SVGSVGElement {
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  const w = anc.wTwips / TWIPS_PER_PX, h = anc.hTwips / TWIPS_PER_PX, chart = anc.chart!;
  svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
  svg.setAttribute("aria-label", chart.kind === "bar" ? "Word chart" : `Unsupported chart: ${chart.unsupportedType ?? "unknown"}`);
  svg.style.cssText = `position:absolute;left:${anc.xTwips / TWIPS_PER_PX}px;top:${anc.yTwips / TWIPS_PER_PX}px;width:${w}px;height:${h}px;background:#fff`;
  const add = (tag: string, attrs: Record<string, string>, text?: string) => {
    const node = document.createElementNS(ns, tag); for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
    if (text != null) node.textContent = text; svg.appendChild(node); return node;
  };
  if (chart.kind !== "bar") { add("rect", { x: "0", y: "0", width: String(w), height: String(h), fill: "none", stroke: "#999" });
    add("text", { x: String(w / 2), y: String(h / 2), "text-anchor": "middle", fill: "#555" }, `Unsupported chart: ${chart.unsupportedType ?? "unknown"}`); return svg; }
  const top = chart.legend.visible ? 28 : 12, left = 34, right = w - 12, bottom = h - 30;
  const pw = Math.max(1, right - left), ph = Math.max(1, bottom - top);
  const max = Math.max(1, ...chart.series.flatMap(series => series.values));
  if (chart.categoryAxis) add("line", { x1: String(left), y1: String(bottom), x2: String(right), y2: String(bottom), stroke: "#d8d8d8" });
  if (chart.valueAxis) add("line", { x1: String(left), y1: String(top), x2: String(left), y2: String(bottom), stroke: "#d8d8d8" });
  const count = chart.categories.length || Math.max(0, ...chart.series.map(s => s.values.length));
  const gw = pw / Math.max(1, count), bw = gw / Math.max(1, chart.series.length + 1);
  chart.series.forEach((series, si) => series.values.forEach((value, ci) => {
    const bh = Math.max(0, value / max * ph), bx = left + ci * gw + bw * (.5 + si), by = bottom - bh;
    add("rect", { x: String(bx), y: String(by), width: String(bw), height: String(bh), fill: `#${series.color}` });
    if (chart.showValues) add("text", { x: String(bx + bw / 2), y: String(by - 3), "text-anchor": "middle", "font-size": "9", fill: "#555" }, String(value));
  }));
  chart.categories.forEach((category, index) => add("text", { x: String(left + gw * (index + .5)), y: String(bottom + 13), "text-anchor": "middle", "font-size": "9", fill: "#666" }, category));
  if (chart.legend.visible) { let lx = left; for (const series of chart.series) { add("rect", { x: String(lx), y: "8", width: "9", height: "9", fill: `#${series.color}` });
    add("text", { x: String(lx + 12), y: "16", "font-size": "9", fill: "#555" }, series.name); lx += 75; } }
  if (chart.title) add("text", { x: String(w / 2), y: "14", "text-anchor": "middle", "font-size": "11", "font-weight": "bold" }, chart.title);
  return svg;
}

function borderStyle(val: string): string | null {
  if (val === "dashed") return "dashed";
  if (val === "dotted") return "dotted";
  if (val === "single" || val === "thick") return "solid";
  return null; // حدود Word الفنية لا تُقرب إلى solid.
}

function cssFamily(family: string | undefined): string {
  if (!family) return "'Traditional Arabic','Times New Roman',serif";
  return `'${family.replace(/'/g, "")}','Traditional Arabic','Times New Roman',serif`;
}
