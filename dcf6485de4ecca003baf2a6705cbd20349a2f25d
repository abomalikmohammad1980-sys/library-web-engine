import { describe, expect, it, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { Shaper, buildClusters, clustersCover } from "./index.js";
import type { ShapedRun } from "./index.js";

const TRAD = new URL("../../../corpus/book-fonts/trado.ttf", import.meta.url);
const JAZEERA = new URL("../../../corpus/book-fonts/Al-Jazeera-Arabic-Regular.ttf", import.meta.url);

let trad: Uint8Array;
let jazeera: Uint8Array;
let shaper: Shaper;

beforeAll(() => {
  trad = readFileSync(TRAD);
  jazeera = readFileSync(JAZEERA);
  shaper = new Shaper();
});

function coverage(run: ShapedRun): void {
  expect(clustersCover(run.text.length, run.clusters, run.glyphs.length)).toBe(true);
}

describe("shaping basics (Traditional Arabic)", () => {
  it("shapes RTL Arabic into positioned glyphs in visual order", () => {
    const run = shaper.shape({ text: "مرحبا بالعالم", fontData: trad, direction: "rtl" });
    expect(run.glyphs.length).toBeGreaterThan(0);
    expect(run.totalAdvance).toBeGreaterThan(0);
    expect(run.direction).toBe("rtl");
    expect(run.scale).toBe(run.upem);
    // Visual order: the first glyph must belong to the last logical characters
    // (the word starts from the right), and clusters must decrease overall.
    const first = run.glyphs[0]!;
    expect(first.cluster).toBeGreaterThanOrEqual(run.text.length - 2);
    for (let i = 1; i < run.glyphs.length; i++) {
      expect(run.glyphs[i]!.cluster).toBeLessThanOrEqual(run.glyphs[i - 1]!.cluster);
    }
  });

  it("shapes LTR Latin in logical order", () => {
    const run = shaper.shape({ text: "Hello", fontData: trad, direction: "ltr" });
    expect(run.glyphs.length).toBe(5);
    expect(run.glyphs[0]!.cluster).toBe(0);
    expect(run.glyphs[4]!.cluster).toBe(4);
    expect(run.totalAdvance).toBeGreaterThan(0);
  });

  it("collapses a lam-alef ligature into one glyph covering both characters", () => {
    const run = shaper.shape({ text: "لا", fontData: trad, direction: "rtl" });
    expect(run.glyphs.length).toBeLessThanOrEqual(2);
    coverage(run);
    // The cluster range must cover both text indices 0 and 1.
    const covered = new Set<number>();
    for (const c of run.clusters) for (let i = c.textStart; i < c.textEnd; i++) covered.add(i);
    expect(covered.has(0)).toBe(true);
    expect(covered.has(1)).toBe(true);
  });

  it("merges base glyphs with marks into single clusters", () => {
    const run = shaper.shape({ text: "مَرْحَبًا", fontData: trad, direction: "rtl" });
    expect(run.glyphs.length).toBeGreaterThan(0);
    coverage(run);
    // Base + diacritics are one grapheme each, so far fewer clusters than code units.
    expect(run.clusters.length).toBeLessThan(run.text.length);
  });
});

describe("cluster map", () => {
  it("tiles the whole text and all glyphs for a mixed run", () => {
    const run = shaper.shape({ text: "السلام عليكم ورحمة الله 123", fontData: trad, direction: "rtl" });
    coverage(run);
    expect(run.clusters.length).toBeGreaterThan(0);
  });

  it("buildClusters returns [] for empty glyph input", () => {
    expect(buildClusters(0, [])).toEqual([]);
  });
});

describe("cache and scale", () => {
  it("returns the same object for an identical request", () => {
    const a = shaper.shape({ text: "بسم الله", fontData: trad, direction: "rtl" });
    const b = shaper.shape({ text: "بسم الله", fontData: trad, direction: "rtl" });
    expect(b).toBe(a);
  });

  it("does not reuse entries across different text or direction", () => {
    const a = shaper.shape({ text: "بسم الله", fontData: trad, direction: "rtl" });
    const b = shaper.shape({ text: "بسم الرحمن", fontData: trad, direction: "rtl" });
    const c = shaper.shape({ text: "بسم الله", fontData: trad, direction: "ltr" });
    expect(b).not.toBe(a);
    expect(c).not.toBe(a);
  });

  it("does not reuse entries across different fonts", () => {
    const a = shaper.shape({ text: "بسم الله", fontData: trad, direction: "rtl" });
    const b = shaper.shape({ text: "بسم الله", fontData: jazeera, direction: "rtl" });
    expect(b).not.toBe(a);
  });

  it("scales advances proportionally with the font scale", () => {
    const upem = new Shaper().hMetrics(trad).upem;
    const a = shaper.shape({ text: "مرحبا", fontData: trad, direction: "rtl", scale: upem });
    const b = shaper.shape({ text: "مرحبا", fontData: trad, direction: "rtl", scale: upem * 2 });
    expect(b.totalAdvance).toBeCloseTo(a.totalAdvance * 2, 2);
  });

  it("is bounded by maxCacheEntries", () => {
    const small = new Shaper(2);
    const req = (t: string) => ({ text: t, fontData: trad, direction: "rtl" as const });
    small.shape(req("واحد"));
    small.shape(req("اثنان"));
    small.shape(req("ثلاثة"));
    small.shape(req("أربعة"));
    expect(small.cachedRuns).toBeLessThanOrEqual(2);
  });
});

describe("empty and edge inputs", () => {
  it("shapes empty text to an empty run", () => {
    const run = shaper.shape({ text: "", fontData: trad, direction: "rtl" });
    expect(run.glyphs.length).toBe(0);
    expect(run.totalAdvance).toBe(0);
    expect(run.clusters.length).toBe(0);
  });
});

describe("metrics and paths", () => {
  it("reports sane horizontal metrics", () => {
    const m = shaper.hMetrics(trad);
    expect(m.upem).toBeGreaterThan(0);
    expect(m.ascender).toBeGreaterThan(0);
    expect(m.descender).toBeLessThan(0);
    expect(m.lineGap).toBeGreaterThanOrEqual(0);
  });

  it("returns a non-empty SVG path for a glyph", () => {
    const run = shaper.shape({ text: "ب", fontData: trad, direction: "rtl" });
    const gid = run.glyphs[0]!.id;
    const path = shaper.glyphPath(trad, gid);
    expect(path.length).toBeGreaterThan(0);
    expect(path.trim()).toMatch(/^[MmcLlHhVvQqCcSsTtAaZz]/);
  });

  it("throws on an invalid feature string", () => {
    expect(() =>
      shaper.shape({ text: "بسم الله", fontData: trad, direction: "rtl", features: ["!nope"] }),
    ).toThrow();
  });
});

describe("different fonts", () => {
  it("shapes the same text with Al-Jazeera too", () => {
    const run = shaper.shape({ text: "رمضان شهر القرآن", fontData: jazeera, direction: "rtl" });
    expect(run.glyphs.length).toBeGreaterThan(0);
    expect(run.totalAdvance).toBeGreaterThan(0);
    coverage(run);
  });
});
