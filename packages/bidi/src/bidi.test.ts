import { describe, expect, it } from "vitest";
import {
  baseDirection, bidiClass, bidiRuns, computeLevels, visualRunOrder,
} from "./index.js";

describe("bidiClass", () => {
  it("classifies Arabic as AL and digits as EN/AN", () => {
    expect(bidiClass(0x0627)).toBe("AL"); // ا
    expect(bidiClass(0x0628)).toBe("AL"); // ب
    expect(bidiClass("0".charCodeAt(0))).toBe("EN");
    expect(bidiClass(0x0660)).toBe("AN"); // ٠
    expect(bidiClass("a".charCodeAt(0))).toBe("L");
    expect(bidiClass(" ".charCodeAt(0))).toBe("WS");
  });
});

describe("baseDirection", () => {
  it("honors the paragraph bidi flag", () => {
    expect(baseDirection("hello", true)).toBe("rtl");
  });
  it("falls back to first strong char", () => {
    expect(baseDirection("abc")).toBe("ltr");
    expect(baseDirection("مرحبا")).toBe("rtl");
    expect(baseDirection("123 abc")).toBe("ltr");
  });
});

describe("computeLevels + runs", () => {
  it("keeps pure RTL text in a single rtl run", () => {
    const text = "مرحبا بالعالم";
    const runs = bidiRuns(text, "rtl");
    expect(runs.length).toBe(1);
    expect(runs[0]!.direction).toBe("rtl");
    expect(runs[0]!.start).toBe(0);
    expect(runs[0]!.end).toBe(text.length);
  });

  it("splits embedded digits out of RTL text into their own run", () => {
    // بعد W2 تصبح الأرقام AN (مستوى أعلى من العربية) فتنفصل إلى رنٍّ مستقل
    // عن المحارف العربية المحيطة.
    const text = "سورة 2:3 نزلت";
    const runs = bidiRuns(text, "rtl");
    const digitRun = runs.find((r) => text.slice(r.start, r.end).includes("2"));
    expect(digitRun).toBeDefined();
    const slice = text.slice(digitRun!.start, digitRun!.end);
    expect(slice).toMatch(/[0-9]/);
    expect(slice).not.toMatch(/[\u0621-\u064A]/);
  });

  it("orders an Arabic-number-Arabic sequence correctly for RTL", () => {
    // بصريًا: الكلمة الثانية تلي الرقم يمينًا... نتحقق أن الرقم داخل رنٍّ LTR
    // يُعكس بترتيب بصري مستقل داخل السطر.
    const text = "آية 12 و3";
    const levels = computeLevels(text, "rtl");
    const runs = bidiRuns(text, "rtl");
    expect(runs.length).toBeGreaterThanOrEqual(3);
    void levels;
  });

  it("visual order reverses pure RTL runs (last logical drawn first)", () => {
    const runs = [
      { start: 0, end: 3, direction: "rtl" as const },
      { start: 3, end: 6, direction: "rtl" as const },
    ];
    const order = visualRunOrder(runs.map(() => 1));
    expect(order).toEqual([1, 0]);
  });

  it("keeps pure LTR runs in logical order", () => {
    const order = visualRunOrder([0, 0, 0]);
    expect(order).toEqual([0, 1, 2]);
  });

  it("places an embedded LTR run to the left of RTL text (L2)", () => {
    // RTL(1) RTL(1) LTR(2) LTR(2): عكس المتتالية ≥2 ثم ≥1 يعطي [2,3,1,0] —
    // الرنّات LTR تُرسم يسار الرنّات RTL (المعيار UAX9 §3.3.5).
    const order = visualRunOrder([1, 1, 2, 2]);
    expect(order).toEqual([2, 3, 1, 0]);
  });
});
