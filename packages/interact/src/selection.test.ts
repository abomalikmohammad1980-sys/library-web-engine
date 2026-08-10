import { describe, expect, it } from "vitest";
import type { SceneGlyph, SceneLine, ScenePage, SceneParagraph, SceneWord } from "@engine/scene";
import {
  buildSelectionMap,
  clientPointToPagePx,
  hitTestWord,
  normalizeSelectionRange,
  selectionBoxes,
  selectionPlainText,
} from "./selection.js";

const UNIT = 0.24; // 240 twips / 1000 upem

function word(text: string, advanceFont: number, direction: "rtl" | "ltr", opts: {
  space?: number;
} = {}): SceneWord {
  const glyphs: SceneGlyph[] = [];
  const part = advanceFont / Math.max(1, text.length);
  for (let i = 0; i < text.length; i++) {
    glyphs.push({
      id: i + 1,
      cluster: i,
      xAdvance: part,
      yAdvance: 0,
      xOffset: 0,
      yOffset: 0,
      flags: 0,
    });
  }
  return {
    text,
    fontIndex: 0,
    direction,
    glyphs,
    advanceTwips: advanceFont * UNIT,
    spaceBeforeTwips: opts.space ?? 0,
    baselineShiftTwips: 0,
    level: direction === "rtl" ? 1 : 0,
    emTwips: 240,
    unitTwips: UNIT,
    ascentTwips: 800 * UNIT,
    descentTwips: 300 * UNIT,
    upem: 1000,
    gapTwips: 34 * UNIT,
    color: null,
    bold: false,
    italic: false,
    underline: false,
    underlineColor: null,
    highlight: null,
    strike: false,
  };
}

function line(words: SceneWord[], startTwips: number, yTwips: number): SceneLine {
  return {
    words,
    startTwips,
    widthTwips: words.reduce((a, w) => a + w.advanceTwips + w.spaceBeforeTwips, 0),
    ascentTwips: 800 * UNIT,
    descentTwips: 300 * UNIT,
    lineGapTwips: 34 * UNIT,
    heightTwips: (800 + 300 + 34) * UNIT,
    yTwips,
    justified: false,
    shrinkFactor: null,
  };
}

function para(index: number, dir: "rtl" | "ltr", lines: SceneLine[]): SceneParagraph {
  return {
    index,
    dir,
    jc: dir === "rtl" ? "right" : "left",
    flowStartTwips: lines[0]?.startTwips ?? 0,
    widthTwips: 9000,
    firstLineIndentTwips: 0,
    spacingBeforeTwips: 0,
    spacingAfterTwips: 0,
    shd: null,
    pBdr: null,
    markerText: null,
    markerWidthTwips: 0,
    numbered: false,
    lines,
    yTwips: 0,
  };
}

function pageFixture(): ScenePage {
  const rtl1 = line([
    word("بسم", 1300, "rtl"),
    word("الله", 1600, "rtl", { space: 240 }),
  ], 10000, 2000);
  const rtl2 = line([
    word("الرحمن", 2200, "rtl"),
  ], 10000, 3400);
  return {
    index: 0,
    widthTwips: 12000,
    heightTwips: 18000,
    marLeftTwips: 1440,
    marRightTwips: 1440,
    marTopTwips: 1440,
    marBottomTwips: 1440,
    paragraphs: [para(0, "rtl", [rtl1, rtl2])],
  };
}

describe("interact/selection", () => {
  it("builds a flat word map with page metrics", () => {
    const map = buildSelectionMap(pageFixture());
    expect(map.pageWidthPx).toBeCloseTo(12000 / 15, 6);
    expect(map.pageHeightPx).toBeCloseTo(18000 / 15, 6);
    expect(map.words.length).toBe(3);
    expect(map.lines.length).toBe(2);
  });

  it("hit-tests inside a word by center point", () => {
    const map = buildSelectionMap(pageFixture());
    const w0 = map.words[0]!;
    const x = (w0.minXPx + w0.maxXPx) / 2;
    const y = (w0.topPx + w0.bottomPx) / 2;
    expect(hitTestWord(map, x, y)).toBe(0);
  });

  it("snaps between words to the nearest horizontal edge", () => {
    const map = buildSelectionMap(pageFixture());
    const w0 = map.words[0]!;
    const w1 = map.words[1]!;
    const x = w1.maxXPx + 1; // داخل الفراغ بعد الكلمة الثانية وقريبٌ منها
    const y = (w0.topPx + w0.bottomPx) / 2;
    expect(hitTestWord(map, x, y)).toBe(1);
  });

  it("normalizes reverse ranges", () => {
    expect(normalizeSelectionRange(7, 2)).toEqual({ start: 2, end: 7 });
  });

  it("extracts plain text with spaces and line breaks", () => {
    const map = buildSelectionMap(pageFixture());
    expect(selectionPlainText(map, { start: 0, end: 1 })).toBe("بسم الله");
    expect(selectionPlainText(map, { start: 0, end: 2 })).toBe("بسم الله\nالرحمن");
  });

  it("returns selection boxes with positive dimensions", () => {
    const map = buildSelectionMap(pageFixture());
    const boxes = selectionBoxes(map, { start: 0, end: 2 });
    expect(boxes.length).toBe(3);
    for (const b of boxes) {
      expect(b.widthPx).toBeGreaterThan(0);
      expect(b.heightPx).toBeGreaterThan(0);
    }
  });

  it("maps client coords to page coords proportionally", () => {
    const map = buildSelectionMap(pageFixture());
    const p = clientPointToPagePx(map, { left: 100, top: 50, width: 400, height: 600 }, 300, 350);
    expect(p.xPx).toBeCloseTo(map.pageWidthPx * 0.5, 6);
    expect(p.yPx).toBeCloseTo(map.pageHeightPx * 0.5, 6);
  });
});
