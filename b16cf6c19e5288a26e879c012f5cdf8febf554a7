import type { ClusterRange, ShapedGlyph } from "./types.js";

/**
 * Build the text-to-glyph cluster map from shaped output.
 *
 * HarfBuzz assigns each output glyph a `cluster` = input index of the first
 * character that contributed to it (logical order). At the default cluster
 * level (MONOTONE_GRAPHEMES) a base character and its marks share one cluster,
 * and ligatures collapse their characters into the minimum cluster value.
 *
 * The returned ranges tile the input text: every UTF-16 index in [0, textLen)
 * belongs to exactly one range, and glyphs are grouped contiguously by cluster
 * (HarfBuzz output keeps same-cluster glyphs adjacent in visual order).
 */
export function buildClusters(
  textLen: number,
  glyphs: readonly ShapedGlyph[],
): ClusterRange[] {
  if (glyphs.length === 0) return [];
  const distinct = [...new Set(glyphs.map((g) => g.cluster))].sort((a, b) => a - b);
  const nextOf = new Map<number, number>();
  for (let i = 0; i < distinct.length - 1; i++) nextOf.set(distinct[i]!, distinct[i + 1]!);

  const ranges: ClusterRange[] = [];
  let i = 0;
  while (i < glyphs.length) {
    const c = glyphs[i]!.cluster;
    let j = i;
    while (j < glyphs.length && glyphs[j]!.cluster === c) j++;
    const textStart = Math.max(0, Math.min(c, textLen));
    const textEnd = Math.max(textStart, Math.min(nextOf.get(c) ?? textLen, textLen));
    ranges.push({ textStart, textEnd, glyphStart: i, glyphEnd: j });
    i = j;
  }
  return ranges;
}

/**
 * Validate that cluster ranges tile the text and cover all glyphs.
 * Ranges are emitted in glyph/visual order, so they are sorted by textStart here.
 */
export function clustersCover(
  textLen: number,
  ranges: readonly ClusterRange[],
  glyphCount: number,
): boolean {
  if (ranges.length === 0) return textLen === 0 && glyphCount === 0;
  const coveredGlyphs = ranges.reduce((a, r) => a + (r.glyphEnd - r.glyphStart), 0);
  if (coveredGlyphs !== glyphCount) return false;
  const sorted = [...ranges].sort((a, b) => a.textStart - b.textStart);
  let cursor = 0;
  for (const r of sorted) {
    if (r.textStart !== cursor) return false;
    if (r.textEnd <= r.textStart) return false;
    cursor = r.textEnd;
  }
  return cursor === textLen;
}
