import { describe, expect, it } from "vitest";

import { breakLines, numTabTextStart, shouldShrinkPack, type BreakItem } from "./linebreak.js";

/** كلمات متساوية العرض بمسافات بلانك موحدة */
function uniform(count: number, width: number, space: number): BreakItem[] {
  return Array.from({ length: count }, (_, i) => ({
    width, spaceBefore: i === 0 ? 0 : space, blankBefore: i > 0,
  }));
}

describe("breakLines — الكسر الجشع الأساسي", () => {
  it("يملأ ثم يكسر عند العجز الطبيعي", () => {
    // كلمتان (100+50+100=250) تملآن عمود 260؛ الثالثة تفيض
    const lines = breakLines(uniform(4, 100, 50), { columnTwips: 260 });
    expect(lines.map((l) => [l.start, l.end])).toEqual([[0, 2], [2, 4]]);
    expect(lines.every((l) => !l.shrunk)).toBe(true);
  });

  it("التقدم الأول الموجب يضيّق السطر الأول فقط", () => {
    const lines = breakLines(uniform(4, 100, 50), {
      columnTwips: 260, firstLineIndentTwips: 50,
    });
    // السطر الأول متاحه 210 ⇒ كلمة واحدة؛ الثاني 260 ⇒ كلمتان
    expect(lines.map((l) => [l.start, l.end])).toEqual([[0, 1], [1, 3], [3, 4]]);
  });

  it("التعليق السالب (hanging) يوسّع السطر الأول — درس para127", () => {
    const lines = breakLines(uniform(4, 100, 50), {
      columnTwips: 260, firstLineIndentTwips: -150,
    });
    // السطر الأول متاحه 410 ⇒ ثلاث كلمات (250+50+100=400)
    expect(lines[0]).toMatchObject({ start: 0, end: 3 });
  });

  it("w:br يكسر إجباريًا مهما كان الامتلاء", () => {
    const items = uniform(4, 100, 50);
    items[0].forcedBreakAfter = true;
    const lines = breakLines(items, { columnTwips: 10_000 });
    expect(lines.map((l) => [l.start, l.end, l.forced]))
      .toEqual([[0, 1, true], [1, 4, false]]);
  });
});

describe("shouldShrinkPack — القاعدة 16", () => {
  // أرقام حقيقية مقيسة من sample-masjid (مثبتات تحوّط ضد أي انزلاق معايرة)
  it("حالة 104:0 المقيسة: σ=0.8232، e=1.3608 ⇒ يحشر (Word حشر)", () => {
    const n = 22, w = 50, W = 13601;
    const D = (1 - 0.8232) * n * w;               // ≈ 194.5
    const L1 = W - (1.3608 - 1) * (n - 1) * w;    // بديل التمديد
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(true);
  });

  it("حالة 133:2 المقيسة: σ=0.7991، e=1.3639 ⇒ يكسر (Word كسر)", () => {
    const n = 24, w = 47, W = 13568;
    const D = (1 - 0.7991) * n * w;
    const L1 = W - (1.3639 - 1) * (n - 1) * w;
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(false);
  });

  it("حالة 134:6 المقيسة: σ=0.9948، e=1.1731 ⇒ يحشر (لا أرضية لـe)", () => {
    const n = 27, w = 47, W = 13568;
    const D = (1 - 0.9948) * n * w;
    const L1 = W - (1.1731 - 1) * (n - 1) * w;
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(true);
  });

  it("أرضية الانكماش الصلبة σ<0.75 ترفض مهما حسُن البديل (قاعدة 16-ب)", () => {
    const n = 10, w = 50;
    // ‏σ<0.75 (انكماش >25%) يكسر حتمًا: D=0.25·n·w=125 هو حدّ σ=0.75
    expect(shouldShrinkPack(126, n, w, 10_000, 0)).toBe(false); // σ<0.75
    // عند الأرضية تمامًا (σ=0.75) مع بديل سيئ جدًا ⇒ سقف e يتبنى
    expect(shouldShrinkPack(125, n, w, 10_000, 0)).toBe(true); // σ=0.75
  });

  it("سقف التمديد e>1.5 يتبنى ولو رفضته نسبة الحدّين (فوق الأرضية)", () => {
    // ‏σ=0.80 (s=0.20، فوق الأرضية 0.75)، ‏e=1.8 (t=0.8): s/t=0.25
    const n = 10, w = 50, W = 5000;
    const D = 100; // σ = 1 − 100/(10·50) = 0.80
    const L1 = 4640; // e = 1 + (5000−4640)/(9·50) = 1.8
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(true); // e=1.8 > سقف 1.5
    // بسقف مرفوع (eCap=2) e<2 فتحكم النسبة s/t=0.25:
    expect(shouldShrinkPack(D, n, w, W, L1, { eCap: 2.0, k: 0.2 })).toBe(false);
    expect(shouldShrinkPack(D, n, w, W, L1, { eCap: 2.0, k: 0.3 })).toBe(true);
  });

  it("نسبة الحدّين تفصل «أن» الحدّية التي عجز الموزون عنها (masjid)", () => {
    // القيم المقيسة: e=1.1467 (t=0.1467)، σ=0.9236 (s=0.0764) ⇒ s/t=0.521
    const n = 24, w = 50, W = 13568;
    const D = (1 - 0.9236) * n * w;
    const L1 = W - (1.1467 - 1) * (n - 1) * w;
    // النموذج الخطّي القديم يحشر خطأً؛ نسبة الحدّين (k=0.5) تكسر كـWord
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(false);            // ratio
    expect(shouldShrinkPack(D, n, w, W, L1, { model: "linear" })).toBe(true); // القديم يخطئ
  });

  it("لا بلانكات معتد بها ⇒ لا انكماش", () => {
    expect(shouldShrinkPack(50, 0, 50, 1000, 900)).toBe(false);
  });
});

