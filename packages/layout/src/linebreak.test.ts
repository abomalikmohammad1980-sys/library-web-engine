import { describe, expect, it } from "vitest";

import { breakLines, shouldShrinkPack, type BreakItem } from "./linebreak.js";

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

  it("بوابة السماحية: D فوق 0.25·(n+1)·w̄ يرفض مهما حسُن البديل", () => {
    const n = 10, w = 50;
    const gate = 0.25 * (n + 1) * w; // 137.5
    expect(shouldShrinkPack(gate + 1, n, w, 10_000, 0)).toBe(false);
    // على البوابة تمامًا (σ≈0.725 عند n=10) مع بديل سيئ جدًا ⇒ سقف e يتبنى
    expect(shouldShrinkPack(gate, n, w, 10_000, 0)).toBe(true);
  });

  it("سقف التمديد e>1.5 يتبنى ولو رفضته المقارنة الموزونة", () => {
    // ‏σ=0.726 (الموزون يرفض: 1.375 < 1.3774) لكن e=1.6 فوق السقف
    const n = 10, w = 50, W = 5000;
    const D = (1 - 0.726) * n * w; // 137 ≤ البوابة 137.5
    const L1 = W - 0.6 * (n - 1) * w; // e = 1.6
    expect(shouldShrinkPack(D, n, w, W, L1)).toBe(true);
    // نفس الحالة بسقف مرفوع (A/B) ⇒ القرار للموزون: يرفض
    expect(shouldShrinkPack(D, n, w, W, L1, { eCap: 2.0 })).toBe(false);
  });

  it("لا بلانكات معتد بها ⇒ لا انكماش", () => {
    expect(shouldShrinkPack(50, 0, 50, 1000, 900)).toBe(false);
  });
});

describe("breakLines — تكامل الانكماش", () => {
  /** حالة حدية مبنية يدويًا: عمود 1000؛ خمس كلمات (181×4 + 180) بمسافات 20
   *  ⇒ ‏L1=984؛ السادسة عرض 6 ⇒ ‏D=10، ‏σ=0.9، ‏e=1.2،
   *  الموزون 1.125 ≥ 1/σ=1.111 ⇒ يحشر. */
  const edgeItems = (): BreakItem[] => [
    { width: 181, spaceBefore: 0, blankBefore: false },
    { width: 181, spaceBefore: 20, blankBefore: true },
    { width: 181, spaceBefore: 20, blankBefore: true },
    { width: 181, spaceBefore: 20, blankBefore: true },
    { width: 180, spaceBefore: 20, blankBefore: true },
    { width: 6, spaceBefore: 20, blankBefore: true },
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

  it("قاسم الموزون قابل للضبط: div=1.7 التاريخي يرفض حالة 104:0", () => {
    // نفس حالة 104:0 لكن عبر breakLines بأعراض مركبة تعطي σ/e المقيسين
    const n = 22, w = 50, W = 13601;
    const D = (1 - 0.8232) * n * w;
    const L1 = W - (1.3608 - 1) * (n - 1) * w;
    expect(shouldShrinkPack(D, n, w, W, L1, { div: 1.7 })).toBe(false);
    expect(shouldShrinkPack(D, n, w, W, L1, { div: 1.6 })).toBe(true);
  });
});
