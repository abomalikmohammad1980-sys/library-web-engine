/**
 * كاسر الأسطر v1 — ‏greedy + القاعدة 16 (التسويغ الذكي بالانكماش، Word 2013+).
 *
 * المرجع: `docs/word-behavior-spec/smart-justify-shrink.md`.
 * الثوابت معايرة على الحقيقة (XPS) لا منقولة عن مصدر واحد:
 *  - أرضية عرض المسافة 75% (بوابة `D ≤ 0.25·(n+1)·w̄`) — نص الخوارزمية §3.
 *  - سقف التمديد `E_CAP = 1.5` (كان 1.33 حتى 2026-06 في MSO).
 *  - قاسم المقارنة الموزونة `DIV = 1.6`: نطاق الجدوى التجريبي من 33 قرارًا
 *    محكومًا بالحقيقة = ‏(1.481, 1.680] — و1.7 المستعار من هندسة LO العكسية
 *    خارجه. يعاد فحصه مع كل توسعة corpus.
 *  - المفتاح: `compatibilityMode ≥ 15` حصرًا — تأكد بالتكذيب على كتاب
 *    ‏compat=11 ‏(تعطيل الانكماش: 59.5%←82.4%).
 *
 * حدود معلومة (بنود بحث مفتوحة، لا تُرقَّع هنا):
 *  - أوضاع الكشيدة (lowKashida…) لها معاملات حشر مختلفة — البوابة هنا
 *    للتسويغ العادي (jc=both) فقط.
 *  - العرض المتاح سطرًا-بسطر ثابت (لا عائمات بعد).
 */

/** كلمة مقيسة مع مسافتها السابقة. الأعراض بالـ twips (قد تكون كسرية من
 *  التشكيل؛ التقريب مسؤولية طبقة القياس). */
export interface BreakItem {
  /** عرض الكلمة الطبيعي */
  width: number;
  /** عرض المسافة الطبيعية قبلها (0 لأول كلمة في الفقرة) */
  spaceBefore: number;
  /** المسافة السابقة بلانك U+0020 يُعتد به في الانكماش (NBSP وأشباهها: false) */
  blankBefore: boolean;
  /** ‏w:br بعد هذه الكلمة — كسر إجباري */
  forcedBreakAfter?: boolean;
}

export interface BreakParams {
  /** عرض العمود المتاح (بعد التقدمات اليسرى/اليمنى) */
  columnTwips: number;
  /** تقدم السطر الأول **بإشارته** — السالب تعليق (hanging) يوسّع السطر الأول */
  firstLineIndentTwips?: number;
  /** ‏jc=both — شرط تمريرة الانكماش */
  justified?: boolean;
  /** من settings.xml؛ الانكماش لـ≥15 حصرًا (الافتراضي 15) */
  compatibilityMode?: number;
  /** معاملات الانكماش — الافتراضيات المعايرة أعلاه */
  shrink?: { eCap?: number; div?: number };
}

export interface Line {
  /** فهرسا الكلمات [start, end) في مصفوفة المدخل */
  start: number;
  end: number;
  /** أُغلق بالحشر بالانكماش (مسافاته تُقلَّص عند الرسم ليساوي العمود) */
  shrunk: boolean;
  /** أُغلق بفاصل يدوي (w:br) */
  forced: boolean;
}

export const SHRINK_E_CAP = 1.5;
export const SHRINK_DIV = 1.6;

/** قرار تبنّي الحشر بالانكماش (القاعدة 16 §3–4) — دالة نقية قابلة للاختبار.
 *
 * @param D فائض السطر الطبيعي لو حُشرت الكلمة الحدية (twips، > 0)
 * @param n عدد البلانكات الداخلية المعتد بها في السطر المحشور (≥ 1)
 * @param meanSpace متوسط عرض البلانك الطبيعي w̄
 * @param W عرض السطر المتاح
 * @param L1 عرض السطر الطبيعي **بدون** الكلمة الحدية (بديل الكسر المبكر)
 */
export function shouldShrinkPack(
  D: number, n: number, meanSpace: number, W: number, L1: number,
  opts?: { eCap?: number; div?: number },
): boolean {
  if (n < 1 || meanSpace <= 0 || D <= 0) return false;
  // بوابة السماحية: أرضية عرض المسافة 75% بسماحية n+1
  if (D > 0.25 * (n + 1) * meanSpace) return false;
  const sigma = 1 - D / (n * meanSpace);
  if (sigma <= 0) return false;
  // بديل التمديد: كسر مبكر وتمديد n−1 بلانكات لملء W
  const n1 = n - 1;
  const e = n1 > 0 ? 1 + (W - L1) / (n1 * meanSpace) : Infinity;
  const eCap = opts?.eCap ?? SHRINK_E_CAP;
  const div = opts?.div ?? SHRINK_DIV;
  return e > eCap || 1 + (e - 1) / div >= 1 / sigma;
}

/** كسر فقرة مقيسة إلى أسطر بقرارات Word (greedy + القاعدة 16). */
export function breakLines(items: readonly BreakItem[], params: BreakParams): Line[] {
  const lines: Line[] = [];
  if (items.length === 0) return lines;
  const compat = params.compatibilityMode ?? 15;
  const shrinkEnabled = (params.justified ?? false) && compat >= 15;

  let start = 0;          // أول كلمة في السطر الجاري
  let lineW = 0;          // عرض السطر الطبيعي المتراكم
  let blanks = 0;         // بلانكات معتد بها داخل السطر
  let blanksW = 0;        // مجموع أعراضها الطبيعية

  const availFor = (lineIdx: number) =>
    params.columnTwips - (lineIdx === 0 ? (params.firstLineIndentTwips ?? 0) : 0);

  for (let i = 0; i < items.length; i++) {
    // ‏i < length بحكم الحلقة — non-null لأجل noUncheckedIndexedAccess
    const it = items[i]!;
    const first = i === start;
    const joinW = first ? 0 : it.spaceBefore;
    const W = availFor(lines.length);
    const packed = lineW + joinW + it.width;
    let fits = first || packed <= W;
    let shrunk = false;

    if (!fits && shrinkEnabled) {
      const n = blanks + (it.blankBefore ? 1 : 0);
      const B = blanksW + (it.blankBefore ? it.spaceBefore : 0);
      if (n >= 1) {
        shrunk = shouldShrinkPack(packed - W, n, B / n, W, lineW, params.shrink);
        fits = shrunk;
      }
    }

    if (!fits) {
      lines.push({ start, end: i, shrunk: false, forced: false });
      start = i; lineW = it.width; blanks = 0; blanksW = 0;
    } else {
      lineW += joinW + it.width;
      if (!first && it.blankBefore) { blanks++; blanksW += it.spaceBefore; }
      if (shrunk) {
        // السطر المحشور ممتلئ — يُغلق فورًا (السلوك المرصود في الحقيقة)
        lines.push({ start, end: i + 1, shrunk: true, forced: false });
        start = i + 1; lineW = 0; blanks = 0; blanksW = 0;
        continue;
      }
    }

    if (it.forcedBreakAfter && start <= i) {
      lines.push({ start, end: i + 1, shrunk: false, forced: true });
      start = i + 1; lineW = 0; blanks = 0; blanksW = 0;
    }
  }
  if (start < items.length)
    lines.push({ start, end: items.length, shrunk: false, forced: false });
  return lines;
}
