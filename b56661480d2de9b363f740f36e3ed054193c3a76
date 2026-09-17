import { describe, expect, it } from "vitest";
import { parseSvgPath, pathBoundingBox } from "./paths.js";

describe("parseSvgPath", () => {
  it("parses a simple rectangle", () => {
    const cmds = parseSvgPath("M0 0 L100 0 L100 50 Z");
    expect(cmds.map((c) => c.type)).toEqual(["M", "L", "L", "Z"]);
  });

  it("parses absolute and relative commands with curves", () => {
    const cmds = parseSvgPath("M10 20c5 5 10 5 15 0q2-3 4 0Z");
    expect(cmds.length).toBe(4);
    expect(cmds[1]).toMatchObject({ type: "C", x: 25, y: 20 });
    expect(cmds[2]).toMatchObject({ type: "Q", x: 29, y: 20 });
    expect(cmds[3]!.type).toBe("Z");
  });

  it("handles H and V", () => {
    const cmds = parseSvgPath("M1 2 H10 V20 h5 v3");
    expect(cmds).toMatchObject([
      { type: "M", x: 1, y: 2 },
      { type: "H", x: 10 },
      { type: "V", y: 20 },
      { type: "H", x: 15 },
      { type: "V", y: 23 },
    ]);
  });

  it("reflects control points for S/T after a C/Q", () => {
    const cmds = parseSvgPath("M0 0 C10 10 20 10 30 0 S50-10 60 0 Q40 40 50 50 T70 60");
    expect(cmds.length).toBe(5);
    // انعكاس نقطة التحكم الثانية للأمر السابق عبر النقطة الأخيرة = نقطة تحكم S الأولى
    expect(cmds[2]).toMatchObject({ type: "S", x1: 40, y1: -10, x2: 50, y2: -10, x: 60, y: 0 });
    // انعكاس نقطة تحكم Q عبر نقطتها الأخيرة = نقطة تحكم T الوحيدة
    expect(cmds[4]).toMatchObject({ type: "T", x1: 60, y1: 60, x: 70, y: 60 });
  });

  it("throws on unknown command characters", () => {
    expect(() => parseSvgPath("M0 0 X1 2")).toThrow();
  });

  it("parses a real HarfBuzz glyph path without throwing", async () => {
    const { Shaper } = await import("@engine/shaper");
    const { readFileSync } = await import("node:fs");
    const bytes = readFileSync(
      new URL("../../../corpus/book-fonts/Al-Jazeera-Arabic-Regular.ttf", import.meta.url),
    );
    const s = new Shaper();
    const run = s.shape({ text: "م", fontData: bytes, direction: "rtl" });
    const d = s.glyphPath(bytes, run.glyphs[0]!.id);
    const cmds = parseSvgPath(d);
    expect(cmds.length).toBeGreaterThan(0);
    const b = pathBoundingBox(cmds);
    expect(Number.isFinite(b.minX)).toBe(true);
    expect(Number.isFinite(b.maxY)).toBe(true);
  });
});

describe("pathBoundingBox", () => {
  it("bounds a polyline correctly", () => {
    const b = pathBoundingBox(parseSvgPath("M5 10 L15 20 L-3 7"));
    expect(b).toEqual({ minX: -3, minY: 7, maxX: 15, maxY: 20 });
  });
});
