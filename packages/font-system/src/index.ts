/**
 * ‏@engine/font-system — طلب الخط وحلّه (v0).
 *
 * المسؤولية: تحويل (عائلة OOXML + عريض/مائل) إلى بايتات خطٍّ قابلة للتشكيل،
 * عبر موفِّرٍ يقدّمه المستهلك (app/الاختبارات). لا يقرأ جداول الخط (هذا
 * لـ `shaper`/مقاييس لاحقة) — هو طبقة الاسم فقط + كاش بايتات.
 *
 * قرار عريض: العائلة المطلوبة `bold` قد تكون وجهًا قائمًا بذاته في نظام
 * الخطوط (درس Flutter: Traditional Arabic Bold يقطّع الحروف إذا طُلب وزن
 * صناعي) — لذلك نطلب وجهًا صريحًا باسمه أولًا، ثم نعود للوجه العادي.
 */

/** معرّف خطٍّ فريد في الجلسة — مفتاح كاش وجه المورّد. */
export interface FontKey {
  /** اسم العائلة كما في OOXML (‏w:rFonts@cs) */
  family: string;
  bold?: boolean;
  italic?: boolean;
}

export interface FontRequest extends FontKey {
  /** عائلة احتياطية إن لم يوجد المطلوب (أولوية: المتاح) */
  fallbackFamily?: string | null;
}

/** موفِّر البايتات — يوفرها المستهلك (متصفح: جلب؛ Node: قرص؛ اختبار: سجل). */
export interface FontProvider {
  resolveFont(req: FontRequest): Promise<Uint8Array | null>;
  /** حل اختياري موثّق الهوية؛ يتيح للمشهد كشف الاستبدال بدل إخفائه. */
  resolveFontDetailed?(req: FontRequest): Promise<ResolvedFont | null>;
}

export interface ResolvedFont {
  data: Uint8Array;
  resolvedFamily: string;
  source: "exact" | "fallback-family" | "default";
}

/** تطبيع اسم عائلة OOXML ⟵ اسم ملف متوقع (للمطابقة في التسجيل). */
export function normalizeFamily(name: string): string {
  return name.toLowerCase().replace(/\s+/g, " ").trim();
}

/** وجهُ العائلة المطلوب: يبحث أولًا باسم «العائلة + عريض/مائل» (وجه صريح)،
 *  ثم بالعائلة المجردة. المطابقة عبر التسجيل النهائي في المورّد. */
export function familyCandidates(family: string, bold?: boolean, italic?: boolean): string[] {
  const out: string[] = [];
  const base = normalizeFamily(family);
  const tail = [bold ? "bold" : "", italic ? "italic" : ""].filter(Boolean).join(" ");
  if (tail) out.push(`${base} ${tail}`, `${base}-${tail}`, `${base}${tail.replace(" ", "")}`);
  out.push(base);
  return out;
}

/**
 * موفِّر سجلٍّ بسيط — للاختبارات والعرض: خريطة اسمٍ منسّق ⟵ بايتات.
 * حلّ الوجه: العائلة+عريض ثم العائلة. الاستبدال عبر `fallback` عند غياب كل
 * المرشحين (مثال: "sakkal majalla" غير متاح ⟵ Al-Jazeera-Regular).
 */
export function registryProvider(registry: Record<string, Uint8Array>, fallback?: string): FontProvider {
  const normalize = (n: string) => normalizeFamily(n);
  const pick = (names: string[]): Uint8Array | null => {
    for (const n of names) {
      const hit = registry[normalize(n)];
      if (hit) return hit;
    }
    return null;
  };
  const detailed = async (req: FontRequest): Promise<ResolvedFont | null> => {
      const hit = pick(familyCandidates(req.family, req.bold, req.italic));
      if (hit) return { data: hit, resolvedFamily: req.family, source: "exact" };
      if (req.fallbackFamily) {
        const fb = pick(familyCandidates(req.fallbackFamily));
        if (fb) return { data: fb, resolvedFamily: req.fallbackFamily, source: "fallback-family" };
      }
      if (fallback) {
        const f = registry[normalize(fallback)];
        if (f) return { data: f, resolvedFamily: fallback, source: "default" };
      }
      return null;
  };
  return {
    async resolveFont(req) {
      return (await detailed(req))?.data ?? null;
    },
    resolveFontDetailed: detailed,
  };
}

/** عائلات نعرفها للاستبدال عند غياب خط — مفتاح ⟵ عائلة معروفة. (سجلّ مصغّر.) */
export const KNOWN_ALIASES: Record<string, string> = {
  "sakkal majalla": "Al-Jazeera-Arabic-Regular",
  "traditional arabic": "Al-Jazeera-Arabic-Regular",
  "times new roman": "Al-Jazeera-Arabic-Regular",
  "arial": "Al-Jazeera-Arabic-Regular",
  "aptos": "Al-Jazeera-Arabic-Regular",
  "courier new": "Al-Jazeera-Arabic-Regular",
};

/** طلب خطٍّ بعائلة OOXML ⟵ {family, bold, italic} مع استبدال العائلات المعروفة. */
export function fontRequest(family: string | null, bold?: boolean, italic?: boolean): FontRequest {
  const f = family ? normalizeFamily(family) : "Al-Jazeera-Arabic-Regular";
  const req: FontRequest = { family: f, fallbackFamily: KNOWN_ALIASES[f] ?? null };
  if (bold !== undefined) req.bold = bold;
  if (italic !== undefined) req.italic = italic;
  return req;
}
