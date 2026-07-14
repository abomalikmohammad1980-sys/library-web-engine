import { describe, expect, it } from "vitest";

import {
  boundaryGap, boundaryStep, carrySnap, intraStep, lineBox, lineMultiplier,
  pageStartAscent, singlePitch, type LineSpacing, type VertMetrics,
} from "./vertical.js";

// مقاييس adwa المقيسة (masjid): upem 2048، a=1.10693، g=18/2048، pitch=1.8916em
const ADWA: VertMetrics = { a: 1.10693, d: 0.77588, g: 0.008789, wd: 0.60 };
const AUTO = (line: number): LineSpacing => ({ line, lineRule: "auto" });
const SINGLE: LineSpacing = { line: null, lineRule: "auto" };

describe("lineMultiplier — ق‌ر2", () => {
  it("auto ⇒ line/240", () => expect(lineMultiplier(AUTO(259))).toBeCloseTo(259 / 240, 6));
  it("exact ⇒ 1", () => expect(lineMultiplier({ line: 480, lineRule: "exact" })).toBe(1));
  it("atLeast ⇒ 1", () => expect(lineMultiplier({ line: 480, lineRule: "atLeast" })).toBe(1));
  it("مفرد (null) ⇒ 1", () => expect(lineMultiplier(SINGLE)).toBe(1));
});

describe("singlePitch — ق‌ر1", () => {
  it("adwa em=300 ⇒ ~568 (masjid المقيس)", () => {
    // ‏(1.10693+0.77588+0.008789)×300 = 1.8916×300 = 567.5
    expect(singlePitch(ADWA, 300)).toBeCloseTo(567.5, 0);
  });
  it("يكمّم em لأقرب 10 (319→320)", () => {
    expect(singlePitch(ADWA, 319)).toBeCloseTo(singlePitch(ADWA, 320), 6);
  });
});

describe("lineBox — ق‌ر5 (max على runs)", () => {
  it("سطرٌ متجانس ⇒ مقاييس الخط", () => {
    const box = lineBox([{ met: ADWA, emTwips: 300 }])!;
    expect(box.asc).toBeCloseTo(1.10693 * 300, 3);
  });
  it("run أطول يرفع الصعود (بولد/لاتيني)", () => {
    const TALL: VertMetrics = { a: 1.18, d: 0.4, g: 0, wd: 0.3 };
    const box = lineBox([{ met: ADWA, emTwips: 300 }, { met: TALL, emTwips: 320 }])!;
    expect(box.asc).toBeCloseTo(1.18 * 320, 3); // الأطول
  });
  it("بلا runs ⇒ null", () => expect(lineBox([])).toBeNull());
});

describe("intraStep — ق‌ر7", () => {
  const box = lineBox([{ met: ADWA, emTwips: 300 }])!;
  it("m=1 ⇒ الخطوة = pitch المفرد (desc+gap+asc)", () => {
    // ‏A.desc+A.gap+B.asc = pitch(300) لأن A=B
    expect(intraStep(box, box, SINGLE)).toBeCloseTo(singlePitch(ADWA, 300), 3);
  });
  it("m>1 يضخّم بـ(A.asc+A.desc+A.gap)×(m−1)", () => {
    const s1 = intraStep(box, box, SINGLE);
    const s2 = intraStep(box, box, AUTO(480)); // m=2
    expect(s2 - s1).toBeCloseTo((box.asc + box.desc + box.gap), 3);
  });
  it("exact ⇒ line مباشرة", () => {
    expect(intraStep(box, box, { line: 500, lineRule: "exact" })).toBe(500);
  });
  it("atLeast ⇒ max(step, line)", () => {
    expect(intraStep(box, box, { line: 9999, lineRule: "atLeast" })).toBe(9999);
    expect(intraStep(box, box, { line: 1, lineRule: "atLeast" })).toBeCloseTo(singlePitch(ADWA, 300), 3);
  });
});

describe("boundaryStep + boundaryGap — ق‌ر6", () => {
  const box = lineBox([{ met: ADWA, emTwips: 300 }])!;
  it("الحدّ = خطوة داخلية + فجوة التباعد", () => {
    const intra = intraStep(box, box, SINGLE);
    expect(boundaryStep(box, box, SINGLE, 160)).toBeCloseTo(intra + 160, 3);
  });
  it("انهيار الفواصل: max(after,before)", () => {
    const cs = new Set<string>();
    expect(boundaryGap(200, 160, { styleA: "a", styleB: "b", contextualStyles: cs })).toBe(200);
  });
  it("contextualSpacing ⇒ 0 بين فقرتين من نفس النمط", () => {
    const cs = new Set(["a4"]);
    expect(boundaryGap(160, 160, { styleA: "a4", styleB: "a4", contextualStyles: cs })).toBe(0);
    // نمطان مختلفان ⇒ لا انهيار
    expect(boundaryGap(160, 160, { styleA: "a4", styleB: "a5", contextualStyles: cs })).toBe(160);
  });
});

describe("pageStartAscent — ق‌ر8/8-د", () => {
  it("بلا معايرة ⇒ النموذج (hheaTotal−winDesc)×em", () => {
    const em = 300;
    expect(pageStartAscent(ADWA, em, AUTO(259)))
      .toBeCloseTo((ADWA.a + ADWA.d + ADWA.g - ADWA.wd) * em, 3);
  });
  it("مع معايرة ⇒ القيمة المقيسة (m-class الصحيح)", () => {
    const cal = { "300": { m1: 418.08, mN: 420.48 } };
    expect(pageStartAscent(ADWA, 300, AUTO(259), cal)).toBe(420.48); // m>1
    expect(pageStartAscent(ADWA, 300, SINGLE, cal)).toBe(418.08);    // m=1
  });
  it("معايرةٌ ناقصةُ الصنف ⇒ النموذج", () => {
    const cal = { "300": { mN: 420.48 } }; // لا m1
    const model = (ADWA.a + ADWA.d + ADWA.g - ADWA.wd) * 300;
    expect(pageStartAscent(ADWA, 300, SINGLE, cal)).toBeCloseTo(model, 3);
  });
});

describe("carrySnap — حَمْل النقطة (dot-carry)", () => {
  it("يقنص الإزاحة لأقرب نقطة 2.4tw عن المرساة", () => {
    // إزاحةٌ ملساء 547.2 (228 نقطة) ⇒ لا تغيير؛ 549.0 ⇒ 549.6 (229 نقطة)
    expect(carrySnap(1000, 547.2)).toBeCloseTo(1000 + 547.2, 6);
    expect(carrySnap(1000, 549.0)).toBeCloseTo(1000 + 549.6, 6);
  });
  it("يُقحِم نقطة تعويضية عند تجاوز نصف النقطة", () => {
    expect(carrySnap(0, 1.3)).toBeCloseTo(2.4, 6); // round(1.3/2.4)=1
    expect(carrySnap(0, 1.1)).toBeCloseTo(0, 6);   // round(1.1/2.4)=0
  });
});
