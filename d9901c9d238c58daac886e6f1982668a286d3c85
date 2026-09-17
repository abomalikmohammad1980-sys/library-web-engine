import * as hb from "harfbuzzjs";
import { LruCache } from "./cache.js";
import { buildClusters } from "./clusters.js";
import type { FontHMetrics, ShapeRequest, ShapedGlyph, ShapedRun } from "./types.js";

/** FNV-1a (32-bit) content hash, used to dedupe fonts by their bytes. */
export function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!;
    h = (h * 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/**
 * HarfBuzz-WASM wrapper (packages/shaper).
 *
 * Owns cached Face/Font objects (per font bytes and per scale) and a bounded
 * LRU of shaped runs. The HarfBuzz module itself is imported once and
 * initializes itself at module load (Node: reads dist/harfbuzz.wasm; browser:
 * resolves "harfbuzz.wasm" next to the module URL - Vite bundles it).
 */
export class Shaper {
  private readonly _faces = new Map<string, hb.Face>();
  private readonly _fonts = new Map<string, hb.Font>();
  private readonly _results: LruCache<string, ShapedRun>;

  constructor(readonly maxCacheEntries = 4096) {
    this._results = new LruCache(maxCacheEntries);
  }

  get cachedRuns(): number {
    return this._results.size;
  }

  private _faceFor(fontData: Uint8Array): { hash: string; face: hb.Face } {
    const hash = fnv1a(fontData);
    let face = this._faces.get(hash);
    if (face === undefined) {
      const ab = fontData
        .subarray(fontData.byteOffset, fontData.byteOffset + fontData.byteLength)
        .slice().buffer as ArrayBuffer;
      face = new hb.Face(new hb.Blob(ab), 0);
      this._faces.set(hash, face);
    }
    return { hash, face };
  }

  private _fontFor(hash: string, face: hb.Face, scale: number): hb.Font {
    const key = `${hash}@${scale}`;
    let font = this._fonts.get(key);
    if (font === undefined) {
      font = new hb.Font(face);
      font.setScale(scale, scale);
      this._fonts.set(key, font);
    }
    return font;
  }

  /** Shape one run. Glyphs come out in visual order; advances in `scale` units. */
  shape(req: ShapeRequest): ShapedRun {
    const { hash, face } = this._faceFor(req.fontData);
    const scale = req.scale ?? face.upem;
    const key = [
      hash,
      String(scale),
      req.direction,
      req.script ?? "",
      req.language ?? "",
      (req.features ?? []).join(","),
      req.text,
    ].join("\u0000");

    const cached = this._results.get(key);
    if (cached !== undefined) return cached;

    const font = this._fontFor(hash, face, scale);
    const buffer = new hb.Buffer();
    buffer.addText(req.text);
    buffer.setDirection(req.direction === "rtl" ? hb.Direction.RTL : hb.Direction.LTR);
    buffer.setFlags(
      hb.BufferFlag.PRODUCE_UNSAFE_TO_CONCAT | hb.BufferFlag.PRODUCE_SAFE_TO_INSERT_TATWEEL,
    );
    buffer.guessSegmentProperties();
    if (req.script !== undefined) buffer.setScript(req.script);
    if (req.language !== undefined) buffer.setLanguage(req.language);

    const features = this._features(req.features);
    hb.shape(font, buffer, features);

    const infos = buffer.getGlyphInfos();
    const positions = buffer.getGlyphPositions();
    const glyphs: ShapedGlyph[] = infos.map((info, i) => {
      const p = positions[i];
      return {
        id: info.codepoint,
        cluster: info.cluster,
        xAdvance: p?.xAdvance ?? 0,
        yAdvance: p?.yAdvance ?? 0,
        xOffset: p?.xOffset ?? 0,
        yOffset: p?.yOffset ?? 0,
        flags: info.flags,
      };
    });

    const clusters = buildClusters(req.text.length, glyphs);
    const totalAdvance = glyphs.reduce((a, g) => a + g.xAdvance, 0);
    const run: ShapedRun = {
      text: req.text,
      direction: req.direction,
      scale,
      upem: face.upem,
      glyphs,
      clusters,
      totalAdvance,
    };
    this._results.set(key, run);
    return run;
  }

  /** Horizontal font metrics at the requested scale (default: upem, i.e. design units). */
  hMetrics(fontData: Uint8Array, scale?: number): FontHMetrics {
    const { hash, face } = this._faceFor(fontData);
    const s = scale ?? face.upem;
    const ext = this._fontFor(hash, face, s).hExtents();
    return { upem: face.upem, scale: s, ascender: ext.ascender, descender: ext.descender, lineGap: ext.lineGap };
  }

  /** SVG path of a glyph at the requested scale (default: upem => design units). */
  glyphPath(fontData: Uint8Array, glyphId: number, scale?: number): string {
    const { hash, face } = this._faceFor(fontData);
    const s = scale ?? face.upem;
    return this._fontFor(hash, face, s).glyphToPath(glyphId);
  }

  /** Drop all cached faces/fonts/results; objects are freed by FinalizationRegistry. */
  close(): void {
    this._faces.clear();
    this._fonts.clear();
    this._results.clear();
  }

  private _features(features?: readonly string[]): hb.Feature[] | undefined {
    if (features === undefined || features.length === 0) return undefined;
    return features.map((f) => {
      const feat = hb.Feature.fromString(f);
      if (feat === undefined) throw new RangeError(`Invalid HarfBuzz feature string: "${f}"`);
      return feat;
    });
  }
}
