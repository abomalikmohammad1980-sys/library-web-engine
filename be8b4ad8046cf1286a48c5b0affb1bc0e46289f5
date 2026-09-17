import { describe, expect, it } from "vitest";
import type { SceneGlyph, SceneLine, SceneParagraph, SceneWord } from "@engine/scene";
import { lineWordGeometry, paragraphBlock } from "./geometry.js";

const UNIT = 0.24; // 240 twips / 1000 upem

function word(text: string, advanceFont: number, direction: "rtl" | "ltr", opts: {
  space?: number; bold?: boolean; highlight?: string | null; horizontalScale?: number;
} = {}): SceneWord {
  const glyphs: SceneGlyph[] = [];
  const part = advanceFont / text.length;
  for (let i = 0; i < text.length; i++) {
    glyphs.push({
      id: i + 1, cluster: i, xAdvance: part, yAdvance: 0, xOffset: 0, yOffset: 0, flags: 0,
    });
  }
  return {
    text, fontIndex: 0, direction, glyphs,
    advanceTwips: advanceFont * UNIT,
    spaceBeforeTwips: opts.space ?? 0,
    baselineShiftTwips: 0, level: direction === "rtl" ? 1 : 0,
    emTwips: 240, unitTwips: UNIT, horizontalScale: opts.horizontalScale ?? 1,
    ascentTwips: 800 * UNIT, descentTwips: 300 * UNIT,
    upem: 1000, gapTwips: 34 * UNIT,
    color: null, bold: opts.bold ?? false, italic: false,
    underline: false, underlineColor: null, highlight: opts.highlight ?? null, strike: false,
  };
}

function line(words: SceneWord[], startTwips: number, shrink: number | null = null): SceneLine {
  return {
    words, startTwips, widthTwips: words.reduce((a, w) => a + w.advanceTwips, 0),
    ascentTwips: 800 * UNIT, descentTwips: 300 * UNIT, lineGapTwips: 34 * UNIT,
    heightTwips: (800 + 300 + 34) * UNIT, yTwips: 1200, justified: false, shrinkFactor: shrink,
  };
}

function para(dir: "rtl" | "ltr", l: SceneLine): SceneParagraph {
  return {
    index: 0, dir, jc: dir === "rtl" ? "right" : "left",
    flowStartTwips: l.startTwips, widthTwips: 9000, firstLineIndentTwips: 0,
    spacingBeforeTwips: 0, spacingAfterTwips: 0, shd: null, pBdr: null, numbered: false, markerText: null, markerWidthTwips: 0,
    lines: [l], yTwips: 0,
  };
}

const TW = 10000; // twips → px

function emptyPara(): SceneParagraph {
  const p = para("rtl", line([word("أ", 500, "rtl")], TW));
  return { ...p, lines: [] };
}

describe("lineWordGeometry — RTL", () => {
  it("places the first glyph of each RTL word at its right edge, flowing left", () => {
    const w1 = word("أب", 1000, "rtl");
    const w2 = word("ج", 500, "rtl", { space: 240 });
    const l = line([w1, w2], TW);
    const g = lineWordGeometry(l, para("rtl", l));

    const w1b = g.words[0]!;
    expect(w1b.minXPx).toBeCloseTo(TW / 15 - w1.advanceTwips / 15, 6);
    expect(w1b.maxXPx).toBeCloseTo(TW / 15, 6);
    // أول غليف (الأيمن) عند حافة الكلمة اليمنى
    expect(w1b.glyphs[0]!.xPx).toBeCloseTo(TW / 15, 6);
    // غليفا الكلمة الأولى يتراجعان يسارًا
    expect(w1b.glyphs[1]!.xPx).toBeLessThan(w1b.glyphs[0]!.xPx);

    // الكلمة الثانية بعد مسافةٍ إلى اليسار
    const w2b = g.words[1]!;
    const expectedPen = TW / 15 - (w1.advanceTwips + 240) / 15;
    expect(w2b.maxXPx).toBeCloseTo(expectedPen, 6);
    expect(w2b.glyphs[0]!.xPx).toBeCloseTo(expectedPen, 6);
  });

  it("separates adjacent words by the inter-word space (no overlap)", () => {
    const w1 = word("أب", 1000, "rtl");
    const w2 = word("ج", 500, "rtl", { space: 240 });
    const l = line([w1, w2], TW);
    const g = lineWordGeometry(l, para("rtl", l));
    // الفجوة بين حوافّ الكلمتين = عرض المسافة (240tw = 16px)
    expect(g.words[0]!.minXPx - g.words[1]!.maxXPx).toBeCloseTo(240 / 15, 6);
  });
});