describe("breakLines — تكامل الانكماش", () => {
  /** حالة حدية مبنية يدويًا: عمود 1000؛ خمس كلمات (181×4 + 180) بمسافات 20
   *  ⇒ ‏L1=984؛ السادسة عرض 2 ⇒ ‏packed=1006، ‏D=6، ‏n=5، ‏σ=0.94 (s=0.06)،
   *  ‏e=1.2 (t=0.2) ⇒ نسبة الحدّين s/t=0.30 < k=0.5 ⇒ يحشر. */
  const edgeItems = (): BreakItem[] => [
    { width: 181, spaceBefore: 0, blankBefore: false },
    { width: 181, spaceBefore: 20, blankBefore: true },
    { width: 181, spaceBefore: 20, blankBefore: true },
    { width: 181, spaceBefore: 20, blankBefore: true },
    { width: 180, spaceBefore: 20, blankBefore: true },
    { width: 2, spaceBefore: 20, blankBefore: true },
  ];

  it("يحشر بالانكماش ويغلق السطر فورًا", () => {
    const lines = breakLines(edgeItems(), { columnTwips: 1000, justified: true });
    expect(lines[0]).toMatchObject({ start: 0, end: 6, shrunk: true });
  });

  it("compatibilityMode=11 يعطّل الانكماش (تنبؤ القاعدة 16 المؤكد)", () => {
    const lines = breakLines(edgeItems(), {
      columnTwips: 1000, justified: true, compatibilityMode: 11,
    });
    expect(lines[0]).toMatchObject({ start: 0, end: 5, shrunk: false });
  });

  it("غير المسوَّغ لا ينكمش", () => {
    const lines = breakLines(edgeItems(), { columnTwips: 1000, justified: false });
    expect(lines[0]).toMatchObject({ start: 0, end: 5, shrunk: false });
  });

  it("NBSP لا يُعد بلانكًا: سطر بلا بلانك معتد به لا ينكمش", () => {
    const items = edgeItems().map((it) => ({ ...it, blankBefore: false }));
    const lines = breakLines(items, { columnTwips: 1000, justified: true });
    expect(lines[0]).toMatchObject({ start: 0, end: 5, shrunk: false });
  });

  it("النموذج الخطّي القديم قابل للاستدعاء: div=1.7 يرفض حالة 104:0", () => {
    // حالة 104:0 المقيسة عبر النموذج الخطّي (model=linear) — تحوّط توافقٍ
    const n = 22, w = 50, W = 13601;
    const D = (1 - 0.8232) * n * w;
    const L1 = W - (1.3608 - 1) * (n - 1) * w;
    expect(shouldShrinkPack(D, n, w, W, L1, { model: "linear", div: 1.7 })).toBe(false);
    expect(shouldShrinkPack(D, n, w, W, L1, { model: "linear", div: 1.6 })).toBe(true);
    // النموذج الافتراضي (نسبة الحدّين) يحشرها كـWord: s/t=0.490 < 0.5
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(true);
  });
});

describe("numTabTextStart — قاعدة تاب الترقيم (القاعدة 22)", () => {
  // مثبتات sample-dawra المقيسة: indLeft=720، hanging=360، defaultTabStop=720
  it("علامة تسع التعليق ⇒ النص عند indLeft (الموقف الظاهري)", () => {
    expect(numTabTextStart({ indLeftTwips: 720, hangingTwips: 360, markerWidthTwips: 300 }))
      .toBe(720); // markerEnd=660 ≤ 720
  });

  it("علامة أعرض من التعليق ⇒ القفز لأول مضاعف defaultTabStop (درس dawra «17-»)", () => {
    // markerEnd = 360 + 450 = 810 > 720 ⇒ المضاعف التالي 1440
    expect(numTabTextStart({ indLeftTwips: 720, hangingTwips: 360, markerWidthTwips: 450 }))
      .toBe(1440);
  });

  it("موقف مخصص بعد نهاية العلامة يسبق المضاعفات التلقائية", () => {
    expect(numTabTextStart({
      indLeftTwips: 720, hangingTwips: 360, markerWidthTwips: 450,
      customTabsTwips: [900],
    })).toBe(900);
  });

  it("doNotUseIndentAsNumberingTabStop يُسقط الموقف الظاهري", () => {
    // بلا العلم: markerEnd=560 ≤ 720 ⇒ 720؛ بالعلم: يقفز للمضاعف 720... 
    // markerEnd=560 ⇒ المضاعف التالي 720 يصادف نفسه — نفرّق بحالة أوضح:
    expect(numTabTextStart({
      indLeftTwips: 1000, hangingTwips: 360, markerWidthTwips: 200,
      noIndentAsTabStop: true,
    })).toBe(1440); // markerEnd=840 ⇒ تجاهل 1000 والقفز لمضاعف 1440
    expect(numTabTextStart({
      indLeftTwips: 1000, hangingTwips: 360, markerWidthTwips: 200,
    })).toBe(1000);
  });

  it("بلا تعليق: لا موقف ظاهريًا — مضاعفات فقط", () => {
    expect(numTabTextStart({ indLeftTwips: 720, hangingTwips: 0, markerWidthTwips: 100 }))
      .toBe(1440); // anchor=720، markerEnd=820 ⇒ 1440
  });
});
