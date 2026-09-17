/** ‏ImageToWidget — تحويل FloatAnchor إلى عنصر DOM (ترجمة مفهومية من
 *  `ImageToWidget.dart`): صورة (rId) أو شكل متجه (shape/diagram) أو مجموعة
 *  (groupChildren) أو مربّع نصٍّ (textBox). */

import type { DocumentModelV0, FloatAnchor } from "@engine/ooxml-model";
import { css, el, px } from "./dom.js";
import { twipsToPx } from "./units.js";
import type { RenderCtx } from "./Paragraph.js";
import { paragraphToElement } from "./Paragraph.js";

/** كاشُ صور: مفتاح = مسار الوسائط ⟵ عنوان blob. */
export class ImageCache {
  readonly blobs = new Map<string, string>();
  dispose(): void {
    if (typeof URL !== "undefined" && typeof URL.revokeObjectURL === "function") {
      for (const url of this.blobs.values()) URL.revokeObjectURL(url);
    }
    this.blobs.clear();
  }
}

export function newImageCache(): ImageCache {
  return new ImageCache();
}

/** تحويلٌ متجهيّ مباشر لأوامر EMF الهندسية الشائعة إلى SVG. */
function emfVectorSvg(bytes: Uint8Array): Uint8Array | null {
  if (bytes.length < 88) return null;
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const i32 = (o: number) => dv.getInt32(o, true), u32 = (o: number) => dv.getUint32(o, true);
  const left = i32(8), top = i32(12), right = i32(16), bottom = i32(20);
  const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
  const color = (v: number) => `#${(v & 255).toString(16).padStart(2,"0")}${((v >>> 8) & 255).toString(16).padStart(2,"0")}${((v >>> 16) & 255).toString(16).padStart(2,"0")}`;
  type Gdi = { kind: "pen"; color: string; width: number; none: boolean }
    | { kind: "brush"; color: string; none: boolean }
    | { kind: "font"; family: string; size: number; weight: number; italic: boolean };
  const objects = new Map<number, Gdi>();
  let pen: Extract<Gdi, { kind: "pen" }> = { kind: "pen", color: "#000000", width: 1, none: false };
  let brush: Extract<Gdi, { kind: "brush" }> = { kind: "brush", color: "#ffffff", none: true };
  let font: Extract<Gdi, { kind: "font" }> = { kind: "font", family: "sans-serif", size: 16, weight: 400, italic: false };
  let textColor = "#000000";
  let currentX = 0, currentY = 0;
  const shapes: string[] = [];
  let gradientSerial = 0;
  let path = "", pathReady = "", collectingPath = false;
  const point = (x: number, y: number, move = false) => {
    path += `${move || !path ? "M" : "L"}${esc(x)} ${esc(y)} `;
    currentX = x; currentY = y;
  };
  const emitPath = (mode: "fill" | "stroke" | "both") => {
    const d = (pathReady || path).trim();
    if (!d) return;
    const paint = mode === "fill"
      ? `fill="${brush.none ? "none" : brush.color}" stroke="none"`
      : mode === "stroke" ? style(false) : style(true);
    shapes.push(`<path d="${d}" ${paint}/>`);
  };
  const style = (fill = true) => `fill="${fill && !brush.none ? brush.color : "none"}" stroke="${pen.none ? "none" : pen.color}" stroke-width="${Math.max(0.5, pen.width)}"`;
  const esc = (n: number) => Number.isFinite(n) ? n : 0;
  const ellipticalArc = (l: number, t: number, r: number, b: number,
    sx: number, sy: number, ex: number, ey: number, close: "none" | "chord" | "pie") => {
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = Math.abs(r - l) / 2, ry = Math.abs(b - t) / 2;
    const a0 = Math.atan2((sy - cy) / Math.max(ry, 1), (sx - cx) / Math.max(rx, 1));
    const a1 = Math.atan2((ey - cy) / Math.max(ry, 1), (ex - cx) / Math.max(rx, 1));
    const startX = cx + rx * Math.cos(a0), startY = cy + ry * Math.sin(a0);
    const endX = cx + rx * Math.cos(a1), endY = cy + ry * Math.sin(a1);
    let delta = a1 - a0; while (delta <= 0) delta += Math.PI * 2;
    const arc = `M${esc(startX)} ${esc(startY)} A${esc(rx)} ${esc(ry)} 0 ${delta > Math.PI ? 1 : 0} 1 ${esc(endX)} ${esc(endY)}`;
    if (close === "pie") return `${arc} L${esc(cx)} ${esc(cy)} Z`;
    if (close === "chord") return `${arc} Z`;
    return arc;
  };
  for (let at = 0; at + 8 <= bytes.length;) {
    const type = u32(at), size = u32(at + 4);
    if (size < 8 || at + size > bytes.length) break;
    if (type === 38 && size >= 28) {
      const rawStyle = u32(at + 12), w = Math.abs(i32(at + 16));
      objects.set(u32(at + 8), { kind: "pen", color: color(u32(at + 24)), width: w || 1,
        none: (rawStyle & 0xf) === 5 });
    } else if (type === 39 && size >= 24) {
      const rawStyle = u32(at + 12);
      objects.set(u32(at + 8), { kind: "brush", color: color(u32(at + 16)), none: rawStyle === 1 });
    } else if (type === 37 && size >= 12) {
      const selected = objects.get(u32(at + 8));
      if (selected?.kind === "pen") pen = selected;
      else if (selected?.kind === "brush") brush = selected;
      else if (selected?.kind === "font") font = selected;
    } else if (type === 40 && size >= 12) objects.delete(u32(at + 8));
    else if (type === 24 && size >= 12) textColor = color(u32(at + 8));
    else if (type === 82 && size >= 104) {
      const familyBytes = bytes.subarray(at + 40, Math.min(at + 104, at + size));
      const family = new TextDecoder("utf-16le").decode(familyBytes).replace(/\0.*$/s, "").trim() || "sans-serif";
      objects.set(u32(at + 8), { kind: "font", family, size: Math.abs(i32(at + 12)) || 16,
        weight: Math.max(100, Math.min(900, i32(at + 28) || 400)), italic: bytes[at + 32] !== 0 });
    }
    else if ((type === 42 || type === 43) && size >= 24) {
      const x = i32(at + 8), y = i32(at + 12), w = i32(at + 16) - x, h = i32(at + 20) - y;
      shapes.push(type === 42
        ? `<ellipse cx="${esc(x + w / 2)}" cy="${esc(y + h / 2)}" rx="${Math.abs(w / 2)}" ry="${Math.abs(h / 2)}" ${style()}/>`
        : `<rect x="${esc(x)}" y="${esc(y)}" width="${Math.abs(w)}" height="${Math.abs(h)}" ${style()}/>`);
    } else if (type === 44 && size >= 32) {
      const l = i32(at + 8), t = i32(at + 12), r = i32(at + 16), b = i32(at + 20);
      const rx = Math.abs(i32(at + 24)) / 2, ry = Math.abs(i32(at + 28)) / 2;
      shapes.push(`<rect x="${esc(l)}" y="${esc(t)}" width="${Math.abs(r - l)}" height="${Math.abs(b - t)}" rx="${esc(rx)}" ry="${esc(ry)}" ${style()}/>`);
    } else if ((type === 45 || type === 46 || type === 47) && size >= 40) {
      const l = i32(at + 8), t = i32(at + 12), r = i32(at + 16), b = i32(at + 20);
      const d = ellipticalArc(l, t, r, b, i32(at + 24), i32(at + 28), i32(at + 32), i32(at + 36),
        type === 46 ? "chord" : type === 47 ? "pie" : "none");
      shapes.push(`<path d="${d}" ${style(type !== 45)}/>`);
    } else if ((type === 3 || type === 4 || type === 6) && size >= 28) {
      const count = u32(at + 24), points: string[] = [];
      for (let i = 0; i < count && at + 28 + i * 8 + 8 <= at + size; i++)
        points.push(`${i32(at + 28 + i * 8)},${i32(at + 32 + i * 8)}`);
      if (points.length && type === 6) {
        for (const item of points) {
          const [x, y] = item.split(",").map(Number);
          if (collectingPath) point(x!, y!); else {
            shapes.push(`<line x1="${currentX}" y1="${currentY}" x2="${x}" y2="${y}" ${style(false)}/>`);
            currentX = x!; currentY = y!;
          }
        }
      } else if (points.length) shapes.push(`<${type === 3 ? "polygon" : "polyline"} points="${points.join(" ")}" ${style(type === 3)}/>`);
    } else if ((type === 2 || type === 5) && size >= 28) {
      const count = u32(at + 24), coords: Array<[number, number]> = [];
      for (let i = 0; i < count && at + 28 + i * 8 + 8 <= at + size; i++)
        coords.push([i32(at + 28 + i * 8), i32(at + 32 + i * 8)]);
      let i = 0;
      if (type === 2 && coords.length) { point(coords[0]![0], coords[0]![1], true); i = 1; }
      else if (!path) point(currentX, currentY, true);
      for (; i + 2 < coords.length; i += 3) {
        const a = coords[i]!, b = coords[i + 1]!, c = coords[i + 2]!;
        path += `C${a[0]} ${a[1]} ${b[0]} ${b[1]} ${c[0]} ${c[1]} `;
        currentX = c[0]; currentY = c[1];
      }
      if (!collectingPath && path) { emitPath("stroke"); path = ""; }
    } else if (type === 59) { path = ""; pathReady = ""; collectingPath = true; }
    else if (type === 60) { pathReady = path; collectingPath = false; }
    else if (type === 61) { path += "Z "; }
    else if (type === 62) { emitPath("fill"); path = ""; pathReady = ""; }
    else if (type === 63) { emitPath("both"); path = ""; pathReady = ""; }
    else if (type === 64) { emitPath("stroke"); path = ""; pathReady = ""; }
    else if (type === 27 && size >= 16) {
      currentX = i32(at + 8); currentY = i32(at + 12);
      if (collectingPath) point(currentX, currentY, true);
    }
    else if (type === 54 && size >= 16) {
      const x = i32(at + 8), y = i32(at + 12);
      if (collectingPath) point(x, y);
      else shapes.push(`<line x1="${currentX}" y1="${currentY}" x2="${x}" y2="${y}" ${style(false)}/>`);
      currentX = x; currentY = y;
    } else if ((type === 83 || type === 84) && size >= 76) {
      const refX = i32(at + 36), refY = i32(at + 40), count = u32(at + 44), offset = u32(at + 48);
      const unit = type === 84 ? 2 : 1, end = at + offset + count * unit;
      if (count && offset >= 8 && end <= at + size) {
        const raw = bytes.subarray(at + offset, end);
        const value = new TextDecoder(type === 84 ? "utf-16le" : "windows-1252").decode(raw)
          .replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]!));
        const family = font.family.replace(/[&<>"']/g, "");
        shapes.push(`<text x="${refX}" y="${refY}" fill="${textColor}" font-family="${family}" font-size="${font.size}" font-weight="${font.weight}"${font.italic ? ' font-style="italic"' : ""}>${value}</text>`);
      }
    } else if (type === 118 && size >= 36) {
      // EMR_GRADIENTFILL: كل TRIVERTEX حجمه 16 بايت، ثم GRADIENT_RECT
      // (فهرسا رأسين). Word يستعمله في زخارف/أغلفة EMF القديمة بدل bitmap.
      const vertexCount = u32(at + 24), meshCount = u32(at + 28), mode = u32(at + 32);
      const verticesAt = at + 36, meshAt = verticesAt + vertexCount * 16;
      const vertex = (index: number) => {
        const o = verticesAt + index * 16;
        if (index >= vertexCount || o + 16 > at + size) return null;
        const channel = (offset: number) => Math.round(dv.getUint16(o + offset, true) / 257);
        return { x: i32(o), y: i32(o + 4), color: `#${channel(8).toString(16).padStart(2,"0")}${channel(10).toString(16).padStart(2,"0")}${channel(12).toString(16).padStart(2,"0")}` };
      };
      if ((mode === 0 || mode === 1) && meshAt + meshCount * 8 <= at + size) {
        for (let i = 0; i < meshCount; i++) {
          const a = vertex(u32(meshAt + i * 8)), b = vertex(u32(meshAt + i * 8 + 4));
          if (!a || !b) continue;
          const id = `emfGradient${gradientSerial++}`;
          const direction = mode === 0 ? 'x1="0%" y1="0%" x2="100%" y2="0%"' : 'x1="0%" y1="0%" x2="0%" y2="100%"';
          shapes.push(`<defs><linearGradient id="${id}" ${direction}><stop offset="0%" stop-color="${a.color}"/><stop offset="100%" stop-color="${b.color}"/></linearGradient></defs><rect x="${Math.min(a.x, b.x)}" y="${Math.min(a.y, b.y)}" width="${Math.abs(b.x - a.x)}" height="${Math.abs(b.y - a.y)}" fill="url(#${id})" stroke="none"/>`);
        }
      }
    }
    at += size;
  }
  if (!shapes.length) return null;
  return new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" preserveAspectRatio="xMidYMid meet">${shapes.join("")}</svg>`);
}