describe("lineWordGeometry — LTR", () => {
  it("يرفع baseline الغليف بمقدار baselineShiftTwips الموجب", () => {
    const raised = word("1", 400, "ltr");
    raised.baselineShiftTwips = 120;
    const l = line([raised], TW);
    const g = lineWordGeometry(l, para("ltr", l));
    expect(g.words[0]!.glyphs[0]!.baselinePx)
      .toBeCloseTo((l.yTwips - 120) / 15, 6);
  });
  it("يضغط w:w أفقيًا فقط ويبقي المقياس الرأسي", () => {
    const compressed = word("ab", 500, "ltr", { horizontalScale: .5 });
    compressed.advanceTwips *= .5;
    const l = line([compressed], TW);
    const g = lineWordGeometry(l, para("ltr", l));
    expect(g.words[0]!.glyphs[0]!.sx).toBeCloseTo(UNIT / 15 * .5, 8);
    expect(g.words[0]!.glyphs[0]!.sy).toBeCloseTo(UNIT / 15, 8);
    expect(g.words[0]!.maxXPx - g.words[0]!.minXPx)
      .toBeCloseTo(500 * UNIT * .5 / 15, 8);
  });
  it("places LTR glyphs left to right from the pen", () => {
    const w1 = word("ab", 1000, "ltr");
    const l = line([w1], TW);
    const g = lineWordGeometry(l, para("ltr", l));
    expect(g.words[0]!.minXPx).toBeCloseTo(TW / 15, 6);
    expect(g.words[0]!.glyphs[0]!.xPx).toBeCloseTo(TW / 15, 6);
    expect(g.words[0]!.glyphs[1]!.xPx).toBeGreaterThan(g.words[0]!.glyphs[0]!.xPx);
  });

  it("lays an embedded RTL word from its right box edge", () => {
    const arabic = word("أ", 500, "rtl");
    const l = line([arabic], TW);
    const g = lineWordGeometry(l, para("ltr", l));
    // صندوق الكلمة: [pen, pen+wPx]؛ أول غليف (الأيمن) عند نهاية الصندوق
    expect(g.words[0]!.maxXPx).toBeCloseTo(TW / 15 + arabic.advanceTwips / 15, 6);
    expect(g.words[0]!.glyphs[0]!.xPx).toBeCloseTo(TW / 15 + arabic.advanceTwips / 15, 6);
  });
});

describe("lineWordGeometry — shrink and marks", () => {
  it("scales spaces by shrinkFactor", () => {
    const w1 = word("أ", 500, "rtl");
    const w2 = word("ب", 500, "rtl", { space: 1000 });
    const l = line([w1, w2], TW, 0.5);
    const g = lineWordGeometry(l, para("rtl", l));
    const expectedPen = TW / 15 - (500 * UNIT + 1000 * 0.5) / 15;
    expect(g.words[1]!.maxXPx).toBeCloseTo(expectedPen, 6);
  });

  it("flags zero-advance glyphs as marks", () => {
    const wm = word("أ", 500, "rtl");
    wm.glyphs[0]!.xAdvance = 0;
    const l = line([wm], TW);
    const g = lineWordGeometry(l, para("rtl", l));
    expect(g.words[0]!.glyphs[0]!.mark).toBe(true);
  });
});

describe("paragraphBlock", () => {
  it("returns null for an empty paragraph", () => {
    expect(paragraphBlock(emptyPara())).toBeNull();
  });

  it("bounds the paragraph text area", () => {
    const w1 = word("أب", 1000, "rtl");
    const l = line([w1], TW);
    const p = para("rtl", l);
    const block = paragraphBlock(p)!;
    expect(block).not.toBeNull();
    expect(block.w).toBeGreaterThan(0);
    expect(block.h).toBeGreaterThan(0);
    expect(block.y).toBeLessThan(l.yTwips / 15);
  });
});
