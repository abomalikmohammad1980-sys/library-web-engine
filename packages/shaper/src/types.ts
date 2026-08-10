/**
 * Types of the shaping wrapper (HarfBuzz-WASM) - the public contract of the package.
 *
 * Architecture reference (docs/architecture.md §4.3): contract is
 * "text + font + size + direction + features -> glyphs (id, advance, offset, cluster)".
 * The cluster is the currency of all interaction (selection/copy/search) and is
 * built from day one.
 */

/** Direction for shaping a run - engine direction, not display direction. */
export type ShapeDirection = "rtl" | "ltr";

/** Request to shape one text run (homogeneous font/size/direction). */
export interface ShapeRequest {
  readonly text: string;
  readonly fontData: Uint8Array;
  readonly direction: ShapeDirection;
  /** OpenType script tag (e.g. "Arab"). Guessed from text when omitted. */
  readonly script?: string;
  /** BCP-47-ish language tag (e.g. "ar"). Guessed when omitted. */
  readonly language?: string;
  /**
   * Font scale. Defaults to the face upem, so advances come out in design units.
   * A caller may pass scale = font size in twips to receive advances directly
   * on the Word grid (see layout ADR-0004).
   */
  readonly scale?: number;
  /** HarfBuzz feature strings, e.g. "kern", "-calt", "liga". */
  readonly features?: readonly string[];
}

/** One shaped glyph with its position. Advances/offsets are in scale units. */
export interface ShapedGlyph {
  readonly id: number;
  /** Input text index (UTF-16 code unit) this glyph belongs to. */
  readonly cluster: number;
  readonly xAdvance: number;
  readonly yAdvance: number;
  readonly xOffset: number;
  readonly yOffset: number;
  readonly flags: number;
}

/** Map of a text span to the glyphs that render it. */
export interface ClusterRange {
  /** Inclusive, UTF-16 code units in the input text. */
  readonly textStart: number;
  /** Exclusive. */
  readonly textEnd: number;
  /** Inclusive index into glyphs[]. */
  readonly glyphStart: number;
  /** Exclusive. */
  readonly glyphEnd: number;
}

/** Result of shaping one run. Glyphs are in visual order. */
export interface ShapedRun {
  readonly text: string;
  readonly direction: ShapeDirection;
  readonly scale: number;
  readonly upem: number;
  readonly glyphs: readonly ShapedGlyph[];
  readonly clusters: readonly ClusterRange[];
  readonly totalAdvance: number;
}

/** Horizontal font metrics at a given scale (from HarfBuzz hExtents). */
export interface FontHMetrics {
  readonly upem: number;
  readonly scale: number;
  readonly ascender: number;
  readonly descender: number;
  readonly lineGap: number;
}

export const GLYPH_FLAG_UNSAFE_TO_BREAK = 1;
export const GLYPH_FLAG_UNSAFE_TO_CONCAT = 2;
export const GLYPH_FLAG_SAFE_TO_INSERT_TATWEEL = 4;

export function isUnsafeToBreak(glyph: ShapedGlyph): boolean {
  return (glyph.flags & GLYPH_FLAG_UNSAFE_TO_BREAK) !== 0;
}

export function isUnsafeToConcat(glyph: ShapedGlyph): boolean {
  return (glyph.flags & GLYPH_FLAG_UNSAFE_TO_CONCAT) !== 0;
}

export function isSafeToInsertTatweel(glyph: ShapedGlyph): boolean {
  return (glyph.flags & GLYPH_FLAG_SAFE_TO_INSERT_TATWEEL) !== 0;
}
