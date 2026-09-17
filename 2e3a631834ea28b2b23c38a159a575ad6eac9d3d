import type { ScenePage } from "@engine/scene";
import { lineWordGeometry, TWIPS_PER_PX } from "@engine/paint";

export interface SelectionWordRef {
  index: number;
  paraIndex: number;
  lineIndex: number;
  wordIndex: number;
  text: string;
  minXPx: number;
  maxXPx: number;
  topPx: number;
  bottomPx: number;
}

export interface SelectionLineRef {
  paraIndex: number;
  lineIndex: number;
  topPx: number;
  bottomPx: number;
  wordStart: number;
  wordEnd: number;
}

export interface SelectionMap {
  pageWidthPx: number;
  pageHeightPx: number;
  words: SelectionWordRef[];
  lines: SelectionLineRef[];
}

export interface SelectionRange {
  start: number;
  end: number;
}

export interface SelectionBox {
  paraIndex: number;
  lineIndex: number;
  wordIndex: number;
  leftPx: number;
  topPx: number;
  widthPx: number;
  heightPx: number;
}

export interface RectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function buildSelectionMap(page: ScenePage): SelectionMap {
  const words: SelectionWordRef[] = [];
  const lines: SelectionLineRef[] = [];

  for (const para of page.paragraphs) {
    for (let lineIndex = 0; lineIndex < para.lines.length; lineIndex++) {
      const line = para.lines[lineIndex]!;
      const geo = lineWordGeometry(line, para);
      const topPx = line.yTwips / TWIPS_PER_PX - line.ascentTwips / TWIPS_PER_PX;
      const bottomPx = line.yTwips / TWIPS_PER_PX + line.descentTwips / TWIPS_PER_PX;
      const wordStart = words.length;

      for (let wordIndex = 0; wordIndex < geo.words.length; wordIndex++) {
        const w = geo.words[wordIndex]!;
        words.push({
          index: words.length,
          paraIndex: para.index,
          lineIndex,
          wordIndex,
          text: w.text,
          minXPx: w.minXPx,
          maxXPx: w.maxXPx,
          topPx,
          bottomPx,
        });
      }

      const wordEnd = words.length - 1;
      if (wordEnd >= wordStart) {
        lines.push({
          paraIndex: para.index,
          lineIndex,
          topPx,
          bottomPx,
          wordStart,
          wordEnd,
        });
      }
    }
  }

  return {
    pageWidthPx: page.widthTwips / TWIPS_PER_PX,
    pageHeightPx: page.heightTwips / TWIPS_PER_PX,
    words,
    lines,
  };
}

export function normalizeSelectionRange(a: number, b: number): SelectionRange {
  return a <= b ? { start: a, end: b } : { start: b, end: a };
}

export function hitTestWord(map: SelectionMap, xPx: number, yPx: number): number | null {
  if (map.words.length === 0 || map.lines.length === 0) return null;
  const line = nearestLine(map, yPx);
  if (!line) return null;

  let nearest = line.wordStart;
  let nearestDist = Number.POSITIVE_INFINITY;
  let inside: number | null = null;

  for (let i = line.wordStart; i <= line.wordEnd; i++) {
    const w = map.words[i]!;
    const center = (w.minXPx + w.maxXPx) / 2;
    if (xPx >= w.minXPx && xPx <= w.maxXPx) {
      const d = Math.abs(center - xPx);
      if (d < nearestDist) {
        nearestDist = d;
        inside = i;
      }
      continue;
    }
    const d = xPx < w.minXPx ? (w.minXPx - xPx) : (xPx - w.maxXPx);
    if (d < nearestDist) {
      nearestDist = d;
      nearest = i;
    }
  }

  return inside ?? nearest;
}

function nearestLine(map: SelectionMap, yPx: number): SelectionLineRef | null {
  let best: SelectionLineRef | null = null;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const line of map.lines) {
    let dist = 0;
    if (yPx < line.topPx) dist = line.topPx - yPx;
    else if (yPx > line.bottomPx) dist = yPx - line.bottomPx;
    if (dist < bestDist) {
      bestDist = dist;
      best = line;
    }
  }
  return best;
}

export function selectionBoxes(map: SelectionMap, range: SelectionRange): SelectionBox[] {
  const clamped = clampRange(map, range);
  if (!clamped) return [];
  const out: SelectionBox[] = [];

  for (let i = clamped.start; i <= clamped.end; i++) {
    const w = map.words[i]!;
    out.push({
      paraIndex: w.paraIndex,
      lineIndex: w.lineIndex,
      wordIndex: w.wordIndex,
      leftPx: w.minXPx,
      topPx: w.topPx,
      widthPx: Math.max(1, w.maxXPx - w.minXPx),
      heightPx: Math.max(1, w.bottomPx - w.topPx),
    });
  }

  return out;
}

export function selectionPlainText(map: SelectionMap, range: SelectionRange): string {
  const clamped = clampRange(map, range);
  if (!clamped) return "";

  let out = "";
  for (let i = clamped.start; i <= clamped.end; i++) {
    const cur = map.words[i]!;
    out += cur.text;
    if (i === clamped.end) break;

    const next = map.words[i + 1]!;
    out += (cur.paraIndex === next.paraIndex && cur.lineIndex === next.lineIndex) ? " " : "\n";
  }

  return out;
}

export function clientPointToPagePx(
  map: SelectionMap,
  rect: RectLike,
  clientX: number,
  clientY: number,
): { xPx: number; yPx: number } {
  const xNorm = (clientX - rect.left) / Math.max(1, rect.width);
  const yNorm = (clientY - rect.top) / Math.max(1, rect.height);
  return {
    xPx: xNorm * map.pageWidthPx,
    yPx: yNorm * map.pageHeightPx,
  };
}

function clampRange(map: SelectionMap, range: SelectionRange): SelectionRange | null {
  if (map.words.length === 0) return null;
  const normalized = normalizeSelectionRange(range.start, range.end);
  const start = Math.max(0, normalized.start);
  const end = Math.min(map.words.length - 1, normalized.end);
  if (start > end) return null;
  return { start, end };
}