/** تحويل السجلات المتجهية الأساسية في WMF القديم إلى SVG بدل إظهار صورة تالفة. */
function wmfVectorSvg(bytes: Uint8Array, placeable: boolean): Uint8Array | null {
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const u16 = (o: number) => dv.getUint16(o, true), i16 = (o: number) => dv.getInt16(o, true);
  const u32 = (o: number) => dv.getUint32(o, true);
  const color = (v: number) => `#${(v & 255).toString(16).padStart(2,"0")}${((v >>> 8) & 255).toString(16).padStart(2,"0")}${((v >>> 16) & 255).toString(16).padStart(2,"0")}`;
  type Obj = { kind: "pen"; color: string; width: number; none: boolean }
    | { kind: "brush"; color: string; width: number; none: boolean }
    | { kind: "font"; family: string; size: number; weight: number; italic: boolean };
  const objects: Array<Obj | null> = [];
  let pen: Extract<Obj, { kind: "pen" }> = { kind: "pen", color: "#000000", width: 1, none: false };
  let brush: Extract<Obj, { kind: "brush" }> = { kind: "brush", color: "#ffffff", width: 1, none: true };
  let font: Extract<Obj, { kind: "font" }> = { kind: "font", family: "sans-serif", size: 16, weight: 400, italic: false };
  let textColor = "#000000";
  let left = placeable ? i16(6) : 0, top = placeable ? i16(8) : 0;
  let width = placeable ? Math.max(1, i16(10) - left) : 1;
  let height = placeable ? Math.max(1, i16(12) - top) : 1;
  let x = 0, y = 0;
  const shapes: string[] = [];
  const paint = (fill = true) => `fill="${fill && !brush.none ? brush.color : "none"}" stroke="${pen.none ? "none" : pen.color}" stroke-width="${Math.max(.5, pen.width)}"`;
  const arcPath = (l: number, t: number, r: number, b: number,
    sx: number, sy: number, ex: number, ey: number, close: "none" | "chord" | "pie") => {
    const cx = (l + r) / 2, cy = (t + b) / 2, rx = Math.abs(r - l) / 2, ry = Math.abs(b - t) / 2;
    const a0 = Math.atan2((sy - cy) / Math.max(ry, 1), (sx - cx) / Math.max(rx, 1));
    const a1 = Math.atan2((ey - cy) / Math.max(ry, 1), (ex - cx) / Math.max(rx, 1));
    let delta = a1 - a0; while (delta <= 0) delta += Math.PI * 2;
    const x0 = cx + rx * Math.cos(a0), y0 = cy + ry * Math.sin(a0);
    const x1 = cx + rx * Math.cos(a1), y1 = cy + ry * Math.sin(a1);
    const arc = `M${x0} ${y0} A${rx} ${ry} 0 ${delta > Math.PI ? 1 : 0} 1 ${x1} ${y1}`;
    return close === "pie" ? `${arc} L${cx} ${cy} Z` : close === "chord" ? `${arc} Z` : arc;
  };
  const addObject = (obj: Obj) => {
    const free = objects.findIndex((item) => item == null);
    if (free < 0) objects.push(obj); else objects[free] = obj;
  };
  for (let at = placeable ? 40 : 18; at + 6 <= bytes.length;) {
    const words = u32(at), size = words * 2, fn = u16(at + 4), p = at + 6;
    if (words < 3 || at + size > bytes.length) break;
    if (fn === 0x020b && size >= 10) { top = i16(p); left = i16(p + 2); }
    else if (fn === 0x020c && size >= 10) { height = Math.max(1, Math.abs(i16(p))); width = Math.max(1, Math.abs(i16(p + 2))); }
    else if (fn === 0x0209 && size >= 10) textColor = color(u32(p));
    else if (fn === 0x0214 && size >= 10) { y = i16(p); x = i16(p + 2); }
    else if (fn === 0x0213 && size >= 10) {
      const ny = i16(p), nx = i16(p + 2);
      shapes.push(`<line x1="${x}" y1="${y}" x2="${nx}" y2="${ny}" ${paint(false)}/>`); x = nx; y = ny;
    } else if ((fn === 0x0418 || fn === 0x041b) && size >= 14) {
      const bottom = i16(p), right = i16(p + 2), t = i16(p + 4), l = i16(p + 6);
      shapes.push(fn === 0x0418
        ? `<ellipse cx="${(l + right) / 2}" cy="${(t + bottom) / 2}" rx="${Math.abs(right - l) / 2}" ry="${Math.abs(bottom - t) / 2}" ${paint()}/>`
        : `<rect x="${l}" y="${t}" width="${Math.abs(right - l)}" height="${Math.abs(bottom - t)}" ${paint()}/>`);
    } else if (fn === 0x061c && size >= 18) {
      const ellipseH = Math.abs(i16(p)), ellipseW = Math.abs(i16(p + 2));
      const bottom = i16(p + 4), right = i16(p + 6), t = i16(p + 8), l = i16(p + 10);
      shapes.push(`<rect x="${l}" y="${t}" width="${Math.abs(right - l)}" height="${Math.abs(bottom - t)}" rx="${ellipseW / 2}" ry="${ellipseH / 2}" ${paint()}/>`);
    } else if ((fn === 0x0817 || fn === 0x081a || fn === 0x0830) && size >= 22) {
      const ey = i16(p), ex = i16(p + 2), sy = i16(p + 4), sx = i16(p + 6);
      const bottom = i16(p + 8), right = i16(p + 10), t = i16(p + 12), l = i16(p + 14);
      const close = fn === 0x081a ? "pie" : fn === 0x0830 ? "chord" : "none";
      shapes.push(`<path d="${arcPath(l, t, right, bottom, sx, sy, ex, ey, close)}" ${paint(close !== "none")}/>`);
    } else if ((fn === 0x0324 || fn === 0x0325) && size >= 10) {
      const count = u16(p), points: string[] = [];
      for (let i = 0; i < count && p + 2 + i * 4 + 4 <= at + size; i++)
        points.push(`${i16(p + 2 + i * 4)},${i16(p + 4 + i * 4)}`);
      if (points.length) shapes.push(`<${fn === 0x0324 ? "polygon" : "polyline"} points="${points.join(" ")}" ${paint(fn === 0x0324)}/>`);
    } else if (fn === 0x02fa && size >= 16) {
      addObject({ kind: "pen", none: (u16(p) & 0xf) === 5, width: Math.abs(i16(p + 2)) || 1, color: color(u32(p + 6)) });
    } else if (fn === 0x02fc && size >= 14) {
      addObject({ kind: "brush", none: u16(p) === 1, width: 1, color: color(u32(p + 2)) });
    } else if (fn === 0x02fb && size >= 24) {
      const faceEnd = Math.min(at + size, p + 50), raw = bytes.subarray(p + 18, faceEnd);
      const family = new TextDecoder("windows-1252").decode(raw).replace(/\0.*$/s, "").trim() || "sans-serif";
      addObject({ kind: "font", family, size: Math.abs(i16(p)) || 16,
        weight: Math.max(100, Math.min(900, i16(p + 8) || 400)), italic: bytes[p + 10] !== 0 });
    } else if (fn === 0x012d && size >= 8) {
      const selected = objects[u16(p)];
      if (selected?.kind === "pen") pen = selected;
      else if (selected?.kind === "brush") brush = selected;
      else if (selected?.kind === "font") font = selected;
    } else if (fn === 0x01f0 && size >= 8) objects[u16(p)] = null;
    else if (fn === 0x0521 && size >= 12) {
      const count = u16(p), padded = count + (count & 1), coords = p + 2 + padded;
      if (coords + 4 <= at + size) {
        const value = new TextDecoder("windows-1252").decode(bytes.subarray(p + 2, p + 2 + count))
          .replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]!));
        const family = font.family.replace(/[&<>"']/g, "");
        shapes.push(`<text x="${i16(coords + 2)}" y="${i16(coords)}" fill="${textColor}" font-family="${family}" font-size="${font.size}" font-weight="${font.weight}"${font.italic ? ' font-style="italic"' : ""}>${value}</text>`);
      }
    } else if (fn === 0x0a32 && size >= 14) {
      // META_EXTTEXTOUT: بخلاف TEXTOUT يحمل options/rect اختياريًا ومصفوفة
      // dx لكل محرف. نحفظ dx عبر tspans كي لا تنهار زخارف WMF ذات التباعد الصريح.
      const ty = i16(p), tx = i16(p + 2), count = u16(p + 4), options = u16(p + 6);
      const hasRect = (options & 0x0006) !== 0, stringAt = p + 8 + (hasRect ? 8 : 0);
      const padded = count + (count & 1), dxAt = stringAt + padded;
      if (count && stringAt + count <= at + size) {
        const rawValue = new TextDecoder("windows-1252").decode(bytes.subarray(stringAt, stringAt + count));
        const escaped = (value: string) => value.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" }[ch]!));
        const family = font.family.replace(/[&<>"']/g, "");
        let content = escaped(rawValue);
        if (dxAt + count * 2 <= at + size) {
          let cursor = tx; content = "";
          for (let i = 0; i < rawValue.length; i++) {
            content += `<tspan x="${cursor}">${escaped(rawValue[i]!)}</tspan>`;
            cursor += i16(dxAt + i * 2);
          }
        }
        shapes.push(`<text x="${tx}" y="${ty}" fill="${textColor}" font-family="${family}" font-size="${font.size}" font-weight="${font.weight}"${font.italic ? ' font-style="italic"' : ""}>${content}</text>`);
      }
    }
    at += size;
  }
  if (!shapes.length) return null;
  return new TextEncoder().encode(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${left} ${top} ${width} ${height}" preserveAspectRatio="xMidYMid meet">${shapes.join("")}</svg>`);
}

/** PNG بلا مكتبة خارجية: RGBA + deflate stored blocks، مناسب لتحويل DIB في المتصفح. */
function pngFromBgra32(source: Uint8Array, at: number, width: number, height: number, bottomUp: boolean): Uint8Array {
  const raw = new Uint8Array((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    const srcY = bottomUp ? height - 1 - y : y;
    let src = at + srcY * width * 4, dst = y * (width * 4 + 1) + 1;
    for (let x = 0; x < width; x++, src += 4, dst += 4) {
      raw[dst] = source[src + 2]!; raw[dst + 1] = source[src + 1]!;
      raw[dst + 2] = source[src]!; raw[dst + 3] = 255;
    }
  }
  const blocks = Math.ceil(raw.length / 65535);
  const z = new Uint8Array(2 + raw.length + blocks * 5 + 4);
  z[0] = 0x78; z[1] = 0x01;
  let zi = 2, ri = 0;
  while (ri < raw.length) {
    const len = Math.min(65535, raw.length - ri), final = ri + len === raw.length;
    z[zi++] = final ? 1 : 0; z[zi++] = len & 255; z[zi++] = len >>> 8;
    const inv = (~len) & 0xffff; z[zi++] = inv & 255; z[zi++] = inv >>> 8;
    z.set(raw.subarray(ri, ri + len), zi); zi += len; ri += len;
  }
  let a = 1, b = 0;
  for (const byte of raw) { a = (a + byte) % 65521; b = (b + a) % 65521; }
  const adler = ((b << 16) | a) >>> 0;
  z[zi++] = adler >>> 24; z[zi++] = adler >>> 16; z[zi++] = adler >>> 8; z[zi++] = adler;
  const crc32 = (type: Uint8Array, data: Uint8Array) => {
    let crc = 0xffffffff;
    const update = (items: Uint8Array) => { for (const byte of items) {
      crc ^= byte; for (let k = 0; k < 8; k++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    } };
    update(type); update(data);
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (name: string, data: Uint8Array) => {
    const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
    const type = new TextEncoder().encode(name); view.setUint32(0, data.length); out.set(type, 4); out.set(data, 8);
    view.setUint32(8 + data.length, crc32(type, data)); return out;
  };
  const ihdr = new Uint8Array(13), hv = new DataView(ihdr.buffer);
  hv.setUint32(0, width); hv.setUint32(4, height); ihdr.set([8, 6, 0, 0, 0], 8);
  const parts = [new Uint8Array([137,80,78,71,13,10,26,10]), chunk("IHDR", ihdr), chunk("IDAT", z), chunk("IEND", new Uint8Array())];
  const total = parts.reduce((n, p) => n + p.length, 0), png = new Uint8Array(total);
  let offset = 0; for (const part of parts) { png.set(part, offset); offset += part.length; }
  return png;
}

export function rasterPayload(bytes: Uint8Array): { bytes: Uint8Array; mime: string } | null {
  const u32 = (at: number) => at + 4 <= bytes.length
    ? new DataView(bytes.buffer, bytes.byteOffset + at, 4).getUint32(0, true) : 0;
  const pngAt = (data: Uint8Array, i: number) => data[i] === 0x89 && data[i + 1] === 0x50
    && data[i + 2] === 0x4e && data[i + 3] === 0x47
    && data[i + 12] === 0x49 && data[i + 13] === 0x48
    && data[i + 14] === 0x44 && data[i + 15] === 0x52;
  const jpgAt = (data: Uint8Array, i: number) => data[i] === 0xff && data[i + 1] === 0xd8
    && data[i + 2] === 0xff && [0xe0, 0xe1, 0xe8, 0xdb, 0xee].includes(data[i + 3] ?? -1);
  if (pngAt(bytes, 0)) return { bytes, mime: "image/png" };
  if (jpgAt(bytes, 0)) return { bytes, mime: "image/jpeg" };
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46)
    return { bytes, mime: "image/gif" };
  if (bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
      && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50)
    return { bytes, mime: "image/webp" };
  if (bytes[0] === 0x42 && bytes[1] === 0x4d) return { bytes, mime: "image/bmp" };
  const head = new TextDecoder().decode(bytes.subarray(0, Math.min(bytes.length, 512))).trimStart();
  if (head.startsWith("<svg") || (head.startsWith("<?xml") && head.includes("<svg")))
    return { bytes, mime: "image/svg+xml" };
  // إصلاح فلاتر: بعض ملفات EMF حاوياتٌ لصورة نقطية؛ نستخرج توقيعها الداخلي.
  if (bytes[0] === 0x01 && bytes[1] === 0x00 && bytes[2] === 0x00 && bytes[3] === 0x00) {
    for (let i = 1; i < bytes.length - 8; i++) {
      if (pngAt(bytes, i)) return { bytes: bytes.subarray(i), mime: "image/png" };
      if (jpgAt(bytes, i)) {
        let end = i + 4;
        while (end + 1 < bytes.length && !(bytes[end] === 0xff && bytes[end + 1] === 0xd9)) end++;
        if (end + 1 < bytes.length) return { bytes: bytes.subarray(i, end + 2), mime: "image/jpeg" };
      }
    }
    // ‏EMR_STRETCHDIBITS (النوع 81): Word كثيرًا ما يضع الغلافَ كـDIB
    // كامل داخل EMF، بلا توقيع PNG/JPEG. نضيف ترويسة BMP القياسية فقط؛
    // بيانات BITMAPINFO والبكسلات تبقى كما هي بلا إعادة ضغط أو فقدان.
    for (let record = 0; record + 8 <= bytes.length;) {
      const type = u32(record);
      const size = u32(record + 4);
      if (size < 8 || record + size > bytes.length) break;
      if (type === 81 && size >= 80) {
        const offBmi = u32(record + 48), cbBmi = u32(record + 52);
        const offBits = u32(record + 56), cbBits = u32(record + 60);
        if (cbBmi >= 40 && cbBits > 0 && offBmi + cbBmi <= size && offBits + cbBits <= size) {
          const dibAt = record + offBmi;
          const dibView = new DataView(bytes.buffer, bytes.byteOffset + dibAt, cbBmi);
          const dibW = Math.abs(dibView.getInt32(4, true));
          const dibH = Math.abs(dibView.getInt32(8, true));
          const bitCount = dibView.getUint16(14, true);
          const compression = dibView.getUint32(16, true);
          // متصفحاتٌ عديدة ترفض DIB ‏32-bit الآتي من GDI أو تتعامل مع قناة
          // alpha غير المهيأة كصورة تالفة. نحوله إلى BGR ‏24-bit قياسيًا.
          if (dibW > 0 && dibH > 0 && bitCount === 32 && compression === 0
              && dibW * dibH * 4 <= cbBits) {
            const source = record + offBits;
            return { bytes: pngFromBgra32(bytes, source, dibW, dibH, dibView.getInt32(8, true) > 0), mime: "image/png" };
          }
          const bmp = new Uint8Array(14 + cbBmi + cbBits);
          const view = new DataView(bmp.buffer);
          bmp[0] = 0x42; bmp[1] = 0x4d;
          view.setUint32(2, bmp.length, true);
          view.setUint32(10, 14 + cbBmi, true);
          bmp.set(bytes.subarray(record + offBmi, record + offBmi + cbBmi), 14);
          bmp.set(bytes.subarray(record + offBits, record + offBits + cbBits), 14 + cbBmi);
          return { bytes: bmp, mime: "image/bmp" };
        }
      }
      record += size;
    }
    const vector = emfVectorSvg(bytes);
    return vector ? { bytes: vector, mime: "image/svg+xml" } : null;
  }
  // ‏WMF: سجلات META_DIB* تضع BITMAPINFOHEADER ثم جدول الألوان والبكسلات.
  // نبحث عن DIB متّسق حسابيًا ونغلفه بـBITMAPFILEHEADER؛ لا نقبل تطابقًا
  // حدسيًا ناقصًا حتى لا نرسل للمتصفح صورةً تالفة.
  const placeableWmf = bytes[0] === 0xd7 && bytes[1] === 0xcd
    && bytes[2] === 0xc6 && bytes[3] === 0x9a;
  const standardWmf = bytes[0] === 0x01 && bytes[1] === 0x00
    && bytes[2] === 0x09 && bytes[3] === 0x00;
  if (placeableWmf || standardWmf) {
    for (let at = 0; at + 40 <= bytes.length; at += 2) {
      if (u32(at) !== 40) continue;
      const dv = new DataView(bytes.buffer, bytes.byteOffset + at, 40);
      const width = Math.abs(dv.getInt32(4, true)), height = Math.abs(dv.getInt32(8, true));
      const planes = dv.getUint16(12, true), bpp = dv.getUint16(14, true);
      const compression = dv.getUint32(16, true), clrUsed = dv.getUint32(32, true);
      if (!width || !height || width > 20000 || height > 20000 || planes !== 1
          || ![1, 4, 8, 24].includes(bpp) || compression !== 0) continue;
      const palette = bpp <= 8 ? (clrUsed || (1 << bpp)) * 4 : 0;
      const row = Math.ceil(width * bpp / 32) * 4;
      const pixelBytes = row * height;
      const bitsAt = at + 40 + palette;
      if (bitsAt + pixelBytes > bytes.length) continue;
      const bmp = new Uint8Array(14 + 40 + palette + pixelBytes);
      const out = new DataView(bmp.buffer);
      bmp[0] = 0x42; bmp[1] = 0x4d;
      out.setUint32(2, bmp.length, true); out.setUint32(10, 54 + palette, true);
      bmp.set(bytes.subarray(at, bitsAt + pixelBytes), 14);
      return { bytes: bmp, mime: "image/bmp" };
    }
    const vector = wmfVectorSvg(bytes, placeableWmf);
    if (vector) return { bytes: vector, mime: "image/svg+xml" };
  }
  // التنسيق غير المدعوم لا يُرسل كـoctet-stream؛ ذلك كان يُظهر رمز صورة تالفة.
  return null;
}

/** يحلّ بايتات الصورة من rId عبر علاقات الجزء المالك (part) ثم mediaFiles. */
export function resolveImageBytes(
  rId: string | null,
  part: string | null,
  model: DocumentModelV0,
): Uint8Array | null {
  if (!rId) return null;
  const rels = (part ? model.partRels.get(part) : null) ?? model.partRels.get("document.xml");
  const target = rels?.get(rId) ?? model.relTargets.get(rId);
  if (!target) return null;
  const file = target.replace(/^word\//, "").replace(/^media\//, "");
  return model.mediaFiles.get(file) ?? model.mediaFiles.get(target) ?? null;
}

/** عنوان blob للصورة (مع كاش) — أو null إن لا DOM/blob URL. */
export function imageUrl(bytes: Uint8Array, cache: ImageCache): string | null {
  const hasBlob = typeof URL !== "undefined" && typeof URL.createObjectURL === "function";
  if (!hasBlob) return null;
  const payload = rasterPayload(bytes);
  if (!payload) return null;
  // النوعُ والطول وحدهما لا يميّزان صورتين متساويتَي الحجم؛ بصمة FNV تمنع
  // أن يعرض الكاش صورةً مكان أخرى في الكتب الغنية بالرسوم.
  let hash = 0x811c9dc5;
  for (const byte of payload.bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  const key = `${payload.mime}:${payload.bytes.length}:${hash >>> 0}`;
  const hit = cache.blobs.get(key);
  if (hit) return hit;
  const url = URL.createObjectURL(new Blob([payload.bytes as BlobPart], { type: payload.mime }));
  cache.blobs.set(key, url);
  return url;
}

export function anchorTransformCss(anc: FloatAnchor): string[] {
  const out: string[] = [];
  // Word يعكس هندسة مربع النص لا الحروف التي داخله؛ تطبيق scale على الحاوية
  // كان يجعل PAGE والعربية مرآتيين. الدوران يبقى لأنه يخص اتجاه الصندوق كله.
  if (!anc.textBox?.length && anc.flipH) out.push("scaleX(-1)");
  if (!anc.textBox?.length && anc.flipV) out.push("scaleY(-1)");
  if (anc.rotDeg) out.push(`rotate(${anc.rotDeg}deg)`);
  return out;
}

/** مرشح SVG حقيقي للـduotone: يحوّل شدة الإضاءة خطيًا بين اللونين المحددين. */
function duotoneFilterId(low: string, high: string): string | null {
  if (typeof document === "undefined" || !document.body) return null;
  const id = `word-duotone-${low}-${high}`.replace(/[^a-zA-Z0-9_-]/g, "");
  if (document.getElementById(id)) return id;
  const ns = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("width", "0"); svg.setAttribute("height", "0");
  svg.style.position = "absolute";
  const filter = document.createElementNS(ns, "filter");
  filter.setAttribute("id", id); filter.setAttribute("color-interpolation-filters", "sRGB");
  const matrix = document.createElementNS(ns, "feColorMatrix");
  const rgb = (hex: string) => [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16) / 255);
  const lo = rgb(low), hi = rgb(high);
  const rows = [0, 1, 2].map(channel => {
    const d = hi[channel]! - lo[channel]!;
    return `${0.2126 * d} ${0.7152 * d} ${0.0722 * d} 0 ${lo[channel]}`;
  });
  matrix.setAttribute("type", "matrix");
  matrix.setAttribute("values", `${rows.join(" ")} 0 0 0 1 0`);
  filter.appendChild(matrix); svg.appendChild(filter); document.body.appendChild(svg);
  return id;
}

function shapeRadius(prst: string): string | null {
  if (prst.includes("roundRect")) return "12px";
  if (prst === "ellipse" || prst === "circle") return "50%";
  if (prst === "diamond") return "4px";
  return null;
}

/** خصائص إطار الشكل المشتركة بين الشكل الخالص ومربع النص ذي الشكل.
 * لا نمرر أطوال dashstyle إلى border-style لأنها CSS غير صالحة. */
export function shapeFrameCss(shape: NonNullable<FloatAnchor["shape"]>): string[] {
  const radius = shapeRadius(shape.prst);
  const gradient = shape.gradient?.stops.length
    ? `linear-gradient(${shape.gradient.angle}deg,${shape.gradient.stops.map(stop => `#${stop.color} ${Math.round(stop.pos * 100000) / 1000}%`).join(",")})`
    : "";
  return [
    gradient ? `background:${gradient}` : shape.fill ? `background-color:#${shape.fill}` : "",
    shape.stroke
      ? `border:${px(twipsToPx(shape.strokeW || 40))} ${shape.lineStyle && shape.lineStyle !== "single" ? "double" : shape.dash?.length ? "dashed" : "solid"} #${shape.stroke}`
      : "",
    radius ? `border-radius:${radius}` : "",
    shape.prst === "hexagon"
      ? "clip-path:polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)"
      : "",
  ].filter(Boolean);
}

/** يبني عنصر الصورة/الشكل للأبعاد المعطاة (twips). */
export function anchorToElement(anc: FloatAnchor, ctx: RenderCtx): HTMLElement | null {
  const w = px(twipsToPx(anc.extentW));
  const h = px(twipsToPx(anc.extentH));
  const base = ["width:" + w, "height:" + h, "box-sizing:border-box"];
  const transform = anchorTransformCss(anc);
  if (transform.length) base.push(`transform:${transform.join(" ")}`);
  const effects = anc.imageEffects;
  if (effects?.opacity != null) base.push(`opacity:${effects.opacity}`);
  const filters: string[] = [];
  if (effects?.grayscale) filters.push("grayscale(1)");
  if (effects?.brightness != null) filters.push(`brightness(${Math.max(0, effects.brightness)})`);
  if (effects?.contrast != null) filters.push(`contrast(${Math.max(0, effects.contrast)})`);
  if (effects?.softEdge) filters.push(`blur(${Math.max(0, effects.softEdge / 3)}px)`);
  if (effects?.duotone) {
    const id = duotoneFilterId(effects.duotone.low, effects.duotone.high);
    if (id) filters.push(`url(#${id})`);
  }
  if (filters.length) base.push(`filter:${filters.join(" ")}`);
  const rgba = (hex: string, opacity: number) => {
    const clean = hex.replace(/^#/, "").padEnd(6, "0");
    return `rgba(${parseInt(clean.slice(0, 2), 16)},${parseInt(clean.slice(2, 4), 16)},${parseInt(clean.slice(4, 6), 16)},${opacity})`;
  };
  const shadows: string[] = [];
  if (effects?.shadow) shadows.push(`${effects.shadow.x}px ${effects.shadow.y}px ${effects.shadow.blur}px ${rgba(effects.shadow.color, effects.shadow.opacity)}`);
  if (effects?.glow) shadows.push(`0 0 ${effects.glow.radius}px ${rgba(effects.glow.color, effects.glow.opacity)}`);
  if (shadows.length) base.push(`box-shadow:${shadows.join(",")}`);
  if (effects?.border) {
    const dash = effects.border.dash?.toLowerCase();
    const style = dash?.includes("dash") ? "dashed" : dash?.includes("dot") ? "dotted" : "solid";
    base.push(`border:${effects.border.width}px ${style} #${effects.border.color}`);
  }
  if (effects?.reflection) {
    const r = effects.reflection;
    base.push(`-webkit-box-reflect:below ${Math.max(0, r.distance)}px linear-gradient(to bottom,rgba(0,0,0,${r.startOpacity}),rgba(0,0,0,${r.endOpacity}))`);
  }

  // صورة
  const bytes = anc.rId ? resolveImageBytes(anc.rId, anc.part ?? null, ctx.model) : null;
  if (bytes) {
    const url = imageUrl(bytes, ctx.imageCache);
    if (!url) return null;
    const crop = anc.srcRect;
    if (crop && (crop.l || crop.t || crop.r || crop.b)) {
      const remW = Math.max(1 - crop.l - crop.r, 0.001);
      const remH = Math.max(1 - crop.t - crop.b, 0.001);
      const frame = el("span", {
        class: "flt-img flt-img-crop",
        style: css([...base, "display:block", "position:relative", "overflow:hidden"]),
      });
      frame.appendChild(el("img", {
        class: "flt-img-crop-source",
        src: url,
        alt: anc.alt ?? "",
        ...(anc.title ? { title: anc.title } : {}),
        style: css([
          "position:absolute", `width:${(100 / remW).toFixed(4)}%`,
          `height:${(100 / remH).toFixed(4)}%`,
          `left:${(-crop.l * 100 / remW).toFixed(4)}%`,
          `top:${(-crop.t * 100 / remH).toFixed(4)}%`,
          "max-width:none", "object-fit:fill",
        ]),
      }));
      return frame;
    }
    return el("img", {
      class: "flt-img",
      src: url,
      alt: anc.alt ?? "",
      ...(anc.title ? { title: anc.title } : {}),
      // The application shell deliberately applies `img { max-width:100% }` to
      // ordinary responsive media.  A Word drawing is not ordinary media: its
      // wp:extent is part of pagination.  Clamping only the width while keeping
      // the explicit height both distorts the picture and changes the line box
      // which owns it.  Keep the authoritative OOXML extent here; the whole Word
      // page is scaled by the reader as one unit when the viewport is narrower.
      style: css([...base, "display:block", "max-width:none", "object-fit:" + (anc.stretch ? "fill" : "contain")]),
    });
  }

  // مربّع نصٍّ (VML/DrawingML)
  if (anc.textBox?.length) {
    const align = anc.boxAnchor === "ctr" ? "center" : anc.boxAnchor === "b" ? "flex-end" : "flex-start";
    const pad = anc.boxIns ? [
      `padding-top:${px(twipsToPx(anc.boxIns.t))}`,
      `padding-bottom:${px(twipsToPx(anc.boxIns.b))}`,
      `padding-left:${px(twipsToPx(anc.boxIns.l))}`,
      `padding-right:${px(twipsToPx(anc.boxIns.r))}`,
    ] : [];
    const frame = el("div", {
      class: "flt-textbox",
      "data-word-frame": anc.shape?.prst ?? "textbox",
      style: css([...base, ...shapeFrameCss(anc.shape ?? {
        prst: "rect", fill: null, stroke: null, strokeW: 0, adj: null,
      }), "position:relative", "overflow:hidden"]),
    });
    const fillBytes = anc.shapeFill ? resolveImageBytes(anc.shapeFill.rId, anc.part ?? null, ctx.model) : null;
    const fillUrl = fillBytes ? imageUrl(fillBytes, ctx.imageCache) : null;
    if (fillUrl && anc.shapeFill) {
      const bg = el("span", { class: "flt-textbox-fill", "aria-hidden": "true",
        style: css(["position:absolute", "inset:0", "z-index:0", "overflow:hidden", "pointer-events:none"]) });
      if (anc.shapeFill.mode === "tile") {
        bg.setAttribute("style", css(["position:absolute", "inset:0", "z-index:0", "pointer-events:none",
          `background-image:url(${fillUrl})`, "background-repeat:repeat"]));
      } else {
        const crop = anc.shapeFill.srcRect;
        const remW = Math.max(1 - (crop?.l ?? 0) - (crop?.r ?? 0), .001);
        const remH = Math.max(1 - (crop?.t ?? 0) - (crop?.b ?? 0), .001);
        bg.appendChild(el("img", { src: fillUrl, alt: "", style: css(["position:absolute", "max-width:none",
          `width:${(100 / remW).toFixed(4)}%`, `height:${(100 / remH).toFixed(4)}%`,
          `left:${(-((crop?.l ?? 0) * 100) / remW).toFixed(4)}%`,
          `top:${(-((crop?.t ?? 0) * 100) / remH).toFixed(4)}%`]) }));
      }
      frame.appendChild(bg);
    }
    frame.appendChild(el("div", { class: "flt-textbox-content", style: css(["position:relative", "z-index:1",
      "box-sizing:border-box", "width:100%", "height:100%", "display:flex", "flex-direction:column",
      `justify-content:${align}`, ...pad]) },
    ...anc.textBox.map((p) => paragraphToElement(p, ctx)).filter((x): x is HTMLElement => !!x)));
    return frame;
  }

  // مجموعة أشكال (v:group / wpg:wgp)
  if (anc.groupChildren?.length) {
    const group = el("div", { class: "flt-group", style: css([...base, "position:relative"]) });
    for (const child of anc.groupChildren) {
      const position = ["position:absolute", `left:${px(twipsToPx(child.x))}`,
        `top:${px(twipsToPx(child.y))}`, `width:${px(twipsToPx(child.w))}`,
        `height:${px(twipsToPx(child.h))}`, "box-sizing:border-box"];
      const transforms = [child.flipH ? "scaleX(-1)" : "", child.flipV ? "scaleY(-1)" : "",
        child.rotDeg ? `rotate(${child.rotDeg}deg)` : ""].filter(Boolean);
      if (transforms.length) position.push(`transform:${transforms.join(" ")}`);
      if (child.rId) {
        const cb = resolveImageBytes(child.rId, anc.part ?? null, ctx.model);
        const url = cb ? imageUrl(cb, ctx.imageCache) : null;
        if (!url) continue;
        const crop = child.srcRect;
        if (crop && (crop.l || crop.t || crop.r || crop.b)) {
          const remW = Math.max(1 - crop.l - crop.r, .001), remH = Math.max(1 - crop.t - crop.b, .001);
          const frame = el("span", { class: "flt-group-child flt-img-crop",
            style: css([...position, "display:block", "overflow:hidden"]) });
          frame.appendChild(el("img", { src: url, alt: "", style: css(["position:absolute",
            `width:${(100 / remW).toFixed(4)}%`, `height:${(100 / remH).toFixed(4)}%`,
            `left:${(-crop.l * 100 / remW).toFixed(4)}%`, `top:${(-crop.t * 100 / remH).toFixed(4)}%`,
            "max-width:none", "object-fit:fill"]) }));
          group.appendChild(frame);
        } else group.appendChild(el("img", { class: "flt-group-child", src: url, alt: "",
          style: css([...position, "max-width:none", "object-fit:contain"]) }));
      } else if (child.shape || child.text) {
        group.appendChild(el("div", { class: "flt-group-child flt-group-shape",
          "data-word-frame": child.shape?.prst ?? "textbox",
          style: css([...position, ...(child.shape ? shapeFrameCss(child.shape) : []),
            "display:flex", "align-items:center", "justify-content:center", "text-align:center", "overflow:hidden"]) }, child.text ?? ""));
      }
    }
    return group;
  }

  // رسم SmartArt (diagram)
  if (anc.diagram?.length) {
    const holder = el("div", { class: "flt-diagram", style: css([...base, "position:relative"]) });
    for (const sh of anc.diagram) {
      holder.appendChild(el("div", {
        class: "flt-diagram-shape",
        style: css([
          "position:absolute",
          `left:${px(twipsToPx(sh.x))}`,
          `top:${px(twipsToPx(sh.y))}`,
          `width:${px(twipsToPx(sh.w))}`,
          `height:${px(twipsToPx(sh.h))}`,
          sh.fill ? `background-color:#${sh.fill}` : "",
          sh.prst === "ellipse" || sh.prst === "circle" ? "border-radius:50%" : "",
          `font-size:${px(twipsToPx(sh.em))}`,
          "display:flex",
          "align-items:center",
          "justify-content:center",
          "text-align:center",
          "box-sizing:border-box",
          "overflow:hidden",
        ]),
      }, sh.text));
    }
    return holder;
  }

  // شكلٌ متجه
  if (anc.shape) {
    const s = anc.shape;
    return el("div", {
      class: "flt-shape",
      "data-word-frame": s.prst,
      style: css([...base, ...shapeFrameCss(s)]),
    });
  }

  // صورة بلا rId أو شكلٌ مجهول — صندوق شفاف
  return el("div", { class: "flt-unknown", style: css([...base]) });
}

/** المراسي السطرية للفقرة ⟵ عناصر inline-block. */
export function inlineAnchors(p: { anchors?: FloatAnchor[] }, ctx: RenderCtx): HTMLElement[] {
  const out: HTMLElement[] = [];
  for (const anc of p.anchors ?? []) {
    if (!anc.inlineFlow) continue;
    const node = anchorToElement(anc, ctx);
    if (node) {
      node.style.display = "inline-block";
      node.style.verticalAlign = "bottom";
      node.dataset.wordInlineImage = "true";
      out.push(node);
    }
  }
  return out;
}
